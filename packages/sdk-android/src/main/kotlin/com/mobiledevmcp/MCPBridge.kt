/**
 * MobileDevMCP - Android SDK
 *
 * Enables AI-assisted development by connecting your Android app to Cursor IDE.
 *
 * Usage:
 * ```kotlin
 * class MainApplication : Application() {
 *     override fun onCreate() {
 *         super.onCreate()
 *         
 *         if (BuildConfig.DEBUG) {
 *             MCPBridge.initialize(context = this, serverUrl = "ws://localhost:8765")
 *             MCPBridge.exposeState("user") { UserViewModel.currentUser.value }
 *         }
 *     }
 * }
 * ```
 */

package com.mobiledevmcp

import android.app.Application
import android.content.Context
import android.os.Build
import android.util.Log
import com.mobiledevmcp.adapters.*
import com.mobiledevmcp.connection.WebSocketClient
import kotlinx.coroutines.*
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * Main SDK class for Android MCP integration
 */
object MCPBridge {
    
    private const val TAG = "MCP SDK"
    
    private var wsClient: WebSocketClient? = null
    private var contextRef: WeakReference<Context>? = null
    private val stateAdapter = StateAdapter()
    private val networkAdapter = NetworkAdapter()
    private val uiAdapter = UIAdapter()
    private val logAdapter = LogAdapter()
    
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var isInitialized = false
    
    /**
     * Initialize the MCP SDK
     * 
     * @param context Application context
     * @param serverUrl WebSocket server URL (default: ws://localhost:8765)
     */
    fun initialize(
        context: Context,
        serverUrl: String = "ws://localhost:8765"
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
        uiAdapter.setContext(context)
        
        wsClient = WebSocketClient(
            url = serverUrl,
            onCommand = { command -> handleCommand(command) }
        )
        wsClient?.connect()
        
        isInitialized = true
        Log.i(TAG, "Initialized, connecting to $serverUrl")
    }
    
    /**
     * Handle incoming command from MCP server
     */
    private suspend fun handleCommand(command: MCPCommand): Any? {
        Log.d(TAG, "Received command: ${command.method}")
        
        return when (command.method) {
            // State tools
            "get_app_state" -> stateAdapter.getState(command.params)
            "query_storage" -> stateAdapter.queryStorage(command.params)
            "get_navigation_state" -> stateAdapter.getNavigationState()
            "list_feature_flags" -> stateAdapter.getFeatureFlags()
            "toggle_feature_flag" -> stateAdapter.toggleFeatureFlag(command.params)
            
            // Network tools
            "list_network_requests" -> networkAdapter.listRequests(command.params)
            "mock_network_request" -> networkAdapter.mockRequest(command.params)
            "clear_network_mocks" -> networkAdapter.clearMocks(command.params)
            
            // UI tools
            "capture_screenshot" -> uiAdapter.captureScreenshot()
            "get_layout_tree" -> uiAdapter.getViewHierarchy()
            
            // Log tools
            "get_logs" -> logAdapter.getLogs(command.params)
            "get_recent_errors" -> logAdapter.getRecentErrors(command.params)
            
            // Device tools
            "get_device_info" -> getDeviceInfo()
            "get_app_info" -> getAppInfo()
            
            else -> throw MCPException("Unknown method: ${command.method}")
        }
    }
    
    // ==================== Public API ====================
    
    /**
     * Expose state for inspection
     * 
     * @param key Unique key for this state
     * @param getter Lambda that returns the current state
     */
    fun exposeState(key: String, getter: () -> Any?) {
        stateAdapter.register(key, getter)
        Log.d(TAG, "Exposed state: $key")
    }
    
    /**
     * Enable network request interception
     */
    fun enableNetworkInterception() {
        networkAdapter.enable()
        Log.i(TAG, "Network interception enabled")
    }
    
    /**
     * Enable log capturing
     */
    fun enableLogCapture() {
        logAdapter.enable()
        Log.i(TAG, "Log capture enabled")
    }
    
    /**
     * Register feature flags
     */
    fun registerFeatureFlags(flags: Map<String, Boolean>) {
        stateAdapter.registerFeatureFlags(flags)
        Log.i(TAG, "Registered ${flags.size} feature flags")
    }
    
    /**
     * Check if connected to MCP server
     */
    val isConnected: Boolean
        get() = wsClient?.isConnected ?: false
    
    /**
     * Disconnect from MCP server
     */
    fun disconnect() {
        wsClient?.disconnect()
    }
    
    // ==================== Private Helpers ====================
    
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
            "name" to (context.applicationInfo.loadLabel(context.packageManager).toString()),
            "packageName" to context.packageName,
            "version" to packageInfo.versionName,
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
}

/**
 * MCP Command data class
 */
data class MCPCommand(
    val id: String,
    val method: String,
    val params: Map<String, Any?>
)

/**
 * MCP Exception class
 */
class MCPException(message: String) : Exception(message)
