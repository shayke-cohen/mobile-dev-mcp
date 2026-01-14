/**
 * MCP Annotations for Android auto-instrumentation
 */
package com.mobiledevmcp.annotations

/**
 * Marks a class or function for automatic tracing.
 * 
 * When applied to a class, all public methods are traced.
 * When applied to a function, only that function is traced.
 * 
 * Tracing is only active in DEBUG builds.
 * 
 * Example:
 * ```kotlin
 * @Traced
 * class UserService {
 *     suspend fun fetchUser(id: String): User {
 *         // Implementation - automatically traced
 *     }
 * }
 * ```
 * 
 * Or for individual functions:
 * ```kotlin
 * @Traced
 * fun calculateTotal(items: List<Item>): Double {
 *     return items.sumOf { it.price }
 * }
 * ```
 */
@Target(AnnotationTarget.CLASS, AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.SOURCE)
annotation class Traced(
    /**
     * Optional name override for the trace.
     * If not specified, uses the class/function name.
     */
    val name: String = "",
    
    /**
     * Whether to include function arguments in the trace.
     * Default is true.
     */
    val includeArgs: Boolean = true,
    
    /**
     * Whether to include return value in the trace.
     * Default is true.
     */
    val includeReturn: Boolean = true
)

/**
 * Excludes a specific method from tracing when @Traced is applied to a class.
 * 
 * Example:
 * ```kotlin
 * @Traced
 * class UserService {
 *     fun fetchUser(id: String): User { ... } // Will be traced
 *     
 *     @TraceExclude
 *     fun internalHelper(): String { ... } // Won't be traced
 * }
 * ```
 */
@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.SOURCE)
annotation class TraceExclude
