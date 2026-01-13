/**
 * WebSocket client for Android
 */

package com.mobiledevmcp.connection

import android.os.Build
import android.util.Log
import com.mobiledevmcp.MCPCommand
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class WebSocketClient(
    private val url: String,
    private val onCommand: suspend (MCPCommand) -> Any?
) {
    
    private val TAG = "MCP WebSocket"
    
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
    
    private var webSocket: WebSocket? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    var isConnected = false
        private set
    
    fun connect() {
        val request = Request.Builder()
            .url(url)
            .build()
        
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "Connected to server")
                isConnected = true
                sendHandshake()
            }
            
            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }
            
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "Disconnected: $code $reason")
                isConnected = false
                scheduleReconnect()
            }
            
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "Connection failed: ${t.message}")
                isConnected = false
                scheduleReconnect()
            }
        })
    }
    
    fun disconnect() {
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
        isConnected = false
        scope.cancel()
    }
    
    private fun sendHandshake() {
        val handshake = JSONObject().apply {
            put("type", "handshake")
            put("platform", "android")
            put("osVersion", Build.VERSION.SDK_INT)
            put("appName", "Unknown") // Would come from context
            put("appVersion", "0.0.0")
            put("capabilities", listOf("state", "network", "logs", "ui", "screenshot"))
        }
        send(handshake.toString())
    }
    
    private fun handleMessage(text: String) {
        try {
            val json = JSONObject(text)
            
            // Handle handshake acknowledgment
            if (json.optString("type") == "handshake_ack") {
                Log.d(TAG, "Handshake acknowledged")
                return
            }
            
            // Handle command
            val id = json.optString("id")
            val method = json.optString("method")
            
            if (id.isNotEmpty() && method.isNotEmpty()) {
                val paramsJson = json.optJSONObject("params") ?: JSONObject()
                val params = jsonObjectToMap(paramsJson)
                
                val command = MCPCommand(id, method, params)
                
                scope.launch {
                    try {
                        val result = onCommand(command)
                        sendResponse(id, result)
                    } catch (e: Exception) {
                        sendError(id, e.message ?: "Unknown error")
                    }
                }
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse message: ${e.message}")
        }
    }
    
    private fun sendResponse(id: String, result: Any?) {
        val response = JSONObject().apply {
            put("jsonrpc", "2.0")
            put("id", id)
            put("result", when (result) {
                is Map<*, *> -> JSONObject(result as Map<String, Any?>)
                else -> result
            })
        }
        send(response.toString())
    }
    
    private fun sendError(id: String, message: String) {
        val response = JSONObject().apply {
            put("jsonrpc", "2.0")
            put("id", id)
            put("error", JSONObject().apply {
                put("code", -32000)
                put("message", message)
            })
        }
        send(response.toString())
    }
    
    private fun send(text: String) {
        webSocket?.send(text)
    }
    
    private fun scheduleReconnect() {
        scope.launch {
            delay(3000)
            if (!isConnected) {
                Log.i(TAG, "Attempting reconnection...")
                connect()
            }
        }
    }
    
    private fun jsonObjectToMap(json: JSONObject): Map<String, Any?> {
        val map = mutableMapOf<String, Any?>()
        json.keys().forEach { key ->
            map[key] = when (val value = json.get(key)) {
                is JSONObject -> jsonObjectToMap(value)
                JSONObject.NULL -> null
                else -> value
            }
        }
        return map
    }
}
