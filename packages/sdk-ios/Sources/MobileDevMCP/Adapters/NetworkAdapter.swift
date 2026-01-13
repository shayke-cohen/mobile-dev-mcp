/**
 * NetworkAdapter - Full network interception for iOS using URLProtocol
 */

import Foundation

// MARK: - Network Request Model

public struct CapturedRequest: Codable {
    let id: String
    let url: String
    let method: String
    let headers: [String: String]
    let body: String?
    let timestamp: String
    var response: CapturedResponse?
    var duration: Double?
}

public struct CapturedResponse: Codable {
    let statusCode: Int
    let headers: [String: String]
    let body: String?
    let error: String?
}

// MARK: - Mock Configuration

public struct MockConfig {
    let id: String
    let urlPattern: NSRegularExpression
    let response: MockResponse
}

public struct MockResponse {
    let statusCode: Int
    let headers: [String: String]
    let body: Data
    let delay: TimeInterval
}

// MARK: - Network Adapter

public class NetworkAdapter {
    
    public static let shared = NetworkAdapter()
    
    private var requests: [CapturedRequest] = []
    private var mocks: [MockConfig] = []
    private let maxRequests = 200
    private let queue = DispatchQueue(label: "com.mobiledevmcp.network", attributes: .concurrent)
    private var isEnabled = false
    private let dateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
    
    private init() {}
    
    // MARK: - Enable/Disable
    
    public func enable() {
        guard !isEnabled else { return }
        isEnabled = true
        
        // Register our custom URL protocol
        URLProtocol.registerClass(MCPURLProtocol.self)
        
        // Swizzle URLSession to capture all requests
        swizzleURLSession()
        
        print("[MCP NetworkAdapter] Enabled network interception")
    }
    
    public func disable() {
        guard isEnabled else { return }
        isEnabled = false
        
        URLProtocol.unregisterClass(MCPURLProtocol.self)
        
        print("[MCP NetworkAdapter] Disabled network interception")
    }
    
    // MARK: - Request Capture
    
    func captureRequest(_ request: URLRequest, id: String) {
        queue.async(flags: .barrier) {
            var captured = CapturedRequest(
                id: id,
                url: request.url?.absoluteString ?? "",
                method: request.httpMethod ?? "GET",
                headers: request.allHTTPHeaderFields ?? [:],
                body: request.httpBody.flatMap { String(data: $0, encoding: .utf8) },
                timestamp: self.dateFormatter.string(from: Date()),
                response: nil,
                duration: nil
            )
            
            self.requests.append(captured)
            
            // Limit stored requests
            if self.requests.count > self.maxRequests {
                self.requests.removeFirst(self.requests.count - self.maxRequests)
            }
        }
    }
    
    func captureResponse(id: String, response: HTTPURLResponse?, data: Data?, error: Error?, duration: Double) {
        queue.async(flags: .barrier) {
            guard let index = self.requests.firstIndex(where: { $0.id == id }) else { return }
            
            var captured = CapturedResponse(
                statusCode: response?.statusCode ?? 0,
                headers: (response?.allHeaderFields as? [String: String]) ?? [:],
                body: data.flatMap { self.bodyToString($0) },
                error: error?.localizedDescription
            )
            
            self.requests[index].response = captured
            self.requests[index].duration = duration
        }
    }
    
    private func bodyToString(_ data: Data) -> String? {
        // Try JSON first
        if let json = try? JSONSerialization.jsonObject(with: data),
           let jsonData = try? JSONSerialization.data(withJSONObject: json, options: .prettyPrinted) {
            return String(data: jsonData, encoding: .utf8)
        }
        
        // Fall back to string
        if let str = String(data: data, encoding: .utf8) {
            // Truncate large responses
            if str.count > 10000 {
                return String(str.prefix(10000)) + "... [truncated]"
            }
            return str
        }
        
        return "<binary data: \(data.count) bytes>"
    }
    
    // MARK: - List Requests
    
