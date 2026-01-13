/**
 * LogAdapter - Handles log capturing for iOS
 */

import Foundation

struct LogEntry {
    let level: String
    let message: String
    let timestamp: Date
}

struct ErrorEntry {
    let message: String
    let stack: String?
    let timestamp: Date
}

class LogAdapter {
    
    private var logs: [LogEntry] = []
    private var errors: [ErrorEntry] = []
    private let maxLogs = 500
    private let maxErrors = 50
    private var isEnabled = false
    
    func enable() {
        isEnabled = true
        // Note: Intercepting print() requires custom implementation
        // This provides basic log storage
        print("[MCP SDK] Log capture enabled")
    }
    
    func addLog(level: String, message: String) {
        guard isEnabled else { return }
        
        let entry = LogEntry(
            level: level,
            message: message,
            timestamp: Date()
        )
        
        logs.append(entry)
        if logs.count > maxLogs {
            logs = Array(logs.suffix(maxLogs))
        }
    }
    
    func addError(_ error: Error) {
        let entry = ErrorEntry(
            message: error.localizedDescription,
            stack: Thread.callStackSymbols.joined(separator: "\n"),
            timestamp: Date()
        )
        
        errors.append(entry)
        if errors.count > maxErrors {
            errors = Array(errors.suffix(maxErrors))
        }
    }
    
    func getLogs(params: [String: Any]) -> [String: Any] {
        let limit = params["limit"] as? Int ?? 100
        let level = params["level"] as? String
        
        var filtered = logs
        
        if let level = level {
            let levels = ["debug", "info", "warn", "error"]
            if let minIndex = levels.firstIndex(of: level) {
                filtered = filtered.filter { entry in
                    guard let entryIndex = levels.firstIndex(of: entry.level) else { return true }
                    return entryIndex >= minIndex
                }
            }
        }
        
        return [
            "logs": filtered.suffix(limit).map { log in
                [
                    "level": log.level,
                    "message": log.message,
                    "timestamp": ISO8601DateFormatter().string(from: log.timestamp)
                ]
            },
            "total": logs.count,
            "filtered": filtered.count
        ]
    }
    
    func getRecentErrors(params: [String: Any]) -> [String: Any] {
        let limit = params["limit"] as? Int ?? 10
        
        return [
            "errors": errors.suffix(limit).map { error in
                [
                    "message": error.message,
                    "stack": error.stack ?? "",
                    "timestamp": ISO8601DateFormatter().string(from: error.timestamp)
                ]
            },
            "total": errors.count
        ]
    }
}
