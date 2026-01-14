/**
 * MCP Bridge - Android SDK (Inline Version)
 * 
 * This is a standalone version of the MCP SDK for the demo app.
 * In production, you would add the MobileDevMCP dependency.
 */

package com.mobiledevmcp.demo.mcp

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
                    put("capabilities", org.json.JSONArray(listOf("state", "logs", "network", "featureFlags")))
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
        val key = params.optString("key", null)
        
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