    public func listRequests(limit: Int = 50, filter: [String: Any]? = nil) -> [[String: Any]] {
        return queue.sync {
            var filtered = requests
            
            if let filter = filter {
                if let urlPattern = filter["url"] as? String,
                   let regex = try? NSRegularExpression(pattern: urlPattern) {
                    filtered = filtered.filter { req in
                        let range = NSRange(req.url.startIndex..., in: req.url)
                        return regex.firstMatch(in: req.url, range: range) != nil
                    }
                }
                
                if let method = filter["method"] as? String {
                    filtered = filtered.filter { $0.method.uppercased() == method.uppercased() }
                }
                
                if let statusCode = filter["statusCode"] as? Int {
                    filtered = filtered.filter { $0.response?.statusCode == statusCode }
                }
            }
            
            return filtered.suffix(limit).map { req in
                var dict: [String: Any] = [
                    "id": req.id,
                    "url": req.url,
                    "method": req.method,
                    "headers": req.headers,
                    "timestamp": req.timestamp
                ]
                
                if let body = req.body { dict["body"] = body }
                if let duration = req.duration { dict["duration"] = duration }
                
                if let resp = req.response {
                    dict["response"] = [
                        "statusCode": resp.statusCode,
                        "headers": resp.headers,
                        "body": resp.body as Any,
                        "error": resp.error as Any
                    ]
                }
                
                return dict
            }
        }
    }
    
    // MARK: - Mocking
    
    public func mockRequest(urlPattern: String, response: [String: Any]) -> [String: Any] {
        guard let regex = try? NSRegularExpression(pattern: urlPattern) else {
            return ["error": "Invalid URL pattern"]
        }
        
        let statusCode = response["statusCode"] as? Int ?? 200
        let headers = response["headers"] as? [String: String] ?? ["Content-Type": "application/json"]
        let delay = response["delay"] as? Double ?? 0
        
        var body: Data
        if let bodyDict = response["body"] {
            body = (try? JSONSerialization.data(withJSONObject: bodyDict)) ?? Data()
        } else {
            body = Data()
        }
        
        let mockId = "mock_\(Int(Date().timeIntervalSince1970 * 1000))"
        
        let mock = MockConfig(
            id: mockId,
            urlPattern: regex,
            response: MockResponse(
                statusCode: statusCode,
                headers: headers,
                body: body,
                delay: delay
            )
        )
        
        queue.async(flags: .barrier) {
            self.mocks.append(mock)
        }
        
        return [
            "mockId": mockId,
            "urlPattern": urlPattern,
            "success": true
        ]
    }
    
    public func clearMocks(mockId: String? = nil) -> [String: Any] {
        queue.async(flags: .barrier) {
            if let mockId = mockId {
                self.mocks.removeAll { $0.id == mockId }
            } else {
                self.mocks.removeAll()
            }
        }
        
        return [
            "success": true,
            "remainingMocks": mocks.count
        ]
    }
    
    func findMock(for url: URL) -> MockConfig? {
        return queue.sync {
            let urlString = url.absoluteString
            return mocks.first { mock in
                let range = NSRange(urlString.startIndex..., in: urlString)
                return mock.urlPattern.firstMatch(in: urlString, range: range) != nil
            }
        }
    }
    
    // MARK: - URL Session Swizzling
    
    private func swizzleURLSession() {
        // Swizzle dataTask to inject our protocol
        let originalSelector = #selector(URLSession.dataTask(with:completionHandler:) as (URLSession) -> (URLRequest, @escaping (Data?, URLResponse?, Error?) -> Void) -> URLSessionDataTask)
        let swizzledSelector = #selector(URLSession.mcp_dataTask(with:completionHandler:))
        
        guard let originalMethod = class_getInstanceMethod(URLSession.self, originalSelector),
              let swizzledMethod = class_getInstanceMethod(URLSession.self, swizzledSelector) else {
            return
        }
        
        method_exchangeImplementations(originalMethod, swizzledMethod)
    }
}

// MARK: - URLSession Extension for Swizzling

