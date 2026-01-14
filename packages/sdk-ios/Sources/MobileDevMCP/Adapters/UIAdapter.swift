/**
 * UIAdapter - Handles UI inspection for iOS
 */

import Foundation
#if canImport(UIKit)
import UIKit
#endif

class UIAdapter {
    
    private var isEnabled = false
    
    func enable() {
        isEnabled = true
    }
    
    #if canImport(UIKit)
    @MainActor
    func captureScreenshot() throws -> [String: Any] {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }) else {
            throw MCPError.invalidParams("No key window found")
        }
        
        let renderer = UIGraphicsImageRenderer(bounds: window.bounds)
        let image = renderer.image { context in
            window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
        }
        
        guard let data = image.pngData() else {
            throw MCPError.invalidParams("Failed to create PNG data")
        }
        
        return [
            "image": data.base64EncodedString(),
            "format": "png",
            "dimensions": [
                "width": window.bounds.width,
                "height": window.bounds.height
            ],
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
    }
    
    func getViewHierarchy() -> [String: Any] {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }) else {
            return ["error": "No key window found"]
        }
        
        return [
            "tree": serializeView(window),
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
    }
    
    private func serializeView(_ view: UIView, depth: Int = 0) -> [String: Any] {
        var result: [String: Any] = [
            "type": String(describing: type(of: view)),
            "frame": [
                "x": view.frame.origin.x,
                "y": view.frame.origin.y,
                "width": view.frame.width,
                "height": view.frame.height
            ],
            "isHidden": view.isHidden,
            "alpha": view.alpha
        ]
        
        if let accessibilityIdentifier = view.accessibilityIdentifier {
            result["accessibilityIdentifier"] = accessibilityIdentifier
        }
        
        if let accessibilityLabel = view.accessibilityLabel {
            result["accessibilityLabel"] = accessibilityLabel
        }
        
        if depth < 10 {
            result["children"] = view.subviews.map { serializeView($0, depth: depth + 1) }
        }
        
        return result
    }
    #else
    // macOS stubs
    func captureScreenshot() throws -> [String: Any] {
        return ["error": "Screenshot not supported on macOS"]
    }
    
    func getViewHierarchy() -> [String: Any] {
        return ["error": "View hierarchy not supported on macOS"]
    }
    #endif
}
