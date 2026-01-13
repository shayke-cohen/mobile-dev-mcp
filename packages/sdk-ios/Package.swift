// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "MobileDevMCP",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "MobileDevMCP",
            targets: ["MobileDevMCP"]
        ),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "MobileDevMCP",
            dependencies: [],
            path: "Sources/MobileDevMCP"
        ),
        .testTarget(
            name: "MobileDevMCPTests",
            dependencies: ["MobileDevMCP"]
        ),
    ]
)
