/**
 * MCP Bridge - macOS SDK (Inline Version)
 * 
 * This is a standalone version of the MCP SDK for the demo app.
 * In production, you would add the MobileDevMCP Swift Package.
 */

import Foundation
import AppKit

// MARK: - MCP Bridge

final class MCPBridge: ObservableObject {
    static let shared = MCPBridge()
    
    @Published var isConnected = false
    @Published var lastActivity = ""
    @Published var reconnectCount = 0
    @Published var activityLog: [String] = []
    
    private var webSocketTask: URLSessionWebSocketTask?
    private var stateGetters: [String: () -> Any?] = [:]
    private var actionHandlers: [String: ([String: Any]) throws -> Any?] = [:]
    private var logs: [[String: Any]] = []
    private var networkRequests: [[String: Any]] = []
    private var featureFlags: [String: Bool] = [:]
    private var reconnectTimer: Timer?
    private var isInitialized = false
    private var reconnectAttempts = 0
    
    private var components: [String: RegisteredComponent] = [:]
    private var navigationState: NavigationState = NavigationState()
    private var networkMocks: [String: NetworkMock] = [:]
    
    private static let DEFAULT_PORT = "8765"
    private static var defaultServerUrl: String {
        "ws://localhost:\(DEFAULT_PORT)"
    }
    
    private var serverUrl: String = MCPBridge.defaultServerUrl
    private var debug = true
    
    private init() {}
    
    // MARK: - Public API
    
