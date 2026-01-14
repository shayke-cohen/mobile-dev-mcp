/**
 * MCP Macros - Swift macros for automatic function tracing
 *
 * Usage:
 * ```swift
 * import MCPMacros
 *
 * @Traced
 * class UserService {
 *     func fetchUser(id: String) async throws -> User {
 *         // Your implementation - automatically traced
 *     }
 * }
 * ```
 *
 * Or use expression macros for specific blocks:
 * ```swift
 * let result = #trace("calculateDiscount", {
 *     price * discountRate
 * })
 * ```
 */

import MobileDevMCP

// MARK: - @Traced Macro

/// Automatically adds tracing to all methods in a class or struct.
/// Can be applied to classes or structs.
///
/// The macro generates helper code that traces method execution:
/// - Calls `MCPBridge.shared.trace()` at function entry
/// - Calls `MCPBridge.shared.traceReturn()` at function exit
/// - Captures arguments, timing, and errors
/// - Only active in DEBUG builds
///
/// Example:
/// ```swift
/// @Traced
/// class CartService {
///     func addItem(_ item: Item) {
///         cart.append(item)
///     }
/// }
/// ```
@attached(member, names: arbitrary)
@attached(memberAttribute)
public macro Traced() = #externalMacro(module: "MCPMacrosPlugin", type: "TracedMacro")

// MARK: - #trace Expression Macro

/// Inline trace for specific code blocks.
/// Wraps a closure with tracing calls.
///
/// Example:
/// ```swift
/// let result = #trace("calculateDiscount", { price * discountRate })
/// ```
@freestanding(expression)
public macro trace<T>(_ name: String, _ body: @autoclosure () -> T) -> T = #externalMacro(module: "MCPMacrosPlugin", type: "TraceExpressionMacro")

// MARK: - #traceAsync Expression Macro

/// Async version of #trace for async code blocks.
///
/// Example:
/// ```swift
/// let user = #traceAsync("fetchUser", { try await api.getUser(id) })
/// ```
@freestanding(expression)
public macro traceAsync<T>(_ name: String, _ body: @autoclosure () -> T) -> T = #externalMacro(module: "MCPMacrosPlugin", type: "TraceAsyncExpressionMacro")
