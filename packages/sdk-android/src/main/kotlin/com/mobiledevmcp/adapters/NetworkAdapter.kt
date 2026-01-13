/**
 * NetworkAdapter - Full network interception for Android using OkHttp Interceptor
 */

package com.mobiledevmcp.adapters

import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.regex.Pattern

// MARK: - Data Classes

data class CapturedRequest(
    val id: String,
    val url: String,
    val method: String,
    val headers: Map<String, String>,
    val body: String?,
    val timestamp: String,
    var response: CapturedResponse? = null,
    var duration: Long? = null
)

data class CapturedResponse(
    val statusCode: Int,
    val headers: Map<String, String>,
    val body: String?,
    val error: String? = null
)

data class MockConfig(
    val id: String,
    val urlPattern: Pattern,
    val response: MockResponse
)

data class MockResponse(
    val statusCode: Int,
    val headers: Map<String, String>,
    val body: String,
    val delay: Long = 0
)

// MARK: - Network Adapter

class NetworkAdapter {
    
    private val requests = CopyOnWriteArrayList<CapturedRequest>()
    private val mocks = CopyOnWriteArrayList<MockConfig>()
    private val maxRequests = 200
    private var isEnabled = false
    
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    
    // MARK: - OkHttp Interceptor
    
    /**
     * Create an OkHttp Interceptor for network capture and mocking.
     * Add this to your OkHttpClient:
     * 
     * val client = OkHttpClient.Builder()
     *     .addInterceptor(networkAdapter.createInterceptor())
     *     .build()
     */
    fun createInterceptor(): Interceptor = MCPInterceptor(this)
    
    // MARK: - Enable/Disable
    
    fun enable() {
        isEnabled = true
    }
    
    fun disable() {
        isEnabled = false
    }
    
    fun isEnabled(): Boolean = isEnabled
    
    // MARK: - Request Capture
    
    internal fun captureRequest(request: Request): String {
        val id = "req_${System.currentTimeMillis()}_${(Math.random() * 100000).toInt()}"
        
        val headers = mutableMapOf<String, String>()
        request.headers.forEach { (name, value) ->
            headers[name] = value
        }
        
        val body = request.body?.let { body ->
            try {
                val buffer = okio.Buffer()
                body.writeTo(buffer)
                buffer.readUtf8()
            } catch (e: Exception) {
                null
            }
        }
        
        val captured = CapturedRequest(
            id = id,
            url = request.url.toString(),
            method = request.method,
            headers = headers,
            body = body,
            timestamp = dateFormat.format(Date())
        )
        
        requests.add(captured)
        
        // Trim old requests
        while (requests.size > maxRequests) {
            requests.removeAt(0)
        }
        
        return id
    }
    
    internal fun captureResponse(id: String, response: Response, body: String?, duration: Long) {
        val index = requests.indexOfFirst { it.id == id }
        if (index >= 0) {
            val headers = mutableMapOf<String, String>()
            response.headers.forEach { (name, value) ->
                headers[name] = value
            }
            
            requests[index] = requests[index].copy(
                response = CapturedResponse(
                    statusCode = response.code,
                    headers = headers,
                    body = body?.take(10000)?.let { 
                        if (body.length > 10000) "$it... [truncated]" else it 
                    }
                ),
                duration = duration
            )
        }
    }
    
    internal fun captureError(id: String, error: Exception, duration: Long) {
        val index = requests.indexOfFirst { it.id == id }
        if (index >= 0) {
            requests[index] = requests[index].copy(
                response = CapturedResponse(
                    statusCode = 0,
                    headers = emptyMap(),
                    body = null,
                    error = error.message
                ),
                duration = duration
            )
        }
    }
    
    // MARK: - List Requests
    
    fun listRequests(params: Map<String, Any?>): Map<String, Any> {
        val limit = (params["limit"] as? Number)?.toInt() ?: 50
        val filter = params["filter"] as? Map<*, *>
        
        var filtered = requests.toList()
        
        if (filter != null) {
            val urlPattern = filter["url"] as? String
            if (urlPattern != null) {
                val pattern = Pattern.compile(urlPattern)
                filtered = filtered.filter { pattern.matcher(it.url).find() }
            }
            
            val method = filter["method"] as? String
            if (method != null) {
                filtered = filtered.filter { it.method.equals(method, ignoreCase = true) }
            }
            
            val statusCode = (filter["statusCode"] as? Number)?.toInt()
            if (statusCode != null) {
                filtered = filtered.filter { it.response?.statusCode == statusCode }
            }
        }
        
        return mapOf(
            "requests" to filtered.takeLast(limit).map { req ->
                mutableMapOf<String, Any?>(
                    "id" to req.id,
                    "url" to req.url,
                    "method" to req.method,
                    "headers" to req.headers,
                    "body" to req.body,
                    "timestamp" to req.timestamp,
                    "duration" to req.duration,
                    "response" to req.response?.let { resp ->
                        mapOf(
                            "statusCode" to resp.statusCode,
                            "headers" to resp.headers,
                            "body" to resp.body,
                            "error" to resp.error
                        )
                    }
                ).filterValues { it != null }
            },
            "total" to requests.size,
            "filtered" to filtered.size
        )
    }
    
