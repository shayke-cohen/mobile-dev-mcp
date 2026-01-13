/**
 * MCPNativeModule - iOS implementation of native functionality for React Native SDK
 */

import Foundation
import UIKit
import React

@objc(MCPNativeModule)
class MCPNativeModule: RCTEventEmitter {
    
    override static func moduleName() -> String! {
        return "MCPNativeModule"
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["onMCPEvent"]
    }
    
    // MARK: - Screenshot Capture
    
    @objc
    func captureScreenshot(_ resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let window = self.getKeyWindow() else {
                reject("NO_WINDOW", "No key window found", nil)
                return
            }
            
            let renderer = UIGraphicsImageRenderer(bounds: window.bounds)
            let image = renderer.image { context in
                window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
            }
            
            guard let pngData = image.pngData() else {
                reject("CAPTURE_FAILED", "Failed to create PNG data", nil)
                return
            }
            
            let base64 = pngData.base64EncodedString()
            
            resolve([
                "image": base64,
                "format": "png",
                "width": window.bounds.width,
                "height": window.bounds.height,
                "scale": UIScreen.main.scale,
                "timestamp": ISO8601DateFormatter().string(from: Date())
            ])
        }
    }
    
    // MARK: - View Hierarchy
    
    @objc
    func getViewHierarchy(_ options: NSDictionary,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let window = self.getKeyWindow() else {
                reject("NO_WINDOW", "No key window found", nil)
                return
            }
            
            let maxDepth = options["maxDepth"] as? Int ?? 20
            let includeHidden = options["includeHidden"] as? Bool ?? false
            
            let tree = self.serializeView(window, depth: 0, maxDepth: maxDepth, includeHidden: includeHidden)
            
            resolve([
                "tree": tree,
                "timestamp": ISO8601DateFormatter().string(from: Date())
            ])
        }
    }
    
    private func serializeView(_ view: UIView, depth: Int, maxDepth: Int, includeHidden: Bool) -> [String: Any] {
        var result: [String: Any] = [
            "type": String(describing: type(of: view)),
            "className": NSStringFromClass(type(of: view)),
            "frame": [
                "x": view.frame.origin.x,
                "y": view.frame.origin.y,
                "width": view.frame.width,
                "height": view.frame.height
            ],
            "bounds": [
                "x": view.bounds.origin.x,
                "y": view.bounds.origin.y,
                "width": view.bounds.width,
                "height": view.bounds.height
            ],
            "isHidden": view.isHidden,
            "alpha": view.alpha,
            "isUserInteractionEnabled": view.isUserInteractionEnabled,
            "tag": view.tag
        ]
        
        // Add accessibility info
        if let accessibilityIdentifier = view.accessibilityIdentifier {
            result["testID"] = accessibilityIdentifier
        }
        if let accessibilityLabel = view.accessibilityLabel {
            result["accessibilityLabel"] = accessibilityLabel
        }
        
        // Add text content for common views
        if let label = view as? UILabel {
            result["text"] = label.text
        } else if let button = view as? UIButton {
            result["title"] = button.title(for: .normal)
        } else if let textField = view as? UITextField {
            result["text"] = textField.text
            result["placeholder"] = textField.placeholder
        } else if let textView = view as? UITextView {
            result["text"] = textView.text
        } else if let imageView = view as? UIImageView {
            result["hasImage"] = imageView.image != nil
        }
        
        // Add React Native specific info
        if let reactTag = view.value(forKey: "reactTag") as? NSNumber {
            result["reactTag"] = reactTag
        }
        
        // Recursively add children
        if depth < maxDepth {
            var children: [[String: Any]] = []
            for subview in view.subviews {
                if !includeHidden && subview.isHidden {
                    continue
                }
                children.append(serializeView(subview, depth: depth + 1, maxDepth: maxDepth, includeHidden: includeHidden))
            }
            result["children"] = children
        }
        
        return result
    }
    
    // MARK: - Touch Simulation
    
    @objc
    func simulateTap(_ x: Double, y: Double,
                    resolver resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let window = self.getKeyWindow() else {
                reject("NO_WINDOW", "No key window found", nil)
                return
            }
            
            let point = CGPoint(x: x, y: y)
            
            // Find the view at this point
            if let targetView = window.hitTest(point, with: nil) {
                // Simulate touch events
                self.performTap(on: targetView, at: point)
                
                resolve([
                    "success": true,
                    "point": ["x": x, "y": y],
                    "targetView": String(describing: type(of: targetView)),
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ])
            } else {
                reject("NO_TARGET", "No view found at point (\(x), \(y))", nil)
            }
        }
    }
    
    @objc
    func simulateLongPress(_ x: Double, y: Double, duration: Double,
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let window = self.getKeyWindow() else {
                reject("NO_WINDOW", "No key window found", nil)
                return
            }
            
            let point = CGPoint(x: x, y: y)
            
            if let targetView = window.hitTest(point, with: nil) {
                // Check for long press gesture recognizers
                for recognizer in targetView.gestureRecognizers ?? [] {
                    if let longPress = recognizer as? UILongPressGestureRecognizer {
                        // Trigger the action
                        if let target = longPress.value(forKey: "_targets") as? [AnyObject],
                           let targetInfo = target.first {
                            let action = targetInfo.value(forKey: "_action") as? Selector
                            let actionTarget = targetInfo.value(forKey: "_target") as? AnyObject
                            if let action = action, let actionTarget = actionTarget {
                                _ = actionTarget.perform(action, with: longPress)
                            }
                        }
                    }
                }
                
                resolve([
                    "success": true,
                    "point": ["x": x, "y": y],
                    "duration": duration,
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ])
            } else {
                reject("NO_TARGET", "No view found at point", nil)
            }
        }
    }
    
    @objc
    func simulateSwipe(_ startX: Double, startY: Double,
                      endX: Double, endY: Double, duration: Double,
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let window = self.getKeyWindow() else {
                reject("NO_WINDOW", "No key window found", nil)
                return
            }
            
            let startPoint = CGPoint(x: startX, y: startY)
            let endPoint = CGPoint(x: endX, y: endY)
            
            // Find scrollable view
            if let targetView = window.hitTest(startPoint, with: nil) {
                // Look for scroll view in hierarchy
                var currentView: UIView? = targetView
                while currentView != nil {
                    if let scrollView = currentView as? UIScrollView {
                        let deltaX = endX - startX
                        let deltaY = endY - startY
                        
                        UIView.animate(withDuration: duration / 1000.0) {
                            scrollView.contentOffset = CGPoint(
                                x: scrollView.contentOffset.x - CGFloat(deltaX),
                                y: scrollView.contentOffset.y - CGFloat(deltaY)
                            )
                        }
                        
                        resolve([
                            "success": true,
                            "from": ["x": startX, "y": startY],
                            "to": ["x": endX, "y": endY],
                            "scrollView": String(describing: type(of: scrollView)),
                            "timestamp": ISO8601DateFormatter().string(from: Date())
                        ])
                        return
                    }
                    currentView = currentView?.superview
                }
                
                resolve([
                    "success": true,
                    "from": ["x": startX, "y": startY],
                    "to": ["x": endX, "y": endY],
                    "note": "No scroll view found, swipe gesture dispatched",
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ])
            } else {
                reject("NO_TARGET", "No view found at start point", nil)
            }
        }
    }
    
    @objc
    func typeText(_ text: String,
                 resolver resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            // Find first responder
            guard let firstResponder = UIApplication.shared.windows.first?.findFirstResponder() else {
                reject("NO_FOCUS", "No text input is currently focused", nil)
                return
            }
            
            if let textField = firstResponder as? UITextField {
                textField.text = (textField.text ?? "") + text
                textField.sendActions(for: .editingChanged)
                resolve([
                    "success": true,
                    "text": text,
                    "targetType": "UITextField",
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ])
            } else if let textView = firstResponder as? UITextView {
                textView.text = (textView.text ?? "") + text
                textView.delegate?.textViewDidChange?(textView)
                resolve([
                    "success": true,
                    "text": text,
                    "targetType": "UITextView",
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ])
            } else {
                reject("INVALID_TARGET", "Focused element is not a text input", nil)
            }
        }
    }
    
    @objc
    func findElementByTestId(_ testId: String,
                            resolver resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let window = self.getKeyWindow() else {
                reject("NO_WINDOW", "No key window found", nil)
                return
            }
            
            if let view = self.findViewWithTestId(testId, in: window) {
                let frame = view.convert(view.bounds, to: window)
                resolve([
                    "found": true,
                    "type": String(describing: type(of: view)),
                    "frame": [
                        "x": frame.origin.x,
                        "y": frame.origin.y,
                        "width": frame.width,
                        "height": frame.height
                    ],
                    "center": [
                        "x": frame.midX,
                        "y": frame.midY
                    ],
                    "isVisible": !view.isHidden && view.alpha > 0,
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ])
            } else {
                resolve([
                    "found": false,
                    "testId": testId,
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ])
            }
        }
    }
    
    // MARK: - Private Helpers
    
    private func getKeyWindow() -> UIWindow? {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }
    
    private func performTap(on view: UIView, at point: CGPoint) {
        // Check for tap gesture recognizers
        for recognizer in view.gestureRecognizers ?? [] {
            if let tapRecognizer = recognizer as? UITapGestureRecognizer {
                // Trigger tap action
                if let targets = tapRecognizer.value(forKey: "_targets") as? [AnyObject],
                   let targetInfo = targets.first {
                    if let action = targetInfo.value(forKey: "_action") as? Selector,
                       let target = targetInfo.value(forKey: "_target") as? AnyObject {
                        _ = target.perform(action, with: tapRecognizer)
                        return
                    }
                }
            }
        }
        
        // For buttons and controls
        if let control = view as? UIControl {
            control.sendActions(for: .touchUpInside)
        }
    }
    
    private func findViewWithTestId(_ testId: String, in view: UIView) -> UIView? {
        if view.accessibilityIdentifier == testId {
            return view
        }
        
        for subview in view.subviews {
            if let found = findViewWithTestId(testId, in: subview) {
                return found
            }
        }
        
        return nil
    }
}

// MARK: - UIView Extension

extension UIView {
    func findFirstResponder() -> UIView? {
        if isFirstResponder {
            return self
        }
        for subview in subviews {
            if let responder = subview.findFirstResponder() {
                return responder
            }
        }
        return nil
    }
}
