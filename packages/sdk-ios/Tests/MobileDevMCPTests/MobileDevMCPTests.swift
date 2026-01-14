/**
 * Tests for MobileDevMCP SDK
 */

import XCTest
@testable import MobileDevMCP

final class MobileDevMCPTests: XCTestCase {
    
    func testTraceCreatesEntry() {
        // Given
        let bridge = MCPBridge.shared
        bridge.clearTraces()
        
        // When
        let traceId = bridge.trace("TestFunction", info: TraceInfo(args: ["param": "value"]))
        
        // Then
        XCTAssertFalse(traceId.isEmpty)
        
        // Cleanup
        bridge.traceReturn("TestFunction")
    }
    
    func testTraceReturnCompletesEntry() {
        // Given
        let bridge = MCPBridge.shared
        bridge.clearTraces()
        
        // When
        bridge.trace("TestFunction")
        bridge.traceReturn("TestFunction", returnValue: 42)
        
        // Then
        let traces = bridge.getTraces()
        XCTAssertEqual(traces.count, 1)
        XCTAssertTrue(traces[0].completed)
    }
    
    func testTraceSyncWrapsFunction() {
        // Given
        let bridge = MCPBridge.shared
        bridge.clearTraces()
        
        // When
        let result = bridge.traceSync("addNumbers") {
            return 2 + 2
        }
        
        // Then
        XCTAssertEqual(result, 4)
        let traces = bridge.getTraces()
        XCTAssertEqual(traces.count, 1)
        XCTAssertEqual(traces[0].name, "addNumbers")
    }
    
    func testGetTracesFiltering() {
        // Given
        let bridge = MCPBridge.shared
        bridge.clearTraces()
        
        // Create multiple traces
        bridge.trace("UserService.fetch")
        bridge.traceReturn("UserService.fetch")
        
        bridge.trace("CartService.addItem")
        bridge.traceReturn("CartService.addItem")
        
        bridge.trace("UserService.update")
        bridge.traceReturn("UserService.update")
        
        // When - filter by name
        let userTraces = bridge.getTraces(filter: TraceFilter(name: "UserService"))
        
        // Then
        XCTAssertEqual(userTraces.count, 2)
    }
    
    // MARK: - Dynamic Instrumentation Tests
    
    func testInjectTraceCreatesInjection() {
        // Given
        let bridge = MCPBridge.shared
        _ = bridge.clearInjectedTraces()
        
        // When
        let id = bridge.injectTrace("CartService.*")
        
        // Then
        XCTAssertFalse(id.isEmpty)
        XCTAssertTrue(id.hasPrefix("inject_"))
    }
    
    func testListInjectedTracesReturnsAllInjections() {
        // Given
        let bridge = MCPBridge.shared
        _ = bridge.clearInjectedTraces()
        
        // When
        _ = bridge.injectTrace("CartService.*")
        _ = bridge.injectTrace("UserService.fetch*")
        
        // Then
        let traces = bridge.listInjectedTraces()
        XCTAssertEqual(traces.count, 2)
    }
    
    func testRemoveTraceRemovesInjection() {
        // Given
        let bridge = MCPBridge.shared
        _ = bridge.clearInjectedTraces()
        let id = bridge.injectTrace("CartService.*")
        
        // When
        let removed = bridge.removeTrace(id)
        
        // Then
        XCTAssertTrue(removed)
        XCTAssertEqual(bridge.listInjectedTraces().count, 0)
    }
    
    func testClearInjectedTracesRemovesAll() {
        // Given
        let bridge = MCPBridge.shared
        _ = bridge.clearInjectedTraces()
        _ = bridge.injectTrace("CartService.*")
        _ = bridge.injectTrace("UserService.*")
        _ = bridge.injectTrace("API.*")
        
        // When
        let cleared = bridge.clearInjectedTraces()
        
        // Then
        XCTAssertEqual(cleared, 3)
        XCTAssertEqual(bridge.listInjectedTraces().count, 0)
    }
}
