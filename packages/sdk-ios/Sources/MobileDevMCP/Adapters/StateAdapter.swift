/**
 * StateAdapter - Handles state inspection for iOS
 */

import Foundation

class StateAdapter {
    
    private var stateGetters: [String: () -> Any?] = [:]
    private var featureFlags: [String: Bool] = [:]
    
    func register(key: String, getter: @escaping () -> Any?) {
        stateGetters[key] = getter
    }
    
    func registerFeatureFlags(_ flags: [String: Bool]) {
        featureFlags.merge(flags) { _, new in new }
    }
    
    func getState(params: [String: Any]) throws -> [String: Any] {
        let path = params["path"] as? String
        
        if let path = path {
            let parts = path.split(separator: ".").map(String.init)
            guard let rootKey = parts.first,
                  let getter = stateGetters[rootKey] else {
                throw MCPError.invalidParams("State '\(parts.first ?? "")' not exposed")
            }
            
            var value: Any? = getter()
            
            // Navigate to nested path
            for i in 1..<parts.count {
                guard let dict = value as? [String: Any] else { break }
                value = dict[parts[i]]
            }
            
            return [
                "path": path,
                "value": value ?? NSNull(),
                "timestamp": ISO8601DateFormatter().string(from: Date())
            ]
        }
        
        // Return all exposed state
        var allState: [String: Any] = [:]
        for (key, getter) in stateGetters {
            allState[key] = getter() ?? NSNull()
        }
        
        return [
            "state": allState,
            "exposedKeys": Array(stateGetters.keys),
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
    }
    
    func getNavigationState() -> [String: Any] {
        // This would integrate with SwiftUI NavigationStack or UIKit navigation
        return [
            "message": "Navigation state inspection requires setting up navigation ref",
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
    }
    
    func getFeatureFlags() -> [String: Any] {
        return [
            "flags": featureFlags,
            "count": featureFlags.count
        ]
    }
    
    func toggleFeatureFlag(params: [String: Any]) throws -> [String: Any] {
        guard let flagName = params["flagName"] as? String,
              let enabled = params["enabled"] as? Bool else {
            throw MCPError.invalidParams("flagName and enabled are required")
        }
        
        guard featureFlags[flagName] != nil else {
            throw MCPError.invalidParams("Feature flag '\(flagName)' not registered")
        }
        
        let previousValue = featureFlags[flagName]
        featureFlags[flagName] = enabled
        
        return [
            "flagName": flagName,
            "enabled": enabled,
            "previousValue": previousValue ?? NSNull(),
            "success": true
        ]
    }
}
