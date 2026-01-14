/**
 * WebSocket client for iOS
 */

import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// WebSocket client delegate protocol
protocol WebSocketClientDelegate: AnyObject {
    func webSocketDidConnect()
    func webSocketDidDisconnect(error: Error?)
    func webSocketDidReceiveCommand(_ command: MCPCommand)
}

/// MCP Command structure
struct MCPCommand {
    let id: String
    let method: String
    let params: [String: Any]
}

/// WebSocket client implementation
class WebSocketClient: NSObject {
    
    private let url: URL
    private weak var delegate: WebSocketClientDelegate?
    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession?
    private var reconnectTimer: Timer?
    private let reconnectInterval: TimeInterval = 3.0
    
    private(set) var isConnected = false
    
    init(url: URL, delegate: WebSocketClientDelegate) {
        self.url = url
        self.delegate = delegate
        super.init()
    }
    
    func connect() {
        let configuration = URLSessionConfiguration.default
        session = URLSession(configuration: configuration, delegate: self, delegateQueue: .main)
        webSocket = session?.webSocketTask(with: url)
        webSocket?.resume()
        receiveMessage()
    }
    
    func disconnect() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        isConnected = false
    }
    
    func sendResponse(id: String, result: Any?) {
        let response: [String: Any] = [
            "jsonrpc": "2.0",
            "id": id,
            "result": result ?? NSNull()
        ]
        send(response)
    }
    
    func sendError(id: String, message: String) {
        let response: [String: Any] = [
            "jsonrpc": "2.0",
            "id": id,
            "error": [
                "code": -32000,
                "message": message
            ]
        ]
        send(response)
    }
    
    // MARK: - Private
    
    private func send(_ dictionary: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dictionary),
              let string = String(data: data, encoding: .utf8) else {
            return
        }
        
        webSocket?.send(.string(string)) { error in
            if let error = error {
                print("[MCP WS] Send error: \(error.localizedDescription)")
            }
        }
    }
    
    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
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
                // Continue listening
                self?.receiveMessage()
                
            case .failure(let error):
                print("[MCP WS] Receive error: \(error.localizedDescription)")
            }
        }
    }
    
    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }
        
        // Handle handshake acknowledgment
        if json["type"] as? String == "handshake_ack" {
            print("[MCP WS] Handshake acknowledged")
            return
        }
        
        // Handle command
        if let id = json["id"] as? String,
           let method = json["method"] as? String {
            let params = json["params"] as? [String: Any] ?? [:]
            let command = MCPCommand(id: id, method: method, params: params)
            delegate?.webSocketDidReceiveCommand(command)
        }
    }
    
    private func sendHandshake() {
        var osVersion = "unknown"
        var platform = "unknown"
        
        #if canImport(UIKit)
        let device = UIDevice.current
        osVersion = device.systemVersion
        platform = "ios"
        #elseif os(macOS)
        let version = ProcessInfo.processInfo.operatingSystemVersion
        osVersion = "\(version.majorVersion).\(version.minorVersion).\(version.patchVersion)"
        platform = "macos"
        #endif
        
        let handshake: [String: Any] = [
            "type": "handshake",
            "platform": platform,
            "osVersion": osVersion,
            "appName": Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String ?? "Unknown",
            "appVersion": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0",
            "capabilities": ["state", "network", "logs", "ui", "screenshot", "tracing"]
        ]
        send(handshake)
    }
    
    private func scheduleReconnect() {
        reconnectTimer?.invalidate()
        reconnectTimer = Timer.scheduledTimer(withTimeInterval: reconnectInterval, repeats: false) { [weak self] _ in
            self?.connect()
        }
    }
}

// MARK: - URLSessionWebSocketDelegate

extension WebSocketClient: URLSessionWebSocketDelegate {
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        isConnected = true
        sendHandshake()
        delegate?.webSocketDidConnect()
    }
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        isConnected = false
        delegate?.webSocketDidDisconnect(error: nil)
        scheduleReconnect()
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        isConnected = false
        delegate?.webSocketDidDisconnect(error: error)
        scheduleReconnect()
    }
}
