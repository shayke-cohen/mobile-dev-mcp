/**
 * NetworkAdapter - Handles network interception for iOS
 */

import Foundation

struct NetworkRequest {
    let id: String
    let url: String
    let method: String
    let headers: [String: String]
    let body: Data?
    let timestamp: Date
    var response: NetworkResponse?
}

struct NetworkResponse {
    let statusCode: Int
    let headers: [String: String]
    let body: Data?
    let duration: TimeInterval
}

class NetworkAdapter {
    
    private var requests: [NetworkRequest] = []
    private let maxRequests = 200
    private var isEnabled = false
    
    func enable() {
        isEnabled = true
        // Note: Full network interception requires URLProtocol subclass
        // This is a simplified implementation
        print("[MCP SDK] Network interception enabled (limited mode)")
    }
    
    func listRequests(params: [String: Any]) -> [String: Any] {
        let limit = params["limit"] as? Int ?? 50
        
        let filtered = requests.suffix(limit)
        
        return [
            "requests": filtered.map { request in
                var dict: [String: Any] = [
                    "id": request.id,
                    "url": request.url,
                    "method": request.method,
                    "headers": request.headers,
                    "timestamp": ISO8601DateFormatter().string(from: request.timestamp)
                ]
                
                if let response = request.response {
                    dict["response"] = [
                        "statusCode": response.statusCode,
                        "headers": response.headers,
                        "duration": response.duration
                    ]
                }
                
                return dict
            },
            "total": requests.count,
            "filtered": filtered.count
        ]
    }
    
    func addRequest(_ request: NetworkRequest) {
        requests.append(request)
        if requests.count > maxRequests {
            requests = Array(requests.suffix(maxRequests))
        }
    }
}
