/**
 * MCP Demo Application
 * 
 * Sample Android app demonstrating Mobile Dev MCP SDK integration.
 */

package com.mobiledevmcp.demo

import android.app.Application
import android.util.Log
import com.mobiledevmcp.demo.mcp.MCPBridge

class MCPDemoApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        if (BuildConfig.DEBUG) {
            initializeMCPSDK()
        }
    }
    
    private fun initializeMCPSDK() {
        // Initialize the MCP SDK
        MCPBridge.initialize(
            context = this,
            serverUrl = "ws://localhost:8765",
            debug = true
        )
        
        // Enable features
        MCPBridge.enableLogCapture()
        MCPBridge.enableNetworkInterception()
        
        // Register feature flags
        MCPBridge.registerFeatureFlags(mapOf(
            "dark_mode" to false,
            "new_checkout" to false,
            "show_recommendations" to true
        ))
        
        Log.i(TAG, "MCP SDK initialized, connecting to ws://localhost:8765")
    }
    
    companion object {
        private const val TAG = "MCPDemoApp"
    }
}
