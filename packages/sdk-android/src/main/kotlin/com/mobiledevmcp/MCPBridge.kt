/**
 * MCP Bridge - Android SDK (Inline Version)
 * 
 * This is a standalone version of the MCP SDK for the demo app.
 * In production, you would add the MobileDevMCP dependency.
 */

package com.mobiledevmcp

import android.content.Context
import android.os.Build
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.TimeUnit
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * MCP Bridge singleton for connecting to the MCP server
 */
object MCPBridge {
    private const val TAG = "MCP SDK"
    private const val RECONNECT_DELAY_MS = 3000L
    
    private var webSocket: WebSocket? = null
    private var okHttpClient: OkHttpClient? = null
    private var contextRef: WeakReference<Context>? = null
    private val stateGetters = mutableMapOf<String, () -> Any?>()
    private val actionHandlers = mutableMapOf<String, suspend (Map<String, Any?>) -> Any?>()
    private val featureFlags = mutableMapOf<String, Boolean>()
    private val logs = mutableListOf<Map<String, Any>>()
    private val networkRequests = mutableListOf<Map<String, Any>>()
    private val activityLog = mutableListOf<String>()
    
    // Component registry for UI inspection
    private val components = mutableMapOf<String, RegisteredComponent>()
    
    // Navigation state tracking
    private var navigationState = NavigationState()
    
    // Network mocking
    private val networkMocks = mutableMapOf<String, NetworkMock>()
    
    // Tracing
    private val activeTraces = mutableMapOf<String, TraceEntry>()
    private val traceHistory = mutableListOf<TraceEntry>()
    private var traceIdCounter = 0
    
    // Data classes for component registration
    data class RegisteredComponent(
        val testId: String,
        val type: String,
        var props: Map<String, Any?>? = null,
        var bounds: Bounds? = null,
        var onTap: (() -> Unit)? = null,
        var getText: (() -> String?)? = null
    )
    
    data class Bounds(val x: Float, val y: Float, val width: Float, val height: Float)
    
    data class NavigationState(
        var currentRoute: String = "home",
        var params: Map<String, Any?>? = null,
        val history: MutableList<Pair<String, Long>> = mutableListOf()
    )
    
    data class NetworkMock(
        val id: String,
        val urlPattern: Regex,
        val statusCode: Int,
        val body: Any,
        val headers: Map<String, String>? = null,
        val delay: Long? = null
    )
    
    // Tracing data classes
    data class TraceInfo(
        val args: Map<String, Any?>? = null,
        val file: String? = null,
        val startTime: Long? = null,
        val metadata: Map<String, Any?>? = null
    )
    
    data class TraceEntry(
        val id: String,
        val name: String,
        val info: TraceInfo,
        val timestamp: Long,
        var duration: Long? = null,
        var returnValue: Any? = null,
        var error: String? = null,
        var completed: Boolean = false
    )
    
    data class TraceFilter(
        val name: String? = null,
        val file: String? = null,
        val minDuration: Long? = null,
        val since: Long? = null,
        val limit: Int? = null,
        val inProgress: Boolean? = null
    )
    
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var isInitialized = false
    private var serverUrl = DEFAULT_SERVER_URL
    private var debug = true
    
    // Default server URL - use 10.0.2.2 for emulator, localhost for real devices
    private const val DEFAULT_PORT = "8765"
    private val DEFAULT_SERVER_URL: String
        get() = "ws://${getDefaultHost()}:$DEFAULT_PORT"
    
    private fun getDefaultHost(): String {
        // Check if running on emulator
        return if (Build.FINGERPRINT.contains("generic") || 
                   Build.FINGERPRINT.contains("emulator") ||
                   Build.MODEL.contains("Emulator") ||
                   Build.MODEL.contains("Android SDK")) {
            "10.0.2.2" // Emulator -> host machine
        } else {
            "localhost" // Real device (use adb reverse)
        }
    }
    private var reconnectJob: Job? = null
    private var reconnectAttempts = 0
    
    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()
    
    private val _lastActivity = MutableStateFlow("")
    val lastActivity: StateFlow<String> = _lastActivity.asStateFlow()
    
    private val _reconnectCount = MutableStateFlow(0)
    val reconnectCount: StateFlow<Int> = _reconnectCount.asStateFlow()
    
