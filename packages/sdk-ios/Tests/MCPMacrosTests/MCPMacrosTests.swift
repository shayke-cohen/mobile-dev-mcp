/**
 * Tests for MCP Macros
 */

import SwiftSyntaxMacros
import SwiftSyntaxMacrosTestSupport
import XCTest

#if canImport(MCPMacrosPlugin)
import MCPMacrosPlugin

let testMacros: [String: Macro.Type] = [
    "Traced": TracedMacro.self,
    "trace": TraceExpressionMacro.self,
    "traceAsync": TraceAsyncExpressionMacro.self,
]
#endif

final class MCPMacrosTests: XCTestCase {
    
    func testTracedMacroAddsTypeName() throws {
        #if canImport(MCPMacrosPlugin)
        assertMacroExpansion(
            """
            @Traced
            class UserService {
                func fetchUser(id: String) -> User {
                    return User(id: id)
                }
            }
            """,
            expandedSource: """
            class UserService {
                func fetchUser(id: String) -> User {
                    return User(id: id)
                }

                private static let __mcpTypeName = "UserService"
            }
            """,
            macros: testMacros
        )
        #else
        throw XCTSkip("macros are only supported when running tests for the host platform")
        #endif
    }
    
    func testTraceExpressionMacro() throws {
        #if canImport(MCPMacrosPlugin)
        assertMacroExpansion(
            """
            let total = #trace("calculateDiscount", price * discountRate)
            """,
            expandedSource: """
            let total = MCPBridge.shared.traceSync("calculateDiscount") {
                price * discountRate
            }
            """,
            macros: testMacros
        )
        #else
        throw XCTSkip("macros are only supported when running tests for the host platform")
        #endif
    }
    
    func testTraceAsyncExpressionMacro() throws {
        #if canImport(MCPMacrosPlugin)
        assertMacroExpansion(
            """
            let user = #traceAsync("fetchUser", try await api.getUser(id))
            """,
            expandedSource: """
            let user = await MCPBridge.shared.traceAsync("fetchUser") {
                try await api.getUser(id)
            }
            """,
            macros: testMacros
        )
        #else
        throw XCTSkip("macros are only supported when running tests for the host platform")
        #endif
    }
}
