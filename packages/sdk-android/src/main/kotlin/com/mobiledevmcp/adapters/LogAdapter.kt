/**
 * LogAdapter - Handles log capturing for Android
 */

package com.mobiledevmcp.adapters

import java.text.SimpleDateFormat
import java.util.*

data class LogEntry(
    val level: String,
    val message: String,
    val timestamp: Date,
    val tag: String? = null
)

data class ErrorEntry(
    val message: String,
    val stack: String?,
    val timestamp: Date
)

class LogAdapter {
    
    private val logs = mutableListOf<LogEntry>()
    private val errors = mutableListOf<ErrorEntry>()
    private val maxLogs = 500
    private val maxErrors = 50
    private var isEnabled = false
    
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    
    fun enable() {
        isEnabled = true
        setupUncaughtExceptionHandler()
    }
    
    fun addLog(level: String, message: String, tag: String? = null) {
        if (!isEnabled) return
        
        synchronized(logs) {
            logs.add(LogEntry(level, message, Date(), tag))
            if (logs.size > maxLogs) {
                logs.removeAt(0)
            }
        }
    }
    
    fun addError(throwable: Throwable) {
        synchronized(errors) {
            errors.add(ErrorEntry(
                message = throwable.message ?: throwable.javaClass.simpleName,
                stack = throwable.stackTraceToString(),
                timestamp = Date()
            ))
            if (errors.size > maxErrors) {
                errors.removeAt(0)
            }
        }
    }
    
    fun getLogs(params: Map<String, Any?>): Map<String, Any> {
        val limit = (params["limit"] as? Number)?.toInt() ?: 100
        val level = params["level"] as? String
        val filter = params["filter"] as? String
        
        var filtered = logs.toList()
        
        level?.let { minLevel ->
            val levels = listOf("debug", "info", "warn", "error")
            val minIndex = levels.indexOf(minLevel)
            if (minIndex >= 0) {
                filtered = filtered.filter { 
                    levels.indexOf(it.level) >= minIndex 
                }
            }
        }
        
        filter?.let { pattern ->
            val regex = Regex(pattern, RegexOption.IGNORE_CASE)
            filtered = filtered.filter { regex.containsMatchIn(it.message) }
        }
        
        val limitedResults = filtered.takeLast(limit)
        
        return mapOf(
            "logs" to limitedResults.map { log ->
                mapOf(
                    "level" to log.level,
                    "message" to log.message,
                    "tag" to log.tag,
                    "timestamp" to dateFormat.format(log.timestamp)
                )
            },
            "total" to logs.size,
            "filtered" to limitedResults.size
        )
    }
    
    fun getRecentErrors(params: Map<String, Any?>): Map<String, Any> {
        val limit = (params["limit"] as? Number)?.toInt() ?: 10
        
        val limitedResults = errors.takeLast(limit)
        
        return mapOf(
            "errors" to limitedResults.map { error ->
                mapOf(
                    "message" to error.message,
                    "stack" to error.stack,
                    "timestamp" to dateFormat.format(error.timestamp)
                )
            },
            "total" to errors.size
        )
    }
    
    private fun setupUncaughtExceptionHandler() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            addError(throwable)
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }
}
