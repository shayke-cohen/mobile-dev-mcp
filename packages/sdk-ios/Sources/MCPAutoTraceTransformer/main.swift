/**
 * MCP Auto-Trace Transformer
 *
 * Command-line tool that transforms Swift source files to inject trace calls.
 * Used by the MCPAutoTrace build plugin.
 *
 * Usage:
 *   MCPAutoTraceTransformer --output-dir <dir> [--debug-only true] -- file1.swift file2.swift ...
 */

import Foundation
import SwiftSyntax
import SwiftParser

// MARK: - Main Entry Point

@main
struct MCPAutoTraceTransformer {
    static func main() throws {
        let args = Array(CommandLine.arguments.dropFirst())
        
        // Parse arguments
        var outputDir: String?
        var debugOnly = true
        var files: [String] = []
        var parsingFiles = false
        
        var i = 0
        while i < args.count {
            let arg = args[i]
            
            if parsingFiles {
                files.append(arg)
            } else if arg == "--" {
                parsingFiles = true
            } else if arg == "--output-dir" && i + 1 < args.count {
                outputDir = args[i + 1]
                i += 1
            } else if arg == "--debug-only" && i + 1 < args.count {
                debugOnly = args[i + 1].lowercased() == "true"
                i += 1
            }
            
            i += 1
        }
        
        guard let outputDirectory = outputDir else {
            fputs("Error: --output-dir is required\n", stderr)
            exit(1)
        }
        
        // Create output directory
        try FileManager.default.createDirectory(
            atPath: outputDirectory,
            withIntermediateDirectories: true
        )
        
        // Process each file
        for filePath in files {
            do {
                try processFile(
                    inputPath: filePath,
                    outputDirectory: outputDirectory,
                    debugOnly: debugOnly
                )
            } catch {
                fputs("Warning: Failed to process \(filePath): \(error)\n", stderr)
                // Copy original file on error
                let filename = URL(fileURLWithPath: filePath).lastPathComponent
                let outputPath = URL(fileURLWithPath: outputDirectory).appendingPathComponent(filename)
                try? FileManager.default.copyItem(atPath: filePath, toPath: outputPath.path)
            }
        }
    }
    
    static func processFile(inputPath: String, outputDirectory: String, debugOnly: Bool) throws {
        let sourceURL = URL(fileURLWithPath: inputPath)
        let filename = sourceURL.lastPathComponent
        let outputURL = URL(fileURLWithPath: outputDirectory).appendingPathComponent(filename)
        
        // Read source file
        let source = try String(contentsOfFile: inputPath, encoding: .utf8)
        
        // Parse the source
        let sourceFile = Parser.parse(source: source)
        
        // Transform with our rewriter
        let rewriter = TracingRewriter(
            filename: filename,
            debugOnly: debugOnly
        )
        let transformed = rewriter.visit(sourceFile)
        
        // Write output
        var output = ""
        transformed.write(to: &output)
        try output.write(to: outputURL, atomically: true, encoding: .utf8)
    }
}

// MARK: - Syntax Rewriter

/// Rewrites Swift source to inject trace calls at function entry/exit
class TracingRewriter: SyntaxRewriter {
    let filename: String
    let debugOnly: Bool
    var currentClassName: String?
    var currentStructName: String?
    
    init(filename: String, debugOnly: Bool) {
        self.filename = filename
        self.debugOnly = debugOnly
        super.init()
    }
    
    // MARK: - Class/Struct Tracking
    
    override func visit(_ node: ClassDeclSyntax) -> DeclSyntax {
        let previousClass = currentClassName
        currentClassName = node.name.text
        let result = super.visit(node)
        currentClassName = previousClass
        return result
    }
    
    override func visit(_ node: StructDeclSyntax) -> DeclSyntax {
        let previousStruct = currentStructName
        currentStructName = node.name.text
        let result = super.visit(node)
        currentStructName = previousStruct
        return result
    }
    
