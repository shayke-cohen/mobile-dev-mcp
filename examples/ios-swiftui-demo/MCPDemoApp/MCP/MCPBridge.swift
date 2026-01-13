/**
 * MCP Bridge - iOS SDK (Inline Version)
 * 
 * This is a standalone version of the MCP SDK for the demo app.
 * In production, you would add the MobileDevMCP Swift Package.
 */

import Foundation
import UIKit

// MARK: - MCP Bridge

final class MCPBridge: ObservableObject {
    static let shared = MCPBridge()
    
    @Published var isConnected = false
    @Published var lastActivity = ""
    @Published var reconnectCount = 0
    @Published var activityLog: [String] = []
    
    private var webSocketTask: URLSessionWebSocketTask?
    private var stateGetters: [String: () -> Any?] = [:]
    private var logs: [[String: Any]] = []
    private var networkRequests: [[String: Any]] = []
    private var featureFlags: [String: Bool] = [:]
    private var reconnectTimer: Timer?
    private var isInitialized = false
    private var reconnectAttempts = 0
    
    private var serverUrl: String = "ws://localhost:8765"
    private var debug = true
    
    private init() {}
    
    // MARK: - Public API
    
    func initialize(serverUrl: String = "ws://localhost:8765", debug: Bool = true) {
        #if DEBUG
        guard !isInitialized else {
            log("Already initialized")
            return
        }
        
        self.serverUrl = serverUrl
        self.debug = debug
        
        connect()
        
        isInitialized = true
        log("Initialized, connecting to \(serverUrl)")
        #else
        print("[MCP SDK] Only works in DEBUG builds")
        #endif
    }
    
    func exposeState(key: String, getter: @escaping () -> Any?) {
        stateGetters[key] = getter
        if debug {
            log("Exposed state: \(key)")
        }
    }
    
    func registerFeatureFlags(_ flags: [String: Bool]) {
        flags.forEach { featureFlags[$0.key] = $0.value }
        log("Registered \(flags.count) feature flags")
    }
    
    func getFeatureFlag(_ key: String) -> Bool {
        return featureFlags[key] ?? false
    }
    
    func enableLogCapture() {
        log("Log capture enabled")
    }
    
    func enableNetworkInterception() {
        log("Network interception enabled")
    }
    
