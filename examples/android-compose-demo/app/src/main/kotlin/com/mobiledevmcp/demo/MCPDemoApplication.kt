/**
 * MCP Demo Application
 * 
 * Sample Android app demonstrating Mobile Dev MCP SDK integration.
 */

package com.mobiledevmcp.demo

import android.app.Application
import android.util.Log

class MCPDemoApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        if (BuildConfig.DEBUG) {
            initializeMCPSDK()
        }
    }
    
    private fun initializeMCPSDK() {
        // MCP SDK initialization would go here
        // MCPBridge.initialize(context = this, serverUrl = "ws://localhost:8765")
        
        Log.i(TAG, "MCP SDK would be initialized here (connect to ws://localhost:8765)")
        Log.i(TAG, "To enable: Add sdk-android dependency and uncomment initialization")
        
        // Example of what would be exposed:
        // MCPBridge.exposeState("user") { AppState.currentUser }
        // MCPBridge.exposeState("cart") { AppState.cart }
        // MCPBridge.enableNetworkInterception()
        // MCPBridge.registerFeatureFlags(mapOf("dark_mode" to false, "new_checkout" to false))
    }
    
    companion object {
        private const val TAG = "MCPDemoApp"
    }
}
