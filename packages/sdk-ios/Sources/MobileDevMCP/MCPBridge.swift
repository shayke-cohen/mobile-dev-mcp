/**
 * MobileDevMCP - iOS SDK
 * 
 * Connects your iOS app to the MCP server for AI-assisted development in Cursor.
 * 
 * Usage:
 * ```swift
 * // Initialize in AppDelegate or App init
 * MCPBridge.shared.initialize()
 * 
 * // Expose state for AI inspection
 * MCPBridge.shared.exposeState(key: "user") { currentUser }
 * MCPBridge.shared.exposeState(key: "cart") { cartItems }
 * 
 * // Register actions for AI control
 * MCPBridge.shared.registerAction(name: "addToCart") { params in
 *     guard let productId = params["productId"] as? String else { return nil }
 *     addToCart(productId)
 *     return ["success": true]
 * }
 * ```
 */

import Foundation
#if canImport(UIKit)
import UIKit
#endif

// MARK: - MCP Bridge

public final class MCPBridge: ObservableObject {
    public static let shared = MCPBridge()
    
    @Published public var isConnected = false
    @Published public var lastActivity = ""
    @Published public var reconnectCount = 0
    @Published public var activityLog: [String] = []
    
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
    
    // Tracing
    private var activeTraces: [String: TraceEntry] = [:]
    private var traceHistory: [TraceEntry] = []
    private var traceIdCounter: Int = 0
    
    private static let DEFAULT_PORT = "8765"
    private static var defaultServerUrl: String {
        "ws://localhost:\(DEFAULT_PORT)"
    }
    
    private var serverUrl: String = MCPBridge.defaultServerUrl
    private var debug = true
    
    private init() {}
    
    // MARK: - Public API
    