    // MARK: - Mocking
    
    fun mockRequest(params: Map<String, Any?>): Map<String, Any?> {
        val urlPattern = params["urlPattern"] as? String
            ?: return mapOf("error" to "urlPattern is required")
        val mockResponse = params["mockResponse"] as? Map<*, *>
            ?: return mapOf("error" to "mockResponse is required")
        
        val pattern = try {
            Pattern.compile(urlPattern)
        } catch (e: Exception) {
            return mapOf("error" to "Invalid URL pattern: ${e.message}")
        }
        
        val statusCode = (mockResponse["statusCode"] as? Number)?.toInt() ?: 200
        val headers = (mockResponse["headers"] as? Map<*, *>)
            ?.mapKeys { it.key.toString() }
            ?.mapValues { it.value.toString() }
            ?: mapOf("Content-Type" to "application/json")
        val body = when (val b = mockResponse["body"]) {
            is String -> b
            is Map<*, *> -> JSONObject(b).toString()
            is List<*> -> JSONArray(b).toString()
            else -> "{}"
        }
        val delay = (mockResponse["delay"] as? Number)?.toLong() ?: 0
        
        val mockId = "mock_${System.currentTimeMillis()}"
        
        val mock = MockConfig(
            id = mockId,
            urlPattern = pattern,
            response = MockResponse(
                statusCode = statusCode,
                headers = headers,
                body = body,
                delay = delay
            )
        )
        
        mocks.add(mock)
        
        return mapOf(
            "mockId" to mockId,
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
    
    internal fun findMock(url: String): MockConfig? {
        return mocks.find { it.urlPattern.matcher(url).find() }
    }
    
    // MARK: - Replay Request
    
    fun replayRequest(params: Map<String, Any?>): Map<String, Any?> {
        val requestId = params["requestId"] as? String
            ?: return mapOf("error" to "requestId is required")
        
        val request = requests.find { it.id == requestId }
            ?: return mapOf("error" to "Request not found")
        
        return mapOf(
            "message" to "Replay queued",
            "originalRequest" to mapOf(
                "url" to request.url,
                "method" to request.method,
                "headers" to request.headers,
                "body" to request.body
            ),
            "note" to "Use your app's HTTP client to actually replay this request"
        )
    }
}

// MARK: - OkHttp Interceptor Implementation

private class MCPInterceptor(private val adapter: NetworkAdapter) : Interceptor {
    
    @Throws(IOException::class)
    override fun intercept(chain: Interceptor.Chain): Response {
        if (!adapter.isEnabled()) {
            return chain.proceed(chain.request())
        }
        
        val request = chain.request()
        val startTime = System.currentTimeMillis()
        
        // Capture request
        val requestId = adapter.captureRequest(request)
        
        // Check for mocks
        val mock = adapter.findMock(request.url.toString())
        if (mock != null) {
            // Apply delay
            if (mock.response.delay > 0) {
                Thread.sleep(mock.response.delay)
            }
            
            val duration = System.currentTimeMillis() - startTime
            
            // Build mock response
            val responseBuilder = Response.Builder()
                .request(request)
                .protocol(Protocol.HTTP_1_1)
                .code(mock.response.statusCode)
                .message(getStatusMessage(mock.response.statusCode))
                .body(mock.response.body.toResponseBody("application/json".toMediaType()))
            
            mock.response.headers.forEach { (name, value) ->
                responseBuilder.header(name, value)
            }
            
            val response = responseBuilder.build()
            
            adapter.captureResponse(requestId, response, mock.response.body, duration)
            
            return response
        }
        
        // Proceed with actual request
        return try {
            val response = chain.proceed(request)
            val duration = System.currentTimeMillis() - startTime
            
            // Read body (need to buffer it)
            val responseBody = response.body
            val bodyString = responseBody?.string()
            
            adapter.captureResponse(requestId, response, bodyString, duration)
            
            // Rebuild response with new body
            response.newBuilder()
                .body(bodyString?.toResponseBody(responseBody.contentType()))
                .build()
                
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            adapter.captureError(requestId, e, duration)
            throw e
        }
    }
    
    private fun getStatusMessage(code: Int): String = when (code) {
        200 -> "OK"
        201 -> "Created"
        204 -> "No Content"
        400 -> "Bad Request"
        401 -> "Unauthorized"
        403 -> "Forbidden"
        404 -> "Not Found"
        500 -> "Internal Server Error"
        else -> "Unknown"
    }
}
