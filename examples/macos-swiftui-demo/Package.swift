// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MCPDemoApp",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "MCPDemoApp", targets: ["MCPDemoApp"])
    ],
    targets: [
        .executableTarget(
            name: "MCPDemoApp",
            path: "MCPDemoApp"
        )
    ]
)
