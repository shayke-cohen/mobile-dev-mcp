/**
 * Android SDK Tracing Tests
 * 
 * Tests for the tracing functionality in MCPBridge
 */
package com.mobiledevmcp

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Mock implementation for testing tracing logic
 * (Actual MCPBridge requires Android context)
 */
class MockTracingBridge {
    
    data class TraceEntry(
        val id: String,
        val name: String,
        val info: Map<String, Any?> = emptyMap(),
        val timestamp: Long = System.currentTimeMillis(),
        var duration: Long? = null,
        var returnValue: Any? = null,
        var error: String? = null,
        var completed: Boolean = false
    )
    
    data class InjectedTrace(
        val id: String,
        val pattern: Regex,
        val logArgs: Boolean = true,
        val logReturn: Boolean = true,
        var active: Boolean = true
    )
    
    private val activeTraces = mutableMapOf<String, TraceEntry>()
    private val traceHistory = mutableListOf<TraceEntry>()
    private var traceIdCounter = 0
    private val injectedTraces = mutableMapOf<String, InjectedTrace>()
    
    fun trace(name: String, info: Map<String, Any?> = emptyMap()): String {
        val id = "trace_${++traceIdCounter}"
        val entry = TraceEntry(
            id = id,
            name = name,
            info = info,
            timestamp = System.currentTimeMillis()
        )
        activeTraces[name] = entry
        return id
    }
    
    fun traceReturn(name: String, returnValue: Any? = null, error: String? = null) {
        val entry = activeTraces[name] ?: return
        entry.completed = true
        entry.duration = System.currentTimeMillis() - entry.timestamp
        entry.returnValue = returnValue
        entry.error = error
        traceHistory.add(entry.copy())
        activeTraces.remove(name)
    }
    
    fun <T> traceSync(name: String, block: () -> T): T {
        trace(name)
        return try {
            val result = block()
            traceReturn(name, result)
            result
        } catch (e: Exception) {
            traceReturn(name, error = e.message)
            throw e
        }
    }
    
    suspend fun <T> traceAsync(name: String, block: suspend () -> T): T {
        trace(name)
        return try {
            val result = block()
            traceReturn(name, result)
            result
        } catch (e: Exception) {
            traceReturn(name, error = e.message)
            throw e
        }
    }
    
    fun getTraces(filter: Map<String, Any?> = emptyMap()): List<TraceEntry> {
        var traces = traceHistory.toList()
        
        filter["name"]?.let { name ->
            traces = traces.filter { it.name.contains(name.toString()) }
        }
        
        filter["minDuration"]?.let { minDuration ->
            val min = (minDuration as Number).toLong()
            traces = traces.filter { (it.duration ?: 0) >= min }
        }
        
        filter["limit"]?.let { limit ->
            traces = traces.takeLast((limit as Number).toInt())
        }
        
        return traces
    }
    
    fun clearTraces() {
        activeTraces.clear()
        traceHistory.clear()
    }
    
    fun injectTrace(pattern: String, logArgs: Boolean = true, logReturn: Boolean = true): String {
        val id = "inject_${System.currentTimeMillis()}_${(1000..9999).random()}"
        val regexPattern = pattern
            .replace(".", "\\.")
            .replace("*", ".*")
        
        injectedTraces[id] = InjectedTrace(
            id = id,
            pattern = Regex("^$regexPattern$"),
            logArgs = logArgs,
            logReturn = logReturn
        )
        
        return id
    }
    
    fun removeTrace(id: String): Boolean {
        return injectedTraces.remove(id) != null
    }
    
    fun clearInjectedTraces(): Int {
        val count = injectedTraces.size
        injectedTraces.clear()
        return count
    }
    
    fun listInjectedTraces(): List<Map<String, Any?>> {
        return injectedTraces.values.map { trace ->
            mapOf(
                "id" to trace.id,
                "pattern" to trace.pattern.pattern,
                "active" to trace.active
            )
        }
    }
}

class TracingTest {
    
    private lateinit var bridge: MockTracingBridge
    
    @Before
    fun setUp() {
        bridge = MockTracingBridge()
    }
    
    // ==================== Basic Tracing Tests ====================
    
    @Test
    fun `trace creates entry with id`() {
        val id = bridge.trace("TestFunction", mapOf("arg" to 1))
        
        assertNotNull(id)
        assertTrue(id.startsWith("trace_"))
    }
    