    func initialize(serverUrl: String? = nil, debug: Bool = true) {
        let url = serverUrl ?? MCPBridge.defaultServerUrl
        #if DEBUG
        guard !isInitialized else {
            log("Already initialized")
            return
        }
        
        self.serverUrl = url
        self.debug = debug
        
        connect()
        
        isInitialized = true
        log("Initialized, connecting to \(url)")
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
    
    func registerAction(name: String, handler: @escaping ([String: Any]) throws -> Any?) {
        actionHandlers[name] = handler
        if debug {
            log("Registered action: \(name)")
        }
    }
    
    func registerActions(_ actions: [String: ([String: Any]) throws -> Any?]) {
        actions.forEach { registerAction(name: $0.key, handler: $0.value) }
    }
    
    func getRegisteredActions() -> [String] {
        return Array(actionHandlers.keys)
    }
    
    func registerComponent(testId: String, type: String, props: [String: Any]? = nil, bounds: CGRect? = nil, onTap: (() -> Void)? = nil, getText: (() -> String?)? = nil) {
        components[testId] = RegisteredComponent(testId: testId, type: type, props: props, bounds: bounds, onTap: onTap, getText: getText)
        if debug {
            log("Registered component: \(testId)")
        }
    }
    
    func unregisterComponent(testId: String) {
        components.removeValue(forKey: testId)
    }
    
    func updateComponentBounds(testId: String, bounds: CGRect) {
        components[testId]?.bounds = bounds
    }
    
    func setNavigationState(route: String, params: [String: Any]? = nil) {
        navigationState.history.append((route: navigationState.currentRoute, timestamp: Date()))
        navigationState.currentRoute = route
        navigationState.params = params
        
        if navigationState.history.count > 20 {
            navigationState.history = Array(navigationState.history.suffix(20))
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
    
    func reconnect() {
        disconnect()
        connect()
    }
    
    func getActivityLog() -> [String] {
        return activityLog
    }
    
    func getServerUrl() -> String {
        return serverUrl
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
        
        let handshake: [String: Any] = [
            "type": "handshake",
            "platform": "macos",
            "appName": Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String ?? "MCPDemoApp",
            "appVersion": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0",
            "deviceId": getDeviceId(),
            "capabilities": ["state", "logs", "network", "featureFlags", "actions", "ui"]
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
    
    private func getDeviceId() -> String {
        if let uuid = getMacSerialNumber() {
            return uuid
        }
        return UUID().uuidString
    }
    
    private func getMacSerialNumber() -> String? {
        let platformExpert = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("IOPlatformExpertDevice"))
        guard platformExpert > 0 else { return nil }
        defer { IOObjectRelease(platformExpert) }
        
        if let serialNumber = IORegistryEntryCreateCFProperty(platformExpert, kIOPlatformSerialNumberKey as CFString, kCFAllocatorDefault, 0)?.takeRetainedValue() as? String {
            return serialNumber
        }
        return nil
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
        case "get_component_tree":
            return getComponentTree(params: params)
        case "get_layout_tree":
            return getLayoutTree(params: params)
        case "inspect_element":
            return inspectElement(params: params)
        case "find_element":
            return findElement(params: params)
        case "get_element_text":
            return getElementText(params: params)
        case "simulate_interaction":
            return try simulateInteraction(params: params)
        case "get_navigation_state":
            return getNavigationStateDict()
        case "query_storage":
            return queryStorage(params: params)
        case "mock_network_request":
            return mockNetworkRequest(params: params)
        case "clear_network_mocks":
            return clearNetworkMocks(params: params)
        case "list_actions":
            return getRegisteredActions()
        case "navigate_to":
            return try executeAction(name: "navigate", params: params)
        case "execute_action":
            guard let actionName = params["action"] as? String else {
                throw MCPError.invalidParams("action is required")
            }
            return try executeAction(name: actionName, params: params)
        case "add_to_cart":
            return try executeAction(name: "addToCart", params: params)
        case "remove_from_cart":
            return try executeAction(name: "removeFromCart", params: params)
        case "clear_cart":
            return try executeAction(name: "clearCart", params: params)
        case "login":
            return try executeAction(name: "login", params: params)
        case "logout":
            return try executeAction(name: "logout", params: params)
        default:
            if actionHandlers[method] != nil {
                return try executeAction(name: method, params: params)
            }
            throw MCPError.unknownMethod(method)
        }
    }
    
    private func executeAction(name: String, params: [String: Any]) throws -> Any? {
        guard let handler = actionHandlers[name] else {
            throw MCPError.unknownMethod("Action not registered: \(name)")
        }
        
        let result = try handler(params)
        return ["success": true, "action": name, "result": result ?? NSNull()]
    }
    
    private func getComponentTree(params: [String: Any]) -> [String: Any] {
        let includeProps = params["includeProps"] as? Bool ?? true
        
        let componentList = components.values.map { comp -> [String: Any] in
            var dict: [String: Any] = [
                "testId": comp.testId,
                "type": comp.type,
                "hasTapHandler": comp.onTap != nil,
                "hasTextGetter": comp.getText != nil
            ]
            if includeProps, let props = comp.props {
                dict["props"] = props
            }
            if let bounds = comp.bounds {
                dict["bounds"] = ["x": bounds.origin.x, "y": bounds.origin.y, "width": bounds.width, "height": bounds.height]
            }
            return dict
        }
        
        return [
            "componentCount": components.count,
            "components": componentList,
            "registeredTestIds": Array(components.keys)
        ]
    }
    
    private func getLayoutTree(params: [String: Any]) -> [String: Any] {
        let includeHidden = params["includeHidden"] as? Bool ?? false
        
        let elements = components.values.compactMap { comp -> [String: Any]? in
            guard includeHidden || comp.bounds != nil else { return nil }
            let bounds = comp.bounds ?? .zero
            return [
                "testId": comp.testId,
                "type": comp.type,
                "bounds": ["x": bounds.origin.x, "y": bounds.origin.y, "width": bounds.width, "height": bounds.height],
                "visible": comp.bounds != nil
            ]
        }
        
        return ["elementCount": elements.count, "elements": elements]
    }
    
    private func inspectElement(params: [String: Any]) -> [String: Any] {
        guard let x = params["x"] as? CGFloat, let y = params["y"] as? CGFloat else {
            return ["found": false, "error": "x and y required"]
        }
        
        let point = CGPoint(x: x, y: y)
        for comp in components.values {
            if let bounds = comp.bounds, bounds.contains(point) {
                return [
                    "found": true,
                    "testId": comp.testId,
                    "type": comp.type,
                    "bounds": ["x": bounds.origin.x, "y": bounds.origin.y, "width": bounds.width, "height": bounds.height],
                    "text": comp.getText?() ?? NSNull(),
                    "interactive": comp.onTap != nil
                ]
            }
        }
        
        return ["found": false, "x": x, "y": y]
    }
    
    private func findElement(params: [String: Any]) -> [String: Any] {
        let testId = params["testId"] as? String
        let type = params["type"] as? String
        let text = params["text"] as? String
        
        let results = components.values.filter { comp in
            if let testId = testId, comp.testId != testId { return false }
            if let type = type, comp.type != type { return false }
            if let text = text, comp.getText?() != text { return false }
            return true
        }.map { comp -> [String: Any] in
            var dict: [String: Any] = ["testId": comp.testId, "type": comp.type]
            if let bounds = comp.bounds {
                dict["bounds"] = ["x": bounds.origin.x, "y": bounds.origin.y, "width": bounds.width, "height": bounds.height]
            }
            dict["text"] = comp.getText?() ?? NSNull()
            return dict
        }
        
        return ["found": !results.isEmpty, "count": results.count, "elements": results]
    }
    
    private func getElementText(params: [String: Any]) -> [String: Any] {
        guard let testId = params["testId"] as? String else {
            return ["found": false, "error": "testId required"]
        }
        
        guard let comp = components[testId] else {
            return ["found": false, "testId": testId]
        }
        
        return ["found": true, "testId": testId, "text": comp.getText?() ?? NSNull(), "type": comp.type]
    }
    
    private func simulateInteraction(params: [String: Any]) throws -> [String: Any] {
        guard let type = params["type"] as? String,
              let target = params["target"] as? [String: Any] else {
            throw MCPError.invalidParams("type and target required")
        }
        
        var component: RegisteredComponent?
        
        if let testId = target["testId"] as? String {
            component = components[testId]
        } else if let x = target["x"] as? CGFloat, let y = target["y"] as? CGFloat {
            let point = CGPoint(x: x, y: y)
            component = components.values.first { $0.bounds?.contains(point) == true }
        }
        
        guard let comp = component else {
            return ["success": false, "error": "Element not found"]
        }
        
        switch type {
        case "tap", "press", "click":
            if let onTap = comp.onTap {
                DispatchQueue.main.async { onTap() }
                return ["success": true, "action": "click", "testId": comp.testId]
            }
            return ["success": false, "error": "Element not clickable", "testId": comp.testId]
        default:
            return ["success": false, "error": "Unknown interaction type: \(type)"]
        }
    }
    
    private func getNavigationStateDict() -> [String: Any] {
        return [
            "currentRoute": navigationState.currentRoute,
            "params": navigationState.params ?? NSNull(),
            "history": navigationState.history.map { ["route": $0.route, "timestamp": ISO8601DateFormatter().string(from: $0.timestamp)] },
            "historyLength": navigationState.history.count
        ]
    }
    
    private func queryStorage(params: [String: Any]) -> [String: Any] {
        let key = params["key"] as? String
        
        if let key = key {
            let value = UserDefaults.standard.object(forKey: key)
            return ["key": key, "value": value ?? NSNull(), "exists": value != nil]
        }
        
        let pattern = params["pattern"] as? String
        var allKeys = UserDefaults.standard.dictionaryRepresentation().keys.map { $0 }
        
        if let pattern = pattern, let regex = try? NSRegularExpression(pattern: pattern) {
            allKeys = allKeys.filter { key in
                regex.firstMatch(in: key, range: NSRange(key.startIndex..., in: key)) != nil
            }
        }
        
        var storage: [String: Any] = [:]
        for key in allKeys.prefix(100) {
            storage[key] = UserDefaults.standard.object(forKey: key) ?? NSNull()
        }
        
        return ["keyCount": allKeys.count, "keys": Array(allKeys.prefix(100)), "storage": storage]
    }
    
    private func mockNetworkRequest(params: [String: Any]) -> [String: Any] {
        guard let urlPattern = params["urlPattern"] as? String,
              let mockResponse = params["mockResponse"] as? [String: Any],
              let statusCode = mockResponse["statusCode"] as? Int,
              let body = mockResponse["body"] else {
            return ["success": false, "error": "Invalid mock configuration"]
        }
        
        let mockId = "mock_\(Date().timeIntervalSince1970)_\(Int.random(in: 1000...9999))"
        
        networkMocks[mockId] = NetworkMock(
            id: mockId,
            urlPattern: urlPattern,
            response: NetworkMock.MockResponse(
                statusCode: statusCode,
                body: body,
                headers: mockResponse["headers"] as? [String: String],
                delay: mockResponse["delay"] as? TimeInterval
            )
        )
        
        return ["success": true, "mockId": mockId, "urlPattern": urlPattern, "activeMocks": networkMocks.count]
    }
    
    private func clearNetworkMocks(params: [String: Any]) -> [String: Any] {
        if let mockId = params["mockId"] as? String {
            let removed = networkMocks.removeValue(forKey: mockId) != nil
            return ["success": removed, "mockId": mockId, "remainingMocks": networkMocks.count]
        }
        
        let count = networkMocks.count
        networkMocks.removeAll()
        return ["success": true, "clearedCount": count, "remainingMocks": 0]
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
        let processInfo = ProcessInfo.processInfo
        
        return [
            "platform": "macos",
            "version": processInfo.operatingSystemVersionString,
            "hostName": processInfo.hostName,
            "processorCount": processInfo.processorCount,
            "physicalMemory": processInfo.physicalMemory,
            "screenSize": getScreenSize()
        ]
    }
    
    private func getScreenSize() -> [String: CGFloat] {
        if let screen = NSScreen.main {
            return ["width": screen.frame.width, "height": screen.frame.height]
        }
        return ["width": 0, "height": 0]
    }
    
    private func getAppInfo() -> [String: Any] {
        let bundle = Bundle.main
        return [
            "name": bundle.object(forInfoDictionaryKey: "CFBundleName") as? String ?? "MCP Demo",
            "version": bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0",
            "buildNumber": bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1",
            "bundleId": bundle.bundleIdentifier ?? "com.mobiledevmcp.macos.demo",
            "environment": "development"
        ]
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

// MARK: - Supporting Types

struct RegisteredComponent {
    let testId: String
    let type: String
    var props: [String: Any]?
    var bounds: CGRect?
    var onTap: (() -> Void)?
    var getText: (() -> String?)?
    var children: [String]?
}

struct NavigationState {
    var currentRoute: String = "home"
    var params: [String: Any]?
    var history: [(route: String, timestamp: Date)] = []
}

struct NetworkMock {
    let id: String
    let urlPattern: String
    let response: MockResponse
    
    struct MockResponse {
        let statusCode: Int
        let body: Any
        var headers: [String: String]?
        var delay: TimeInterval?
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
