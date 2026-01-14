/**
 * MCP Auto-Trace Build Tool Plugin
 *
 * This plugin automatically instruments Swift source files with trace calls
 * for debugging with Mobile Dev MCP. No code changes required.
 *
 * Usage in Package.swift:
 *   .target(
 *       name: "MyApp",
 *       dependencies: ["MobileDevMCP"],
 *       plugins: [.plugin(name: "MCPAutoTrace", package: "MobileDevMCP")]
 *   )
 */

import PackagePlugin
import Foundation

@main
struct MCPAutoTracePlugin: BuildToolPlugin {
    
    func createBuildCommands(context: PluginContext, target: Target) async throws -> [Command] {
        // Only process Swift source targets
        guard let sourceTarget = target as? SourceModuleTarget else {
            return []
        }
        
        // Get the transformer tool
        let transformer = try context.tool(named: "MCPAutoTraceTransformer")
        
        // Create output directory for transformed files
        let outputDir = context.pluginWorkDirectory.appending("TracedSources")
        
        // Collect Swift source files
        let swiftFiles = sourceTarget.sourceFiles.filter { $0.path.extension == "swift" }
        
        // Skip if no Swift files
        guard !swiftFiles.isEmpty else {
            return []
        }
        
        // Create a single command that transforms all files
        var inputFiles: [Path] = []
        var outputFiles: [Path] = []
        var arguments: [String] = [
            "--output-dir", outputDir.string,
            "--debug-only", "true",  // Only trace in DEBUG builds
            "--"
        ]
        
        for file in swiftFiles {
            // Skip test files and generated files
            let filename = file.path.lastComponent
            if filename.hasSuffix("Tests.swift") || 
               filename.hasSuffix(".generated.swift") ||
               file.path.string.contains("/.build/") {
                continue
            }
            
            inputFiles.append(file.path)
            arguments.append(file.path.string)
            
            // Output file mirrors input structure
            let outputFile = outputDir.appending(filename)
            outputFiles.append(outputFile)
        }
        
        // Skip if all files were filtered out
        guard !inputFiles.isEmpty else {
            return []
        }
        
        return [
            .prebuildCommand(
                displayName: "MCP Auto-Trace: Instrumenting \(inputFiles.count) Swift files",
                executable: transformer.path,
                arguments: arguments,
                outputFilesDirectory: outputDir
            )
        ]
    }
}

#if canImport(XcodeProjectPlugin)
import XcodeProjectPlugin

extension MCPAutoTracePlugin: XcodeBuildToolPlugin {
    func createBuildCommands(context: XcodePluginContext, target: XcodeTarget) throws -> [Command] {
        // Get the transformer tool
        let transformer = try context.tool(named: "MCPAutoTraceTransformer")
        
        // Create output directory
        let outputDir = context.pluginWorkDirectory.appending("TracedSources")
        
        // Get Swift input files from the target
        let swiftFiles = target.inputFiles.filter { $0.path.extension == "swift" }
        
        guard !swiftFiles.isEmpty else {
            return []
        }
        
        var inputFiles: [Path] = []
        var arguments: [String] = [
            "--output-dir", outputDir.string,
            "--debug-only", "true",
            "--"
        ]
        
        for file in swiftFiles {
            let filename = file.path.lastComponent
            // Skip test and generated files
            if filename.hasSuffix("Tests.swift") || 
               filename.hasSuffix(".generated.swift") {
                continue
            }
            
            inputFiles.append(file.path)
            arguments.append(file.path.string)
        }
        
        guard !inputFiles.isEmpty else {
            return []
        }
        
        return [
            .prebuildCommand(
                displayName: "MCP Auto-Trace: Instrumenting \(inputFiles.count) Swift files",
                executable: transformer.path,
                arguments: arguments,
                outputFilesDirectory: outputDir
            )
        ]
    }
}
#endif
