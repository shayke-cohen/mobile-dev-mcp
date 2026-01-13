/**
 * MobileDevMCP - iOS SDK
 *
 * Enables AI-assisted development by connecting your iOS app to Cursor IDE.
 *
 * Usage:
 * ```swift
 * #if DEBUG
 * import MobileDevMCP
 *
 * @main
 * struct MyApp: App {
 *     init() {
 *         MCPBridge.shared.initialize(serverUrl: "ws://localhost:8765")
 *         MCPBridge.shared.exposeState(key: "user") { UserViewModel.shared.currentUser }
 *     }
 * }
 * #endif
 * ```
 */

import Foundation
import UIKit

/// Main bridge class for MCP SDK
public final class MCPBridge {
    
    /// Shared singleton instance
    public static let shared = MCPBridge()
    
    // MARK: - Private Properties
    
    private var wsClient: WebSocketClient?
    private var stateAdapter: StateAdapter
    private var networkAdapter: NetworkAdapter
    private var uiAdapter: UIAdapter
    private var logAdapter: LogAdapter
    private var isInitialized = false
    
    // MARK: - Initialization
    
    private init() {
        self.stateAdapter = StateAdapter()
        self.networkAdapter = NetworkAdapter()
        self.uiAdapter = UIAdapter()
        self.logAdapter = LogAdapter()
    }
    
    /// Initialize the MCP SDK
    /// - Parameter serverUrl: WebSocket server URL (default: ws://localhost:8765)
    public func initialize(serverUrl: String = "ws://localhost:8765") {
        #if DEBUG
        guard !isInitialized else {
            print("[MCP SDK] Already initialized")
            return
        }
        
        guard let url = URL(string: serverUrl) else {
            print("[MCP SDK] Invalid server URL: \(serverUrl)")
            return
        }
        
        wsClient = WebSocketClient(url: url, delegate: self)
        wsClient?.connect()
        
        isInitialized = true
        print("[MCP SDK] Initialized, connecting to \(serverUrl)")
        #else
        print("[MCP SDK] SDK only works in DEBUG builds")
        #endif
    }
    
    // MARK: - Public API
    
    /// Expose state for inspection
    /// - Parameters:
    ///   - key: Unique key for this state
    ///   - getter: Closure that returns the current state
    public func exposeState(key: String, getter: @escaping () -> Any?) {
        stateAdapter.register(key: key, getter: getter)
    }
    
    /// Enable network request interception
    public func enableNetworkInterception() {
        networkAdapter.enable()
    }
    
    /// Enable UI inspection
    public func enableUIInspection() {
        uiAdapter.enable()
    }
    
    /// Enable log capturing
    public func enableLogCapture() {
        logAdapter.enable()
    }
    
    /// Register feature flags
    public func registerFeatureFlags(_ flags: [String: Bool]) {
        stateAdapter.registerFeatureFlags(flags)
    }
    
    /// Check if connected to MCP server
    public var isConnected: Bool {
        wsClient?.isConnected ?? false
    }
    
    /// Disconnect from MCP server
    public func disconnect() {
        wsClient?.disconnect()
    }
}

// MARK: - WebSocketClientDelegate

extension MCPBridge: WebSocketClientDelegate {
    
    func webSocketDidConnect() {
        print("[MCP SDK] Connected to server")
    }
    
    func webSocketDidDisconnect(error: Error?) {
        if let error = error {
            print("[MCP SDK] Disconnected with error: \(error.localizedDescription)")
        } else {
            print("[MCP SDK] Disconnected")
        }
    }
    
    func webSocketDidReceiveCommand(_ command: MCPCommand) {
        Task { @MainActor in
            do {
                let result = try await handleCommand(command)
                wsClient?.sendResponse(id: command.id, result: result)
            } catch {
                wsClient?.sendError(id: command.id, message: error.localizedDescription)
            }
        }
    }
    
    private func handleCommand(_ command: MCPCommand) async throws -> Any? {
        switch command.method {
        // State tools
        case "get_app_state":
            return try stateAdapter.getState(params: command.params)
        case "get_navigation_state":
            return stateAdapter.getNavigationState()
        case "list_feature_flags":
            return stateAdapter.getFeatureFlags()
        case "toggle_feature_flag":
            return try stateAdapter.toggleFeatureFlag(params: command.params)
            
        // Network tools
        case "list_network_requests":
            return networkAdapter.listRequests(params: command.params)
            
        // UI tools
        case "capture_screenshot":
            return try await uiAdapter.captureScreenshot()
        case "get_layout_tree":
            return uiAdapter.getViewHierarchy()
            
        // Log tools
        case "get_logs":
            return logAdapter.getLogs(params: command.params)
        case "get_recent_errors":
            return logAdapter.getRecentErrors(params: command.params)
            
        // Device tools
        case "get_device_info":
            return getDeviceInfo()
        case "get_app_info":
            return getAppInfo()
            
        default:
            throw MCPError.unknownMethod(command.method)
        }
    }
    
    private func getDeviceInfo() -> [String: Any] {
        let device = UIDevice.current
        let screen = UIScreen.main
        
        return [
            "platform": "ios",
            "version": device.systemVersion,
            "model": device.model,
            "name": device.name,
            "screenSize": [
                "width": screen.bounds.width,
                "height": screen.bounds.height
            ],
            "scale": screen.scale,
            "isSimulator": TARGET_OS_SIMULATOR != 0
        ]
    }
    
    private func getAppInfo() -> [String: Any] {
        let bundle = Bundle.main
        
        return [
            "name": bundle.object(forInfoDictionaryKey: "CFBundleName") as? String ?? "Unknown",
            "version": bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0",
            "buildNumber": bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0",
            "bundleId": bundle.bundleIdentifier ?? "unknown",
            "environment": "development"
        ]
    }
}

// MARK: - Error Types

public enum MCPError: Error {
    case unknownMethod(String)
    case invalidParams(String)
    case notInitialized
    
    var localizedDescription: String {
        switch self {
        case .unknownMethod(let method):
            return "Unknown method: \(method)"
        case .invalidParams(let message):
            return "Invalid params: \(message)"
        case .notInitialized:
            return "MCP SDK not initialized"
        }
    }
}