    /**
     * Initialize the MCP SDK
     */
    fun initialize(
        context: Context,
        serverUrl: String? = null,
        debug: Boolean = true
    ) {
        if (!isDebugBuild(context)) {
            Log.w(TAG, "SDK only works in DEBUG builds")
            return
        }
        
        if (isInitialized) {
            Log.w(TAG, "Already initialized")
            return
        }
        
        contextRef = WeakReference(context.applicationContext)
        this.serverUrl = serverUrl ?: DEFAULT_SERVER_URL
        this.debug = debug
        
        connect()
        
        isInitialized = true
        log("Initialized, connecting to ${this.serverUrl}")
    }
    
    /**
     * Expose state for inspection
     */
    fun exposeState(key: String, getter: () -> Any?) {
        stateGetters[key] = getter
        if (debug) {
            log("Exposed state: $key")
        }
    }
    
    /**
     * Register an action handler that can be triggered remotely via MCP
     */
    fun registerAction(name: String, handler: suspend (Map<String, Any?>) -> Any?) {
        actionHandlers[name] = handler
        if (debug) {
            log("Registered action: $name")
        }
    }
    
    /**
     * Register multiple action handlers at once
     */
    fun registerActions(actions: Map<String, suspend (Map<String, Any?>) -> Any?>) {
        actions.forEach { (name, handler) -> registerAction(name, handler) }
    }
    
    /**
     * Get list of registered actions
     */
    fun getRegisteredActions(): List<String> = actionHandlers.keys.toList()
    
    /**
     * Register feature flags
     */
    fun registerFeatureFlags(flags: Map<String, Boolean>) {
        flags.forEach { (key, value) -> featureFlags[key] = value }
        log("Registered ${flags.size} feature flags")
    }
    
    /**
     * Get feature flag value
     */
    fun getFeatureFlag(key: String): Boolean {
        return featureFlags[key] ?: false
    }
    
    // ==================== Tracing API ====================
    
    /**
     * Trace a function call (called at function entry)
     * @param name Function name (e.g., "UserService.fetchUser")
     * @param info Trace info including args, file, timing
     * @return Trace ID for correlation
     */
    fun trace(name: String, info: TraceInfo = TraceInfo()): String {
        if (!isDebugBuild()) return ""
        
        traceIdCounter++
        val id = "trace_${traceIdCounter}_${System.currentTimeMillis()}"
        
        val entry = TraceEntry(
            id = id,
            name = name,
            info = info,
            timestamp = info.startTime ?: System.currentTimeMillis(),
            completed = false
        )
        
        activeTraces[id] = entry
        activeTraces["name:$name"] = entry
        
        if (debug) {
            Log.d(TAG, "[Trace] → $name ${info.args ?: emptyMap<String, Any>()}")
        }
        
        return id
    }
    
    /**
     * Convenience overload for trace with args map
     */
    fun trace(name: String, args: Map<String, Any?>, file: String? = null): String {
        return trace(name, TraceInfo(args = args, file = file, startTime = System.currentTimeMillis()))
    }
    
    /**
     * Complete a trace (called at function exit)
     * @param name Function name
     * @param returnValue Return value (optional)
     * @param error Error message if function threw (optional)
     */
    fun traceReturn(name: String, returnValue: Any? = null, error: String? = null) {
        if (!isDebugBuild()) return
        
        val entry = activeTraces["name:$name"] ?: return
        
        val now = System.currentTimeMillis()
        entry.duration = now - entry.timestamp
        entry.returnValue = returnValue
        entry.error = error
        entry.completed = true
        
        traceHistory.add(entry)
        if (traceHistory.size > 1000) {
            traceHistory.removeAt(0)
        }
        
        activeTraces.remove(entry.id)
        activeTraces.remove("name:$name")
        
        if (debug) {
            val status = if (error != null) "✗ $error" else "✓"
            Log.d(TAG, "[Trace] ← $name (${entry.duration}ms) $status")
        }
    }
    
    /**
     * Trace an async function with automatic entry/exit tracking
     */
    suspend fun <T> traceAsync(
        name: String,
        info: TraceInfo = TraceInfo(),
        block: suspend () -> T
    ): T {
        val traceInfo = info.copy(startTime = System.currentTimeMillis())
        trace(name, traceInfo)
        
        return try {
            val result = block()
            traceReturn(name, result)
            result
        } catch (e: Exception) {
            traceReturn(name, error = e.message)
            throw e
        }
    }
    