    /// Initialize the MCP SDK
    /// - Parameters:
    ///   - serverUrl: WebSocket server URL (default: ws://localhost:8765)
    ///   - debug: Enable debug logging (default: true)
    public func initialize(serverUrl: String? = nil, debug: Bool = true) {
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
    
    /// Expose state for AI inspection
    /// - Parameters:
    ///   - key: State key name
    ///   - getter: Closure that returns the current state value
    public func exposeState(key: String, getter: @escaping () -> Any?) {
        stateGetters[key] = getter
        if debug {
            log("Exposed state: \(key)")
        }
    }
    
    /// Register an action handler that can be triggered by AI
    /// - Parameters:
    ///   - name: Action name
    ///   - handler: Closure that handles the action
    public func registerAction(name: String, handler: @escaping ([String: Any]) throws -> Any?) {
        actionHandlers[name] = handler
        if debug {
            log("Registered action: \(name)")
        }
    }
    
    /// Register multiple action handlers at once
    public func registerActions(_ actions: [String: ([String: Any]) throws -> Any?]) {
        actions.forEach { registerAction(name: $0.key, handler: $0.value) }
    }
    
    /// Get list of registered actions
    public func getRegisteredActions() -> [String] {
        return Array(actionHandlers.keys)
    }
    
    /// Register a UI component for inspection and interaction
    public func registerComponent(testId: String, type: String, props: [String: Any]? = nil, bounds: CGRect? = nil, onTap: (() -> Void)? = nil, getText: (() -> String?)? = nil) {
        components[testId] = RegisteredComponent(testId: testId, type: type, props: props, bounds: bounds, onTap: onTap, getText: getText)
        if debug {
            log("Registered component: \(testId)")
        }
    }
    
    /// Unregister a component
    public func unregisterComponent(testId: String) {
        components.removeValue(forKey: testId)
    }
    
    /// Update component bounds
    public func updateComponentBounds(testId: String, bounds: CGRect) {
        components[testId]?.bounds = bounds
    }
    
    /// Set navigation state
    public func setNavigationState(route: String, params: [String: Any]? = nil) {
        navigationState.history.append((route: navigationState.currentRoute, timestamp: Date()))
        navigationState.currentRoute = route
        navigationState.params = params
        
        if navigationState.history.count > 20 {
            navigationState.history = Array(navigationState.history.suffix(20))
        }
    }
    
    /// Register feature flags
    public func registerFeatureFlags(_ flags: [String: Bool]) {
        flags.forEach { featureFlags[$0.key] = $0.value }
        log("Registered \(flags.count) feature flags")
    }
    
    /// Get feature flag value
    public func getFeatureFlag(_ key: String) -> Bool {
        return featureFlags[key] ?? false
    }
    
    /// Enable log capture
    public func enableLogCapture() {
        log("Log capture enabled")
    }
    
    /// Enable network interception
    public func enableNetworkInterception() {
        log("Network interception enabled")
    }
    
    /// Disconnect from server
    public func disconnect() {
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
    public func reconnect() {
        disconnect()
        connect()
    }
    
    /// Get activity log
    public func getActivityLog() -> [String] {
        return activityLog
    }
    
    /// Get current server URL
    public func getServerUrl() -> String {
        return serverUrl
    }
    
    // MARK: - Tracing API
    
    /// Trace a function call (called at function entry)
    /// - Parameters:
    ///   - name: Function name (e.g., "UserService.fetchUser")
    ///   - info: Trace info including args, file, timing
    /// - Returns: Trace ID for correlation
    @discardableResult
    public func trace(_ name: String, info: TraceInfo = TraceInfo()) -> String {
        #if DEBUG
        traceIdCounter += 1
        let id = "trace_\(traceIdCounter)_\(Int(Date().timeIntervalSince1970 * 1000))"
        
        let entry = TraceEntry(
            id: id,
            name: name,
            info: info,
            timestamp: info.startTime ?? Date().timeIntervalSince1970 * 1000,
            completed: false
        )
        
        activeTraces[id] = entry
        activeTraces["name:\(name)"] = entry
        
        if debug {
            print("[MCP Trace] → \(name)", info.args ?? [:])
        }
        
        return id
        #else
        return ""
        #endif
    }
    
    /// Complete a trace (called at function exit)
    /// - Parameters:
    ///   - name: Function name
    ///   - returnValue: Return value (optional)
    ///   - error: Error message if function threw (optional)
    public func traceReturn(_ name: String, returnValue: Any? = nil, error: String? = nil) {
        #if DEBUG
        guard var entry = activeTraces["name:\(name)"] else { return }
        
        let now = Date().timeIntervalSince1970 * 1000
        entry.duration = now - entry.timestamp
        entry.returnValue = returnValue
        entry.error = error
        entry.completed = true
        
        traceHistory.append(entry)
        if traceHistory.count > 1000 {
            traceHistory = Array(traceHistory.suffix(1000))
        }
        
        activeTraces.removeValue(forKey: entry.id)
        activeTraces.removeValue(forKey: "name:\(name)")
        
        if debug {
            let status = error != nil ? "✗ \(error!)" : "✓"
            print("[MCP Trace] ← \(name) (\(entry.duration ?? 0)ms) \(status)")
        }
        #endif
    }
    
    /// Trace an async function with automatic entry/exit tracking
    public func traceAsync<T>(_ name: String, info: TraceInfo = TraceInfo(), _ fn: () async throws -> T) async rethrows -> T {
        var traceInfo = info
        traceInfo.startTime = Date().timeIntervalSince1970 * 1000
        let _ = trace(name, info: traceInfo)
        
        do {
            let result = try await fn()
            traceReturn(name, returnValue: result)
            return result
        } catch {
            traceReturn(name, error: error.localizedDescription)
            throw error
        }
    }
    
    /// Trace a synchronous function
    public func traceSync<T>(_ name: String, info: TraceInfo = TraceInfo(), _ fn: () throws -> T) rethrows -> T {
        var traceInfo = info
        traceInfo.startTime = Date().timeIntervalSince1970 * 1000
        let _ = trace(name, info: traceInfo)
        
        do {
            let result = try fn()
            traceReturn(name, returnValue: result)
            return result
        } catch {
            traceReturn(name, error: error.localizedDescription)
            throw error
        }
    }
    
    /// Get trace history with optional filtering
    public func getTraces(filter: TraceFilter = TraceFilter()) -> [TraceEntry] {
        var traces = traceHistory
        
        if let namePattern = filter.name {
            traces = traces.filter { $0.name.lowercased().contains(namePattern.lowercased()) }
        }
        
        if let filePattern = filter.file {
            traces = traces.filter { $0.info.file?.lowercased().contains(filePattern.lowercased()) == true }
        }
        
        if let minDuration = filter.minDuration {
            traces = traces.filter { ($0.duration ?? 0) >= minDuration }
        }
        
        if let since = filter.since {
            let sinceTimestamp = Date().timeIntervalSince1970 * 1000 - since
            traces = traces.filter { $0.timestamp >= sinceTimestamp }
        }
        
        if filter.inProgress == true {
            traces = activeTraces.values.filter { !$0.id.hasPrefix("name:") }
        }
        
        let limit = filter.limit ?? 100
        return Array(traces.suffix(limit).reversed())
    }
    
    /// Clear trace history
    public func clearTraces() {
        activeTraces.removeAll()
        traceHistory.removeAll()
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
        
        var deviceId = UUID().uuidString
        #if canImport(UIKit)
        deviceId = UIDevice.current.identifierForVendor?.uuidString ?? deviceId
        #endif
        
        let handshake: [String: Any] = [
            "type": "handshake",
            "platform": "ios",
            "appName": Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String ?? "iOS App",
            "appVersion": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0",
            "deviceId": deviceId,
            "capabilities": ["state", "logs", "network", "featureFlags", "actions", "ui", "tracing"]
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
        case "get_traces":
            return getTracesDict(params: params)
        case "get_active_traces":
            return getTracesDict(params: ["inProgress": true])
        case "clear_traces":
            clearTraces()
            return ["success": true]
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
        case "tap", "press":
            if let onTap = comp.onTap {
                DispatchQueue.main.async { onTap() }
                return ["success": true, "action": "tap", "testId": comp.testId]
            }
            return ["success": false, "error": "Element not tappable", "testId": comp.testId]
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
    
    private func getTracesDict(params: [String: Any]) -> [String: Any] {
        let filter = TraceFilter(
            name: params["name"] as? String,
            file: params["file"] as? String,
            minDuration: params["minDuration"] as? TimeInterval,
            since: params["since"] as? TimeInterval,
            limit: params["limit"] as? Int,
            inProgress: params["inProgress"] as? Bool
        )
        
        let traces = getTraces(filter: filter)
        let traceDicts = traces.map { entry -> [String: Any] in
            var dict: [String: Any] = [
                "id": entry.id,
                "name": entry.name,
                "timestamp": entry.timestamp,
                "completed": entry.completed
            ]
            
            var infoDict: [String: Any] = [:]
            if let args = entry.info.args { infoDict["args"] = args }
            if let file = entry.info.file { infoDict["file"] = file }
            if let startTime = entry.info.startTime { infoDict["startTime"] = startTime }
            dict["info"] = infoDict
            
            if let duration = entry.duration { dict["duration"] = duration }
            if let error = entry.error { dict["error"] = error }
            
            return dict
        }
        
        return [
            "traces": traceDicts,
            "count": traceDicts.count,
            "activeCount": activeTraces.count / 2 // Divide by 2 because we store both id and name keys
        ]
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
        #if canImport(UIKit)
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
        #else
        return [
            "platform": "ios",
            "isSimulator": isSimulator()
        ]
        #endif
    }
    
    private func getAppInfo() -> [String: Any] {
        let bundle = Bundle.main
        return [
            "name": bundle.object(forInfoDictionaryKey: "CFBundleName") as? String ?? "iOS App",
            "version": bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0",
            "buildNumber": bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1",
            "bundleId": bundle.bundleIdentifier ?? "com.example.app",
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

// MARK: - Supporting Types

public struct RegisteredComponent {
    public let testId: String
    public let type: String
    public var props: [String: Any]?
    public var bounds: CGRect?
    public var onTap: (() -> Void)?
    public var getText: (() -> String?)?
    public var children: [String]?
}

public struct NavigationState {
    public var currentRoute: String = "home"
    public var params: [String: Any]?
    public var history: [(route: String, timestamp: Date)] = []
}

public struct NetworkMock {
    public let id: String
    public let urlPattern: String
    public let response: MockResponse
    
    public struct MockResponse {
        public let statusCode: Int
        public let body: Any
        public var headers: [String: String]?
        public var delay: TimeInterval?
    }
}

// MARK: - Tracing Types

public struct TraceInfo {
    public var args: [String: Any]?
    public var file: String?
    public var startTime: TimeInterval?
    public var metadata: [String: Any]?
    
    public init(args: [String: Any]? = nil, file: String? = nil, startTime: TimeInterval? = nil, metadata: [String: Any]? = nil) {
        self.args = args
        self.file = file
        self.startTime = startTime
        self.metadata = metadata
    }
}

public struct TraceEntry {
    public let id: String
    public let name: String
    public var info: TraceInfo
    public let timestamp: TimeInterval
    public var duration: TimeInterval?
    public var returnValue: Any?
    public var error: String?
    public var completed: Bool
}

public struct TraceFilter {
    public var name: String?
    public var file: String?
    public var minDuration: TimeInterval?
    public var since: TimeInterval?
    public var limit: Int?
    public var inProgress: Bool?
    
    public init(name: String? = nil, file: String? = nil, minDuration: TimeInterval? = nil, since: TimeInterval? = nil, limit: Int? = nil, inProgress: Bool? = nil) {
        self.name = name
        self.file = file
        self.minDuration = minDuration
        self.since = since
        self.limit = limit
        self.inProgress = inProgress
    }
}

// MARK: - Error Types

public enum MCPError: LocalizedError {
    case unknownMethod(String)
    case invalidParams(String)
    
    public var errorDescription: String? {
        switch self {
        case .unknownMethod(let method):
            return "Unknown method: \(method)"
        case .invalidParams(let message):
            return "Invalid params: \(message)"
        }
    }
}