    @Test
    fun `traceReturn completes trace`() {
        bridge.trace("TestFunction")
        bridge.traceReturn("TestFunction", returnValue = 42)
        
        val traces = bridge.getTraces()
        assertEquals(1, traces.size)
        assertEquals("TestFunction", traces[0].name)
        assertTrue(traces[0].completed)
        assertEquals(42, traces[0].returnValue)
    }
    
    @Test
    fun `traceReturn captures error`() {
        bridge.trace("FailingFunction")
        bridge.traceReturn("FailingFunction", error = "Something went wrong")
        
        val traces = bridge.getTraces()
        assertEquals("Something went wrong", traces[0].error)
    }
    
    @Test
    fun `trace tracks duration`() {
        bridge.trace("SlowFunction")
        Thread.sleep(10)
        bridge.traceReturn("SlowFunction")
        
        val traces = bridge.getTraces()
        assertNotNull(traces[0].duration)
        assertTrue(traces[0].duration!! >= 0)
    }
    
    // ==================== traceSync Tests ====================
    
    @Test
    fun `traceSync wraps function and returns result`() {
        val result = bridge.traceSync("addNumbers") { 2 + 2 }
        
        assertEquals(4, result)
        val traces = bridge.getTraces()
        assertEquals(1, traces.size)
        assertEquals("addNumbers", traces[0].name)
        assertEquals(4, traces[0].returnValue)
    }
    
    @Test
    fun `traceSync captures exception`() {
        try {
            bridge.traceSync("failingFunction") {
                throw RuntimeException("Test error")
            }
            fail("Should have thrown exception")
        } catch (e: RuntimeException) {
            assertEquals("Test error", e.message)
        }
        
        val traces = bridge.getTraces()
        assertEquals("Test error", traces[0].error)
    }
    
    // ==================== Filtering Tests ====================
    
    @Test
    fun `getTraces filters by name`() {
        bridge.traceSync("UserService.fetchUser") { mapOf("id" to 1) }
        bridge.traceSync("UserService.updateUser") { true }
        bridge.traceSync("CartService.addItem") { mapOf("count" to 1) }
        
        val traces = bridge.getTraces(mapOf("name" to "UserService"))
        assertEquals(2, traces.size)
    }
    
    @Test
    fun `getTraces limits results`() {
        repeat(5) { i ->
            bridge.traceSync("Function$i") { i }
        }
        
        val traces = bridge.getTraces(mapOf("limit" to 3))
        assertEquals(3, traces.size)
    }
    
    @Test
    fun `clearTraces removes all traces`() {
        bridge.traceSync("Function1") { 1 }
        bridge.traceSync("Function2") { 2 }
        
        bridge.clearTraces()
        
        val traces = bridge.getTraces()
        assertEquals(0, traces.size)
    }
    
    // ==================== Dynamic Instrumentation Tests ====================
    
    @Test
    fun `injectTrace creates injection with pattern`() {
        val id = bridge.injectTrace("CartService.*")
        
        assertNotNull(id)
        assertTrue(id.startsWith("inject_"))
    }
    
    @Test
    fun `listInjectedTraces returns all injections`() {
        bridge.injectTrace("CartService.*")
        bridge.injectTrace("UserService.fetch*")
        
        val traces = bridge.listInjectedTraces()
        assertEquals(2, traces.size)
    }
    
    @Test
    fun `removeTrace removes injection by id`() {
        val id = bridge.injectTrace("CartService.*")
        assertEquals(1, bridge.listInjectedTraces().size)
        
        val removed = bridge.removeTrace(id)
        assertTrue(removed)
        assertEquals(0, bridge.listInjectedTraces().size)
    }
    
    @Test
    fun `removeTrace returns false for unknown id`() {
        val removed = bridge.removeTrace("unknown_id")
        assertFalse(removed)
    }
    
    @Test
    fun `clearInjectedTraces removes all injections`() {
        bridge.injectTrace("CartService.*")
        bridge.injectTrace("UserService.*")
        bridge.injectTrace("API.*")
        
        val cleared = bridge.clearInjectedTraces()
        assertEquals(3, cleared)
        assertEquals(0, bridge.listInjectedTraces().size)
    }
    
    @Test
    fun `injectTrace converts wildcard to regex`() {
        bridge.injectTrace("Cart*.add*")
        
        val traces = bridge.listInjectedTraces()
        val pattern = traces[0]["pattern"] as String
        assertTrue(pattern.contains("Cart.*"))
        assertTrue(pattern.contains("add.*"))
    }
}
