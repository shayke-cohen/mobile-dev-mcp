/**
 * NetworkAdapter - Handles network interception for Android
 */

package com.mobiledevmcp.adapters

import java.text.SimpleDateFormat
import java.util.*
import java.util.regex.Pattern

data class NetworkRequest(
    val id: String,
    val url: String,
    val method: String,
    val headers: Map<String, String>,
    val body: String?,
    val timestamp: Date,
    var response: NetworkResponse? = null
)

data class NetworkResponse(
    val statusCode: Int,
    val headers: Map<String, String>,
    val body: String?,
    val duration: Long
)

data class MockConfig(
    val id: String,
    val urlPattern: Pattern,
    val response: Map<String, Any?>
)

class NetworkAdapter {
    
    private val requests = mutableListOf<NetworkRequest>()
    private val mocks = mutableListOf<MockConfig>()
    private val maxRequests = 200
    private var isEnabled = false
    
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    
    fun enable() {
        isEnabled = true
        // Note: Full OkHttp interception requires interceptor setup
    }
    
    fun listRequests(params: Map<String, Any?>): Map<String, Any> {
        val limit = (params["limit"] as? Number)?.toInt() ?: 50
        val filter = params["filter"] as? Map<*, *>
        
        var filtered = requests.toList()
        
        filter?.let { f ->
            (f["url"] as? String)?.let { urlPattern ->
                val pattern = Pattern.compile(urlPattern)
                filtered = filtered.filter { pattern.matcher(it.url).find() }
            }
            (f["method"] as? String)?.let { method ->
                filtered = filtered.filter { it.method.equals(method, ignoreCase = true) }
            }
            (f["statusCode"] as? Number)?.toInt()?.let { statusCode ->
                filtered = filtered.filter { it.response?.statusCode == statusCode }
            }
        }
        
        val limitedResults = filtered.takeLast(limit)
        
        return mapOf(
            "requests" to limitedResults.map { request ->
                mutableMapOf<String, Any?>(
                    "id" to request.id,
                    "url" to request.url,
                    "method" to request.method,
                    "headers" to request.headers,
                    "timestamp" to dateFormat.format(request.timestamp)
                ).apply {
                    request.response?.let { response ->
                        this["response"] = mapOf(
                            "statusCode" to response.statusCode,
                            "headers" to response.headers,
                            "duration" to response.duration
                        )
                    }
                }
            },
            "total" to requests.size,
            "filtered" to limitedResults.size
        )
    }
    
    fun mockRequest(params: Map<String, Any?>): Map<String, Any?> {
        val urlPattern = params["urlPattern"] as? String
            ?: return mapOf("error" to "urlPattern is required")
        val mockResponse = params["mockResponse"] as? Map<*, *>
            ?: return mapOf("error" to "mockResponse is required")
        
        val mock = MockConfig(
            id = "mock_${System.currentTimeMillis()}",
            urlPattern = Pattern.compile(urlPattern),
            response = mockResponse.mapKeys { it.key.toString() }.mapValues { it.value }
        )
        
        mocks.add(mock)
        
        return mapOf(
            "mockId" to mock.id,
            "urlPattern" to urlPattern,
            "success" to true
        )
    }
    
    fun clearMocks(params: Map<String, Any?>): Map<String, Any> {
        val mockId = params["mockId"] as? String
        
        if (mockId != null) {
            mocks.removeAll { it.id == mockId }
        } else {
            mocks.clear()
        }
        
        return mapOf(
            "success" to true,
            "remainingMocks" to mocks.size
        )
    }
    
    fun addRequest(request: NetworkRequest) {
        synchronized(requests) {
            requests.add(request)
            if (requests.size > maxRequests) {
                requests.removeAt(0)
            }
        }
    }
    
    fun findMock(url: String): MockConfig? {
        return mocks.find { it.urlPattern.matcher(url).find() }
    }
}
