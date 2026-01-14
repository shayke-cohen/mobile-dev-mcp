// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "MCPDemoApp",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "MCPDemoApp",
            targets: ["MCPDemoApp"]
        ),
    ],
    dependencies: [
        .package(path: "../../packages/sdk-ios")
    ],
    targets: [
        .target(
            name: "MCPDemoApp",
            dependencies: [
                .product(name: "MobileDevMCP", package: "sdk-ios")
            ],
            path: "Sources",
            // Enable zero-config auto-instrumentation
            plugins: [
                .plugin(name: "MCPAutoTrace", package: "sdk-ios")
            ]
        ),
    ]
)