    func disconnect() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        logActivity("Disconnected by user")
        DispatchQueue.main.async {
            self.isConnected = false
        }
    }
    
    /// Manually trigger reconnect
    func reconnect() {
        disconnect()
        connect()
    }
    
    /// Get activity log for debugging
    func getActivityLog() -> [String] {
        return activityLog
    }
    
    // MARK: - Private Methods
    
    private func connect() {
        guard let url = URL(string: serverUrl) else {
            log("Invalid server URL: \(serverUrl)")
            return
        }
        
        logActivity("Connecting to \(serverUrl)...")
        
        let session = URLSession(configuration: .default)
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()
        
        // Send handshake message (expected by device manager)
        let handshake: [String: Any] = [
            "type": "handshake",
            "platform": "ios",
            "appName": Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String ?? "MCPDemoApp",
            "appVersion": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0",
            "deviceId": UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString,
            "capabilities": ["state", "logs", "network", "featureFlags"]
        ]
        
        sendMessage(handshake)
        logActivity("Sent handshake")
        
        DispatchQueue.main.async {
            self.isConnected = true
            self.reconnectAttempts = 0
            self.reconnectCount = 0
            self.logActivity("Connected!")
        }
        
        receiveMessage()
    }
    
    private func scheduleReconnect() {
        guard isInitialized else { return }
        
        reconnectTimer?.invalidate()
        reconnectAttempts += 1
        
        DispatchQueue.main.async {
            self.reconnectCount = self.reconnectAttempts
            self.logActivity("Reconnecting in 3s (attempt \(self.reconnectAttempts))...")
        }
        
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: false) { [weak self] _ in
            self?.connect()
        }
    }
    
    private func logActivity(_ message: String) {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        let timestamp = formatter.string(from: Date())
        let entry = "[\(timestamp)] \(message)"
        
        DispatchQueue.main.async {
            self.activityLog.append(entry)
            if self.activityLog.count > 50 {
                self.activityLog.removeFirst()
            }
            self.lastActivity = entry
        }
        
        if debug {
            print("[MCP SDK] \(message)")
        }
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self?.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                self?.receiveMessage()
                
            case .failure(let error):
                self?.log("WebSocket error: \(error.localizedDescription)")
                self?.logActivity("Disconnected: \(error.localizedDescription)")
                DispatchQueue.main.async {
                    self?.isConnected = false
                }
                self?.scheduleReconnect()
            }
        }
    }
    
    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id = json["id"] as? String,
              let method = json["method"] as? String else {
            return
        }
        
        let params = json["params"] as? [String: Any] ?? [:]
        
        logActivity("← Command: \(method)")
        
        do {
            let result = try handleCommand(method: method, params: params)
            sendResponse(id: id, result: result)
            logActivity("→ Response: \(method) OK")
        } catch {
            sendError(id: id, message: error.localizedDescription)
            logActivity("→ Error: \(method) - \(error.localizedDescription)")
        }
    }
    
    private func handleCommand(method: String, params: [String: Any]) throws -> Any? {
        switch method {
        case "get_app_state":
            return getAppState(params: params)
        case "list_feature_flags":
            return featureFlags
        case "toggle_feature_flag":
            return try toggleFeatureFlag(params: params)
        case "get_device_info":
            return getDeviceInfo()
        case "get_app_info":
            return getAppInfo()
        case "get_logs":
            let limit = params["limit"] as? Int ?? 100
            return ["logs": Array(logs.suffix(limit)), "count": logs.count]
        case "get_recent_errors":
            let limit = params["limit"] as? Int ?? 20
            let errors = logs.filter { ($0["level"] as? String) == "error" }
            return ["errors": Array(errors.suffix(limit)), "count": errors.count]
        case "list_network_requests":
            return networkRequests.suffix(params["limit"] as? Int ?? 50)
        default:
            throw MCPError.unknownMethod(method)
        }
    }
    
    private func getAppState(params: [String: Any]) -> [String: Any] {
        var result: [String: Any] = [:]
        
        if let key = params["key"] as? String {
            if let getter = stateGetters[key] {
                result[key] = getter() ?? NSNull()
            }
        } else {
            for (key, getter) in stateGetters {
                result[key] = getter() ?? NSNull()
            }
        }
        
        return result
    }
    
    private func toggleFeatureFlag(params: [String: Any]) throws -> [String: Any] {
        guard let key = params["key"] as? String else {
            throw MCPError.invalidParams("key required")
        }
        
        let current = featureFlags[key] ?? false
        let newValue = params["value"] as? Bool ?? !current
        featureFlags[key] = newValue
        
        return ["key": key, "value": newValue]
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
            "isSimulator": isSimulator()
        ]
    }
    
    private func getAppInfo() -> [String: Any] {
        let bundle = Bundle.main
        return [
            "name": bundle.object(forInfoDictionaryKey: "CFBundleName") as? String ?? "MCP Demo",
            "version": bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0",
            "buildNumber": bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1",
            "bundleId": bundle.bundleIdentifier ?? "com.mobiledevmcp.demo",
            "environment": "development"
        ]
    }
    
    private func isSimulator() -> Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }
    
    private func sendMessage(_ data: [String: Any]) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: data),
              let text = String(data: jsonData, encoding: .utf8) else {
            return
        }
        webSocketTask?.send(.string(text)) { _ in }
    }
    
    private func sendResponse(id: String, result: Any?) {
        var response: [String: Any] = ["type": "response", "id": id]
        if let result = result {
            response["result"] = result
        }
        sendMessage(response)
    }
    
    private func sendError(id: String, message: String) {
        sendMessage(["type": "response", "id": id, "error": message])
    }
    
    private func log(_ message: String) {
        print("[MCP SDK] \(message)")
        logs.append([
            "level": "info",
            "message": message,
            "timestamp": Date().timeIntervalSince1970 * 1000
        ])
    }
}

// MARK: - Error Types

enum MCPError: LocalizedError {
    case unknownMethod(String)
    case invalidParams(String)
    
    var errorDescription: String? {
        switch self {
        case .unknownMethod(let method):
            return "Unknown method: \(method)"
        case .invalidParams(let message):
            return "Invalid params: \(message)"
        }
    }
}
