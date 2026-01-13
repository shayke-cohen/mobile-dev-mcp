/**
 * StateAdapter - Handles state inspection for Android
 */

package com.mobiledevmcp.adapters

import android.content.Context
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.*

class StateAdapter {
    
    private val stateGetters = mutableMapOf<String, () -> Any?>()
    private val featureFlags = mutableMapOf<String, Boolean>()
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    
    fun register(key: String, getter: () -> Any?) {
        stateGetters[key] = getter
    }
    
    fun registerFeatureFlags(flags: Map<String, Boolean>) {
        featureFlags.putAll(flags)
    }
    
    fun getState(params: Map<String, Any?>): Map<String, Any?> {
        val path = params["path"] as? String
        
        if (path != null) {
            val parts = path.split(".")
            val rootKey = parts.firstOrNull() ?: return mapOf("error" to "Invalid path")
            val getter = stateGetters[rootKey] ?: return mapOf("error" to "State '$rootKey' not exposed")
            
            var value: Any? = getter()
            
            // Navigate to nested path
            for (i in 1 until parts.size) {
                value = when (value) {
                    is Map<*, *> -> value[parts[i]]
                    else -> null
                }
            }
            
            return mapOf(
                "path" to path,
                "value" to value,
                "timestamp" to dateFormat.format(Date())
            )
        }
        
        // Return all exposed state
        val allState = mutableMapOf<String, Any?>()
        stateGetters.forEach { (key, getter) ->
            allState[key] = try {
                getter()
            } catch (e: Exception) {
                "<Error: ${e.message}>"
            }
        }
        
        return mapOf(
            "state" to allState,
            "exposedKeys" to stateGetters.keys.toList(),
            "timestamp" to dateFormat.format(Date())
        )
    }
    
    fun queryStorage(params: Map<String, Any?>): Map<String, Any?> {
        // SharedPreferences inspection
        // Note: Would need context reference for full implementation
        return mapOf(
            "message" to "Storage inspection requires additional setup",
            "timestamp" to dateFormat.format(Date())
        )
    }
    
    fun getNavigationState(): Map<String, Any?> {
        return mapOf(
            "message" to "Navigation state inspection requires setting up navigation ref",
            "timestamp" to dateFormat.format(Date())
        )
    }
    
    fun getFeatureFlags(): Map<String, Any> {
        return mapOf(
            "flags" to featureFlags.toMap(),
            "count" to featureFlags.size
        )
    }
    
    fun toggleFeatureFlag(params: Map<String, Any?>): Map<String, Any?> {
        val flagName = params["flagName"] as? String
            ?: return mapOf("error" to "flagName is required")
        val enabled = params["enabled"] as? Boolean
            ?: return mapOf("error" to "enabled is required")
        
        if (!featureFlags.containsKey(flagName)) {
            return mapOf("error" to "Feature flag '$flagName' not registered")
        }
        
        val previousValue = featureFlags[flagName]
        featureFlags[flagName] = enabled
        
        return mapOf(
            "flagName" to flagName,
            "enabled" to enabled,
            "previousValue" to previousValue,
            "success" to true
        )
    }
}
