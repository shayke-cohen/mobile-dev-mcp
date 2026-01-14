// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription
import CompilerPluginSupport

let package = Package(
    name: "MobileDevMCP",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        // Main SDK library
        .library(
            name: "MobileDevMCP",
            targets: ["MobileDevMCP"]
        ),
        // Macros library for auto-instrumentation (annotation-based)
        .library(
            name: "MCPMacros",
            targets: ["MCPMacros"]
        ),
        // Build plugin for zero-config auto-instrumentation
        .plugin(
            name: "MCPAutoTrace",
            targets: ["MCPAutoTracePlugin"]
        ),
    ],
    dependencies: [
        // Swift Syntax for macro and plugin implementation
        .package(url: "https://github.com/apple/swift-syntax.git", from: "509.0.0"),
    ],
    targets: [
        // Main SDK target
        .target(
            name: "MobileDevMCP",
            dependencies: [],
            path: "Sources/MobileDevMCP"
        ),
        
        // Macro declarations (what users import)
        .target(
            name: "MCPMacros",
            dependencies: [
                "MobileDevMCP",
                "MCPMacrosPlugin"
            ],
            path: "Sources/MCPMacros"
        ),
        
        // Macro implementation (compiler plugin)
        .macro(
            name: "MCPMacrosPlugin",
            dependencies: [
                .product(name: "SwiftSyntax", package: "swift-syntax"),
                .product(name: "SwiftSyntaxMacros", package: "swift-syntax"),
                .product(name: "SwiftCompilerPlugin", package: "swift-syntax"),
            ],
            path: "Sources/MCPMacrosPlugin"
        ),
        
        // Auto-trace build tool plugin
        .plugin(
            name: "MCPAutoTracePlugin",
            capability: .buildTool(),
            dependencies: [
                "MCPAutoTraceTransformer"
            ],
            path: "Plugins/MCPAutoTracePlugin"
        ),
        
        // Executable that transforms Swift source files
        .executableTarget(
            name: "MCPAutoTraceTransformer",
            dependencies: [
                .product(name: "SwiftSyntax", package: "swift-syntax"),
                .product(name: "SwiftParser", package: "swift-syntax"),
            ],
            path: "Sources/MCPAutoTraceTransformer"
        ),
        
        // Tests
        .testTarget(
            name: "MobileDevMCPTests",
            dependencies: ["MobileDevMCP"]
        ),
        .testTarget(
            name: "MCPMacrosTests",
            dependencies: [
                "MCPMacros",
                "MCPMacrosPlugin",
                .product(name: "SwiftSyntaxMacrosTestSupport", package: "swift-syntax"),
            ]
        ),
        .testTarget(
            name: "MCPAutoTraceTests",
            dependencies: ["MCPAutoTraceTransformer"]
        ),
    ]
)