    /**
     * Trace a synchronous function
     */
    fun <T> traceSync(
        name: String,
        info: TraceInfo = TraceInfo(),
        block: () -> T
    ): T {
        val traceInfo = info.copy(startTime = System.currentTimeMillis())
        trace(name, traceInfo)
        
        return try {
            val result = block()
            traceReturn(name, result)
            result
        } catch (e: Exception) {
            traceReturn(name, error = e.message)
            throw e
        }
    }
    
    /**
     * Get trace history with optional filtering
     */
    fun getTraces(filter: TraceFilter = TraceFilter()): List<TraceEntry> {
        var traces = if (filter.inProgress == true) {
            activeTraces.values.filter { !it.id.startsWith("name:") }.toList()
        } else {
            traceHistory.toList()
        }
        
        filter.name?.let { pattern ->
            traces = traces.filter { it.name.contains(pattern, ignoreCase = true) }
        }
        
        filter.file?.let { pattern ->
            traces = traces.filter { it.info.file?.contains(pattern, ignoreCase = true) == true }
        }
        
        filter.minDuration?.let { min ->
            traces = traces.filter { (it.duration ?: 0) >= min }
        }
        
        filter.since?.let { since ->
            val sinceTimestamp = System.currentTimeMillis() - since
            traces = traces.filter { it.timestamp >= sinceTimestamp }
        }
        
        val limit = filter.limit ?: 100
        return traces.takeLast(limit).reversed()
    }
    
    /**
     * Clear trace history
     */
    fun clearTraces() {
        activeTraces.clear()
        traceHistory.clear()
    }
    
    // ==================== Dynamic Instrumentation API (Debug Mode) ====================
    
    data class InjectedTrace(
        val id: String,
        val pattern: Regex,
        val logArgs: Boolean = true,
        val logReturn: Boolean = true,
        var active: Boolean = true
    )
    
    private val injectedTraces = mutableMapOf<String, InjectedTrace>()
    
    /**
     * Inject a trace point at runtime (for Debug Mode)
     * @param pattern Function name pattern (supports wildcards, e.g., "Cart*", "UserService.fetch*")
     * @param logArgs Whether to log arguments
     * @param logReturn Whether to log return values
     * @return Injection ID for later removal
     */
    fun injectTrace(pattern: String, logArgs: Boolean = true, logReturn: Boolean = true): String {
        val id = "inject_${System.currentTimeMillis()}_${(1000..9999).random()}"
        
        // Convert pattern to regex
        val regexPattern = pattern
            .replace(".", "\\.")
            .replace("*", ".*")
        
        injectedTraces[id] = InjectedTrace(
            id = id,
            pattern = Regex("^$regexPattern$"),
            logArgs = logArgs,
            logReturn = logReturn,
            active = true
        )
        
        if (debug) {
            Log.d(TAG, "[Debug] Injected trace: $pattern (id: $id)")
        }
        
        return id
    }
    
    /**
     * Remove a specific injected trace
     */
    fun removeTrace(id: String): Boolean {
        val removed = injectedTraces.remove(id) != null
        if (debug && removed) {
            Log.d(TAG, "[Debug] Removed trace: $id")
        }
        return removed
    }
    
    /**
     * Clear all injected traces
     */
    fun clearInjectedTraces(): Int {
        val count = injectedTraces.size
        injectedTraces.clear()
        if (debug) {
            Log.d(TAG, "[Debug] Cleared $count injected traces")
        }
        return count
    }
    
    /**
     * List all currently injected traces
     */
    fun listInjectedTraces(): List<Map<String, Any?>> {
        return injectedTraces.values.map { trace ->
            mapOf(
                "id" to trace.id,
                "pattern" to trace.pattern.pattern,
                "active" to trace.active
            )
        }
    }
    
    /**
     * Check if a function name matches any injected trace pattern
     */
    private fun matchesInjectedTrace(name: String): Boolean {
        return injectedTraces.values.any { trace ->
            trace.active && trace.pattern.matches(name)
        }
    }
    