extension URLSession {
    @objc func mcp_dataTask(with request: URLRequest, completionHandler: @escaping (Data?, URLResponse?, Error?) -> Void) -> URLSessionDataTask {
        let requestId = UUID().uuidString
        let startTime = Date()
        
        // Capture request
        NetworkAdapter.shared.captureRequest(request, id: requestId)
        
        // Check for mocks
        if let url = request.url,
           let mock = NetworkAdapter.shared.findMock(for: url) {
            
            // Return mocked response
            DispatchQueue.main.asyncAfter(deadline: .now() + mock.response.delay) {
                let response = HTTPURLResponse(
                    url: url,
                    statusCode: mock.response.statusCode,
                    httpVersion: "HTTP/1.1",
                    headerFields: mock.response.headers
                )
                
                NetworkAdapter.shared.captureResponse(
                    id: requestId,
                    response: response,
                    data: mock.response.body,
                    error: nil,
                    duration: Date().timeIntervalSince(startTime) * 1000
                )
                
                completionHandler(mock.response.body, response, nil)
            }
            
            // Return a dummy task
            return self.mcp_dataTask(with: request) { _, _, _ in }
        }
        
        // Call original method (swizzled)
        return self.mcp_dataTask(with: request) { data, response, error in
            // Capture response
            NetworkAdapter.shared.captureResponse(
                id: requestId,
                response: response as? HTTPURLResponse,
                data: data,
                error: error,
                duration: Date().timeIntervalSince(startTime) * 1000
            )
            
            completionHandler(data, response, error)
        }
    }
}

// MARK: - Custom URL Protocol

class MCPURLProtocol: URLProtocol {
    
    private static let handledKey = "MCPURLProtocolHandled"
    
    override class func canInit(with request: URLRequest) -> Bool {
        // Don't handle if already handled
        if URLProtocol.property(forKey: handledKey, in: request) != nil {
            return false
        }
        
        // Only handle HTTP/HTTPS
        guard let scheme = request.url?.scheme?.lowercased() else { return false }
        return scheme == "http" || scheme == "https"
    }
    
    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        return request
    }
    
    override func startLoading() {
        guard let mutableRequest = (request as NSURLRequest).mutableCopy() as? NSMutableURLRequest else {
            return
        }
        
        // Mark as handled
        URLProtocol.setProperty(true, forKey: MCPURLProtocol.handledKey, in: mutableRequest)
        
        let requestId = UUID().uuidString
        let startTime = Date()
        
        // Capture request
        NetworkAdapter.shared.captureRequest(request, id: requestId)
        
        // Check for mock
        if let url = request.url,
           let mock = NetworkAdapter.shared.findMock(for: url) {
            
            DispatchQueue.main.asyncAfter(deadline: .now() + mock.response.delay) { [weak self] in
                guard let self = self else { return }
                
                let response = HTTPURLResponse(
                    url: url,
                    statusCode: mock.response.statusCode,
                    httpVersion: "HTTP/1.1",
                    headerFields: mock.response.headers
                )!
                
                NetworkAdapter.shared.captureResponse(
                    id: requestId,
                    response: response,
                    data: mock.response.body,
                    error: nil,
                    duration: Date().timeIntervalSince(startTime) * 1000
                )
                
                self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
                self.client?.urlProtocol(self, didLoad: mock.response.body)
                self.client?.urlProtocolDidFinishLoading(self)
            }
            return
        }
        
        // Make actual request
        let session = URLSession(configuration: .default)
        let task = session.dataTask(with: mutableRequest as URLRequest) { [weak self] data, response, error in
            guard let self = self else { return }
            
            // Capture response
            NetworkAdapter.shared.captureResponse(
                id: requestId,
                response: response as? HTTPURLResponse,
                data: data,
                error: error,
                duration: Date().timeIntervalSince(startTime) * 1000
            )
            
            if let error = error {
                self.client?.urlProtocol(self, didFailWithError: error)
                return
            }
            
            if let response = response {
                self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            }
            
            if let data = data {
                self.client?.urlProtocol(self, didLoad: data)
            }
            
            self.client?.urlProtocolDidFinishLoading(self)
        }
        
        task.resume()
    }
    
    override func stopLoading() {
        // Cancel if needed
    }
}
