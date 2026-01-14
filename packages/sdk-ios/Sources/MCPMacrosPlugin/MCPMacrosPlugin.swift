/**
 * MCP Macros Plugin - Compiler plugin implementation
 *
 * This module implements the Swift macros for automatic function tracing.
 * It uses SwiftSyntax to transform code at compile time.
 */

import SwiftCompilerPlugin
import SwiftSyntax
import SwiftSyntaxBuilder
import SwiftSyntaxMacros

// MARK: - Plugin Registration

@main
struct MCPMacrosPlugin: CompilerPlugin {
    let providingMacros: [Macro.Type] = [
        TracedMacro.self,
        TraceExpressionMacro.self,
        TraceAsyncExpressionMacro.self,
    ]
}

// MARK: - @Traced Macro Implementation

/// Implements the @Traced macro for classes and structs
public struct TracedMacro: MemberMacro, MemberAttributeMacro {
    
    // MemberAttributeMacro: Add attributes to members
    public static func expansion(
        of node: AttributeSyntax,
        attachedTo declaration: some DeclGroupSyntax,
        providingAttributesFor member: some DeclSyntaxProtocol,
        in context: some MacroExpansionContext
    ) throws -> [AttributeSyntax] {
        // We don't add any attributes to members
        return []
    }
    
    // MemberMacro: Add new members to the type
    public static func expansion(
        of node: AttributeSyntax,
        providingMembersOf declaration: some DeclGroupSyntax,
        in context: some MacroExpansionContext
    ) throws -> [DeclSyntax] {
        // Get the type name
        let typeName: String
        if let classDecl = declaration.as(ClassDeclSyntax.self) {
            typeName = classDecl.name.text
        } else if let structDecl = declaration.as(StructDeclSyntax.self) {
            typeName = structDecl.name.text
        } else {
            return []
        }
        
        // Add a static property to store the type name for tracing
        let typeNameMember: DeclSyntax = """
        private static let __mcpTypeName = "\(raw: typeName)"
        """
        
        return [typeNameMember]
    }
}

// MARK: - #trace Expression Macro Implementation

/// Implements the #trace expression macro for inline tracing
public struct TraceExpressionMacro: ExpressionMacro {
    
    public static func expansion(
        of node: some FreestandingMacroExpansionSyntax,
        in context: some MacroExpansionContext
    ) throws -> ExprSyntax {
        guard let nameArg = node.argumentList.first?.expression,
              let bodyArg = node.argumentList.dropFirst().first?.expression else {
            throw MacroError.invalidArguments
        }
        
        return """
        MCPBridge.shared.traceSync(\(nameArg)) { \(bodyArg) }
        """
    }
}

// MARK: - #traceAsync Expression Macro Implementation

/// Implements the #traceAsync expression macro for async inline tracing
public struct TraceAsyncExpressionMacro: ExpressionMacro {
    
    public static func expansion(
        of node: some FreestandingMacroExpansionSyntax,
        in context: some MacroExpansionContext
    ) throws -> ExprSyntax {
        guard let nameArg = node.argumentList.first?.expression,
              let bodyArg = node.argumentList.dropFirst().first?.expression else {
            throw MacroError.invalidArguments
        }
        
        return """
        await MCPBridge.shared.traceAsync(\(nameArg)) { \(bodyArg) }
        """
    }
}

// MARK: - Errors

enum MacroError: Error, CustomStringConvertible {
    case invalidArguments
    case notAFunction
    
    var description: String {
        switch self {
        case .invalidArguments:
            return "Macro requires valid arguments"
        case .notAFunction:
            return "Can only be applied to functions"
        }
    }
}