    private fun isDebugBuild(): Boolean {
        val context = contextRef?.get() ?: return false
        return isDebugBuild(context)
    }
    
    // ==================== Logging API ====================
    
    /**
     * Enable log capture
     */
    fun enableLogCapture() {
        log("Log capture enabled")
    }
    
    /**
     * Enable network interception
     */
    fun enableNetworkInterception() {
        log("Network interception enabled")
    }
    
    /**
     * Disconnect from server
     */
    fun disconnect() {
        reconnectJob?.cancel()
        reconnectJob = null
        webSocket?.close(1000, "Closing")
        webSocket = null
        _isConnected.value = false
        logActivity("Disconnected by user")
    }
    
    /**
     * Get activity log for debugging
     */
    fun getActivityLog(): List<String> = activityLog.toList()
    
    /**
     * Get current server URL
     */
    fun getServerUrl(): String = serverUrl
    
    /**
     * Manually trigger reconnect
     */
    fun reconnect() {
        disconnect()
        connect()
    }
    
    // MARK: - Private Methods
    
    private fun connect() {
        // Cancel any pending reconnect
        reconnectJob?.cancel()
        reconnectJob = null
        
        if (okHttpClient == null) {
            okHttpClient = OkHttpClient.Builder()
                .readTimeout(0, TimeUnit.MILLISECONDS)
                .pingInterval(30, TimeUnit.SECONDS)
                .build()
        }
        
        val request = Request.Builder()
            .url(serverUrl)
            .build()
        
        logActivity("Connecting to $serverUrl...")
        
        webSocket = okHttpClient!!.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                reconnectAttempts = 0
                _reconnectCount.value = 0
                log("Connected to server")
                logActivity("Connected!")
                _isConnected.value = true
                
                // Send handshake (expected by device manager)
                val context = contextRef?.get()
                val handshake = JSONObject().apply {
                    put("type", "handshake")
                    put("platform", "android")
                    put("appName", context?.applicationInfo?.loadLabel(context.packageManager)?.toString() ?: "MCPDemoApp")
                    put("appVersion", context?.let {
                        it.packageManager.getPackageInfo(it.packageName, 0).versionName
                    } ?: "1.0.0")
                    put("deviceId", "android_${Build.MODEL}_${System.currentTimeMillis()}")
                    put("capabilities", org.json.JSONArray(listOf("state", "logs", "network", "featureFlags", "actions", "ui", "tracing")))
                }
                webSocket.send(handshake.toString())
                logActivity("Sent handshake")
            }
            
            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }
            
            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                log("Connection closing: $reason")
                logActivity("Disconnected: $reason")
                _isConnected.value = false
                scheduleReconnect()
            }
            
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                log("Connection closed: $reason")
                _isConnected.value = false
                scheduleReconnect()
            }
            
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "Connection failed: ${t.message}")
                logActivity("Connection failed: ${t.message}")
                _isConnected.value = false
                scheduleReconnect()
            }
        })
    }
    
    private fun scheduleReconnect() {
        if (!isInitialized) return
        
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            reconnectAttempts++
            _reconnectCount.value = reconnectAttempts
            logActivity("Reconnecting in ${RECONNECT_DELAY_MS/1000}s (attempt $reconnectAttempts)...")
            delay(RECONNECT_DELAY_MS)
            if (isInitialized && !_isConnected.value) {
                connect()
            }
        }
    }
    
    private fun logActivity(message: String) {
        val timestamp = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())
        val entry = "[$timestamp] $message"
        activityLog.add(entry)
        if (activityLog.size > 50) activityLog.removeAt(0)
        _lastActivity.value = entry
        if (debug) Log.d(TAG, message)
    }
    
    private fun handleMessage(text: String) {
        try {
            val json = JSONObject(text)
            val id = json.optString("id")
            val method = json.optString("method")
            val params = json.optJSONObject("params") ?: JSONObject()
            
            if (method.isNotEmpty()) {
                logActivity("← Command: $method")
            }
            
            scope.launch {
                try {
                    val result = handleCommandSuspend(method, params)
                    sendResponse(id, result)
                    logActivity("→ Response: $method OK")
                } catch (e: Exception) {
                    sendError(id, e.message ?: "Unknown error")
                    logActivity("→ Error: $method - ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse message: ${e.message}")
        }
    }
    
    private suspend fun handleCommandSuspend(method: String, params: JSONObject): Any? {
        return when (method) {
            "get_app_state" -> getAppState(params)
            "list_feature_flags" -> featureFlags
            "toggle_feature_flag" -> toggleFeatureFlag(params)
            "get_device_info" -> getDeviceInfo()
            "get_app_info" -> getAppInfo()
            "get_logs" -> logs.takeLast(params.optInt("limit", 100))
            "get_recent_errors" -> logs.filter { it["level"] == "error" }.takeLast(params.optInt("limit", 20))
            "list_network_requests" -> networkRequests.takeLast(params.optInt("limit", 50))
            
            // UI inspection commands
            "get_component_tree" -> getComponentTree(params)
            "get_layout_tree" -> getLayoutTree(params)
            "inspect_element" -> inspectElement(params)
            "find_element" -> findElement(params)
            "get_element_text" -> getElementText(params)
            "simulate_interaction" -> simulateInteraction(params)
            
            // Navigation commands
            "get_navigation_state" -> getNavigationStateMap()
            
            // Storage commands
            "query_storage" -> queryStorage(params)
            
            // Network mocking commands
            "mock_network_request" -> mockNetworkRequest(params)
            "clear_network_mocks" -> clearNetworkMocks(params)
            
            // Tracing commands
            "get_traces" -> getTracesMap(params)
            "get_active_traces" -> getTracesMap(JSONObject().put("inProgress", true))
            "clear_traces" -> {
                clearTraces()
                mapOf("success" to true)
            }
            
            // Dynamic instrumentation commands (Debug Mode)
            "inject_trace" -> {
                val pattern = params.optString("pattern", "")
                if (pattern.isEmpty()) throw Exception("pattern is required")
                val logArgs = params.optBoolean("logArgs", true)
                val logReturn = params.optBoolean("logReturn", true)
                mapOf("id" to injectTrace(pattern, logArgs, logReturn), "success" to true)
            }
            "remove_trace" -> {
                val id = params.optString("id", "")
                if (id.isEmpty()) throw Exception("id is required")
                mapOf("success" to removeTrace(id))
            }
            "clear_injected_traces" -> {
                mapOf("cleared" to clearInjectedTraces(), "success" to true)
            }
            "list_injected_traces" -> {
                mapOf("traces" to listInjectedTraces())
            }
            
            // Action commands
            "list_actions" -> getRegisteredActions()
            "navigate_to" -> executeAction("navigate", params.toMap())
            "execute_action" -> {
                val actionName = params.optString("action", "")
                if (actionName.isEmpty()) throw Exception("action is required")
                executeAction(actionName, params.toMap())
            }
            "add_to_cart" -> executeAction("addToCart", params.toMap())
            "remove_from_cart" -> executeAction("removeFromCart", params.toMap())
            "clear_cart" -> executeAction("clearCart", params.toMap())
            "login" -> executeAction("login", params.toMap())
            "logout" -> executeAction("logout", params.toMap())
            else -> {
                // Try to find a registered action handler
                if (actionHandlers.containsKey(method)) {
                    executeAction(method, params.toMap())
                } else {
                    throw Exception("Unknown method: $method")
                }
            }
        }
    }
    
    private suspend fun executeAction(name: String, params: Map<String, Any?>): Map<String, Any?> {
        val handler = actionHandlers[name] ?: throw Exception("Action not registered: $name")
        val result = handler(params)
        return mapOf("success" to true, "action" to name, "result" to result)
    }
    
    // ==================== Component Registration ====================
    
    fun registerComponent(
        testId: String,
        type: String,
        props: Map<String, Any?>? = null,
        bounds: Bounds? = null,
        onTap: (() -> Unit)? = null,
        getText: (() -> String?)? = null
    ) {
        components[testId] = RegisteredComponent(testId, type, props, bounds, onTap, getText)
        if (debug) log("Registered component: $testId")
    }
    
    fun unregisterComponent(testId: String) {
        components.remove(testId)
    }
    
    fun updateComponentBounds(testId: String, bounds: Bounds) {
        components[testId]?.bounds = bounds
    }
    
    // ==================== UI Inspection ====================
    
    private fun getComponentTree(params: JSONObject): Map<String, Any?> {
        val includeProps = params.optBoolean("includeProps", true)
        
        val componentList = components.values.map { comp ->
            mutableMapOf<String, Any?>(
                "testId" to comp.testId,
                "type" to comp.type,
                "hasTapHandler" to (comp.onTap != null),
                "hasTextGetter" to (comp.getText != null)
            ).apply {
                if (includeProps && comp.props != null) put("props", comp.props)
                comp.bounds?.let { b -> put("bounds", mapOf("x" to b.x, "y" to b.y, "width" to b.width, "height" to b.height)) }
            }
        }
        
        return mapOf(
            "componentCount" to components.size,
            "components" to componentList,
            "registeredTestIds" to components.keys.toList()
        )
    }
    
    private fun getLayoutTree(params: JSONObject): Map<String, Any?> {
        val includeHidden = params.optBoolean("includeHidden", false)
        
        val elements = components.values.filter { includeHidden || it.bounds != null }.map { comp ->
            val b = comp.bounds ?: Bounds(0f, 0f, 0f, 0f)
            mapOf(
                "testId" to comp.testId,
                "type" to comp.type,
                "bounds" to mapOf("x" to b.x, "y" to b.y, "width" to b.width, "height" to b.height),
                "visible" to (comp.bounds != null)
            )
        }
        
        return mapOf("elementCount" to elements.size, "elements" to elements)
    }
    
    private fun inspectElement(params: JSONObject): Map<String, Any?> {
        val x = params.optDouble("x", -1.0).toFloat()
        val y = params.optDouble("y", -1.0).toFloat()
        
        for (comp in components.values) {
            val b = comp.bounds ?: continue
            if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
                return mapOf(
                    "found" to true,
                    "testId" to comp.testId,
                    "type" to comp.type,
                    "bounds" to mapOf("x" to b.x, "y" to b.y, "width" to b.width, "height" to b.height),
                    "text" to comp.getText?.invoke(),
                    "interactive" to (comp.onTap != null)
                )
            }
        }
        
        return mapOf("found" to false, "x" to x, "y" to y)
    }
    
    private fun findElement(params: JSONObject): Map<String, Any?> {
        val testId = params.optString("testId", null)
        val type = params.optString("type", null)
        val text = params.optString("text", null)
        
        val results = components.values.filter { comp ->
            (testId == null || comp.testId == testId) &&
            (type == null || comp.type == type) &&
            (text == null || comp.getText?.invoke() == text)
        }.map { comp ->
            mutableMapOf<String, Any?>(
                "testId" to comp.testId,
                "type" to comp.type,
                "text" to comp.getText?.invoke()
            ).apply {
                comp.bounds?.let { b -> put("bounds", mapOf("x" to b.x, "y" to b.y, "width" to b.width, "height" to b.height)) }
            }
        }
        
        return mapOf("found" to results.isNotEmpty(), "count" to results.size, "elements" to results)
    }
    
    private fun getElementText(params: JSONObject): Map<String, Any?> {
        val testId = params.optString("testId", "")
        val comp = components[testId] ?: return mapOf("found" to false, "testId" to testId)
        return mapOf("found" to true, "testId" to testId, "text" to comp.getText?.invoke(), "type" to comp.type)
    }
    
    private fun simulateInteraction(params: JSONObject): Map<String, Any?> {
        val type = params.optString("type", "")
        val target = params.optJSONObject("target") ?: return mapOf("success" to false, "error" to "target required")
        
        val comp = if (target.has("testId")) {
            components[target.getString("testId")]
        } else if (target.has("x") && target.has("y")) {
            val x = target.getDouble("x").toFloat()
            val y = target.getDouble("y").toFloat()
            components.values.find { c ->
                c.bounds?.let { b -> x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height } == true
            }
        } else null
        
        comp ?: return mapOf("success" to false, "error" to "Element not found")
        
        return when (type) {
            "tap", "press" -> {
                comp.onTap?.let {
                    scope.launch { it() }
                    mapOf("success" to true, "action" to "tap", "testId" to comp.testId)
                } ?: mapOf("success" to false, "error" to "Element not tappable", "testId" to comp.testId)
            }
            else -> mapOf("success" to false, "error" to "Unknown interaction type: $type")
        }
    }
    
    // ==================== Navigation State ====================
    
    fun setNavigationState(route: String, params: Map<String, Any?>? = null) {
        navigationState.history.add(navigationState.currentRoute to System.currentTimeMillis())
        navigationState.currentRoute = route
        navigationState.params = params
        
        // Keep last 20 entries
        while (navigationState.history.size > 20) {
            navigationState.history.removeAt(0)
        }
    }
    
    private fun getNavigationStateMap(): Map<String, Any?> = mapOf(
        "currentRoute" to navigationState.currentRoute,
        "params" to navigationState.params,
        "history" to navigationState.history.map { mapOf("route" to it.first, "timestamp" to it.second) },
        "historyLength" to navigationState.history.size
    )
    
    // ==================== Storage Query ====================
    
    private fun queryStorage(params: JSONObject): Map<String, Any?> {
        val context = contextRef?.get() ?: return mapOf("error" to "Context not available")
        val prefs = context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        val key = params.optString("key", null)
        
        if (key != null) {
            val value = prefs.all[key]
            return mapOf("key" to key, "value" to value, "exists" to (value != null))
        }
        
        val pattern = params.optString("pattern", null)
        var keys = prefs.all.keys.toList()
        
        if (pattern != null) {
            val regex = Regex(pattern)
            keys = keys.filter { regex.containsMatchIn(it) }
        }
        
        val storage = keys.take(100).associateWith { prefs.all[it] }
        return mapOf("keyCount" to keys.size, "keys" to keys.take(100), "storage" to storage)
    }
    
    // ==================== Network Mocking ====================
    
    private fun mockNetworkRequest(params: JSONObject): Map<String, Any?> {
        val urlPattern = params.optString("urlPattern", "") 
        val mockResponse = params.optJSONObject("mockResponse") ?: return mapOf("success" to false, "error" to "mockResponse required")
        
        val mockId = "mock_${System.currentTimeMillis()}_${(1000..9999).random()}"
        
        networkMocks[mockId] = NetworkMock(
            id = mockId,
            urlPattern = Regex(urlPattern),
            statusCode = mockResponse.optInt("statusCode", 200),
            body = mockResponse.opt("body") ?: "",
            headers = mockResponse.optJSONObject("headers")?.let { h ->
                h.keys().asSequence().associateWith { h.getString(it) }
            },
            delay = mockResponse.optLong("delay", 0).takeIf { it > 0 }
        )
        
        return mapOf("success" to true, "mockId" to mockId, "urlPattern" to urlPattern, "activeMocks" to networkMocks.size)
    }
    
    private fun clearNetworkMocks(params: JSONObject): Map<String, Any?> {
        val mockId = params.optString("mockId", null)
        
        return if (mockId != null) {
            val removed = networkMocks.remove(mockId) != null
            mapOf("success" to removed, "mockId" to mockId, "remainingMocks" to networkMocks.size)
        } else {
            val count = networkMocks.size
            networkMocks.clear()
            mapOf("success" to true, "clearedCount" to count, "remainingMocks" to 0)
        }
    }
    
    private fun getTracesMap(params: JSONObject): Map<String, Any?> {
        val filter = TraceFilter(
            name = params.optString("name", null),
            file = params.optString("file", null),
            minDuration = params.optLong("minDuration", -1).takeIf { it >= 0 },
            since = params.optLong("since", -1).takeIf { it >= 0 },
            limit = params.optInt("limit", -1).takeIf { it >= 0 },
            inProgress = if (params.has("inProgress")) params.getBoolean("inProgress") else null
        )
        
        val traces = getTraces(filter)
        val traceMaps = traces.map { entry ->
            mutableMapOf<String, Any?>(
                "id" to entry.id,
                "name" to entry.name,
                "timestamp" to entry.timestamp,
                "completed" to entry.completed,
                "info" to mutableMapOf<String, Any?>().apply {
                    entry.info.args?.let { put("args", it) }
                    entry.info.file?.let { put("file", it) }
                    entry.info.startTime?.let { put("startTime", it) }
                }
            ).apply {
                entry.duration?.let { put("duration", it) }
                entry.error?.let { put("error", it) }
            }
        }
        
        return mapOf(
            "traces" to traceMaps,
            "count" to traceMaps.size,
            "activeCount" to activeTraces.size / 2 // Divide by 2 because we store both id and name keys
        )
    }
    
    private fun JSONObject.toMap(): Map<String, Any?> {
        val map = mutableMapOf<String, Any?>()
        keys().forEach { key ->
            map[key] = when (val value = get(key)) {
                JSONObject.NULL -> null
                is JSONObject -> value.toMap()
                is JSONArray -> value.toList()
                else -> value
            }
        }
        return map
    }
    
    private fun JSONArray.toList(): List<Any?> {
        return (0 until length()).map { i ->
            when (val value = get(i)) {
                JSONObject.NULL -> null
                is JSONObject -> value.toMap()
                is JSONArray -> value.toList()
                else -> value
            }
        }
    }
    
    private fun getAppState(params: JSONObject): Map<String, Any?> {
        // Support both 'path' (from MCP server) and 'key' (legacy)
        val key = params.optString("path", null) ?: params.optString("key", null)
        
        return if (key != null && key.isNotEmpty()) {
            val getter = stateGetters[key]
            if (getter != null) {
                mapOf(key to getter())
            } else {
                emptyMap()
            }
        } else {
            stateGetters.mapValues { (_, getter) ->
                try {
                    getter()
                } catch (e: Exception) {
                    "<error: ${e.message}>"
                }
            }
        }
    }
    
    private fun toggleFeatureFlag(params: JSONObject): Map<String, Any> {
        val key = params.optString("key")
        if (key.isEmpty()) throw Exception("key required")
        
        val current = featureFlags[key] ?: false
        val newValue = if (params.has("value")) params.getBoolean("value") else !current
        featureFlags[key] = newValue
        
        return mapOf("key" to key, "value" to newValue)
    }
    
    private fun getDeviceInfo(): Map<String, Any> {
        return mapOf(
            "platform" to "android",
            "version" to Build.VERSION.SDK_INT,
            "versionName" to Build.VERSION.RELEASE,
            "manufacturer" to Build.MANUFACTURER,
            "model" to Build.MODEL,
            "device" to Build.DEVICE,
            "isEmulator" to isEmulator()
        )
    }
    
    private fun getAppInfo(): Map<String, Any> {
        val context = contextRef?.get() ?: return mapOf("error" to "Context not available")
        val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
        
        return mapOf(
            "name" to context.applicationInfo.loadLabel(context.packageManager).toString(),
            "packageName" to context.packageName,
            "version" to (packageInfo.versionName ?: "1.0.0"),
            "versionCode" to packageInfo.longVersionCode,
            "environment" to "development"
        )
    }
    
    private fun isDebugBuild(context: Context): Boolean {
        return try {
            val appInfo = context.packageManager.getApplicationInfo(context.packageName, 0)
            (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
        } catch (e: Exception) {
            false
        }
    }
    
    private fun isEmulator(): Boolean {
        return (Build.FINGERPRINT.startsWith("generic")
                || Build.FINGERPRINT.startsWith("unknown")
                || Build.MODEL.contains("google_sdk")
                || Build.MODEL.contains("Emulator")
                || Build.MODEL.contains("Android SDK built for x86")
                || Build.MANUFACTURER.contains("Genymotion")
                || Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic")
                || "google_sdk" == Build.PRODUCT)
    }
    
    private fun sendResponse(id: String, result: Any?) {
        val response = JSONObject().apply {
            put("type", "response")
            put("id", id)
            when (result) {
                is Map<*, *> -> put("result", JSONObject(result as Map<String, Any?>))
                is List<*> -> put("result", JSONArray(result))
                else -> put("result", result)
            }
        }
        webSocket?.send(response.toString())
    }
    
    private fun sendError(id: String, message: String) {
        val response = JSONObject().apply {
            put("type", "response")
            put("id", id)
            put("error", message)
        }
        webSocket?.send(response.toString())
    }
    
    private fun log(message: String) {
        Log.i(TAG, message)
        logs.add(mapOf(
            "level" to "info",
            "message" to message,
            "timestamp" to System.currentTimeMillis()
        ))
        // Keep only last 1000 logs
        while (logs.size > 1000) {
            logs.removeAt(0)
        }
    }
}