    // MARK: - Function Transformation
    
    override func visit(_ node: FunctionDeclSyntax) -> DeclSyntax {
        // Skip functions without bodies
        guard let body = node.body else {
            return DeclSyntax(node)
        }
        
        // Skip private/fileprivate functions (usually helpers)
        let modifiers = node.modifiers.map { $0.name.text }
        if modifiers.contains("private") || modifiers.contains("fileprivate") {
            return DeclSyntax(node)
        }
        
        // Skip very short functions (likely getters/setters)
        if body.statements.count < 2 {
            return DeclSyntax(node)
        }
        
        // Build function name
        let funcName = buildFunctionName(node.name.text)
        
        // Check if async/throws
        let isAsync = node.signature.effectSpecifiers?.asyncSpecifier != nil
        let isThrows = node.signature.effectSpecifiers?.throwsSpecifier != nil
        
        // Build parameter info for trace
        let params = node.signature.parameterClause.parameters.map { param -> String in
            let name = param.secondName?.text ?? param.firstName.text
            return "\"\(name)\": \\(\(name))"
        }
        let paramsString = params.isEmpty ? "[:]" : "[\(params.joined(separator: ", "))]"
        
        // Create trace entry call
        let traceEntry = createTraceEntry(funcName: funcName, params: paramsString)
        
        // Create trace exit call
        let traceExit = createTraceExit(funcName: funcName)
        
        // Wrap body with trace calls
        let newBody = wrapBody(
            original: body,
            traceEntry: traceEntry,
            traceExit: traceExit,
            isAsync: isAsync,
            isThrows: isThrows
        )
        
        return DeclSyntax(node.with(\.body, newBody))
    }
    
    // MARK: - Helpers
    
    private func buildFunctionName(_ baseName: String) -> String {
        if let className = currentClassName {
            return "\(className).\(baseName)"
        } else if let structName = currentStructName {
            return "\(structName).\(baseName)"
        }
        return baseName
    }
    
    private func createTraceEntry(funcName: String, params: String) -> String {
        if debugOnly {
            return """
            #if DEBUG
            MCPBridge.shared.trace("\(funcName)", info: TraceInfo(args: \(params), file: "\(filename)"))
            #endif
            """
        } else {
            return """
            MCPBridge.shared.trace("\(funcName)", info: TraceInfo(args: \(params), file: "\(filename)"))
            """
        }
    }
    
    private func createTraceExit(funcName: String) -> String {
        if debugOnly {
            return """
            #if DEBUG
            MCPBridge.shared.traceReturn("\(funcName)")
            #endif
            """
        } else {
            return """
            MCPBridge.shared.traceReturn("\(funcName)")
            """
        }
    }
    
    private func wrapBody(
        original: CodeBlockSyntax,
        traceEntry: String,
        traceExit: String,
        isAsync: Bool,
        isThrows: Bool
    ) -> CodeBlockSyntax {
        // Parse trace statements
        let entryStmt = Parser.parse(source: traceEntry + "\n").statements
        let exitStmt = Parser.parse(source: traceExit + "\n").statements
        
        // Build new statements
        var newStatements: [CodeBlockItemSyntax] = []
        
        // Add trace entry
        for stmt in entryStmt {
            newStatements.append(CodeBlockItemSyntax(item: stmt.item))
        }
        
        // Add defer for trace exit (ensures it runs on all paths)
        let deferBlock = """
        defer {
            \(traceExit)
        }
        """
        let deferStmt = Parser.parse(source: deferBlock + "\n").statements
        for stmt in deferStmt {
            newStatements.append(CodeBlockItemSyntax(item: stmt.item))
        }
        
        // Add original statements
        for stmt in original.statements {
            newStatements.append(stmt)
        }
        
        return CodeBlockSyntax(
            leftBrace: original.leftBrace,
            statements: CodeBlockItemListSyntax(newStatements),
            rightBrace: original.rightBrace
        )
    }
}
