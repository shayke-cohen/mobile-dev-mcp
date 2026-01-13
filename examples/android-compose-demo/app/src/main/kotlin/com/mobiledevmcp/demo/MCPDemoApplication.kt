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
            // SDK auto-detects emulator vs real device and uses appropriate host
            // Emulator: ws://10.0.2.2:8765 (maps to host's localhost)
            // Real device: ws://localhost:8765 (use `adb reverse tcp:8765 tcp:8765`)
            MCPBridge.initialize(
                context = this,
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
        
        Log.i(TAG, "MCP SDK initialized")
    }
    
    companion object {
        private const val TAG = "MCPDemoApp"
    }
}
