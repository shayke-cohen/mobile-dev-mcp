/**
 * MCP Demo App - iOS/SwiftUI (Standalone Version)
 */

import SwiftUI

@main
struct MCPDemoAppApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var mcpBridge = MCPBridge.shared
    
    init() {
        #if DEBUG
        initializeMCPSDK()
        #endif
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(mcpBridge)
                .onAppear {
                    exposeStatesToMCP()
                }
        }
    }
    
    private func initializeMCPSDK() {
        // SDK uses ws://localhost:8765 by default
        MCPBridge.shared.initialize(debug: true)
        MCPBridge.shared.enableLogCapture()
        MCPBridge.shared.enableNetworkInterception()
        MCPBridge.shared.registerFeatureFlags([
            "dark_mode": false,
            "new_checkout": false,
            "show_recommendations": true
        ])
    }
    
    private func exposeStatesToMCP() {
        MCPBridge.shared.exposeState(key: "currentUser") { [weak appState] in
            guard let user = appState?.currentUser else { return nil }
            return ["id": user.id, "name": user.name, "email": user.email]
        }
        
        MCPBridge.shared.exposeState(key: "user") { [weak appState] in
            guard let user = appState?.currentUser else { return nil }
            return ["id": user.id, "name": user.name, "email": user.email]
        }
        
        MCPBridge.shared.exposeState(key: "isLoggedIn") { [weak appState] in
            return appState?.isLoggedIn ?? false
        }
        
        MCPBridge.shared.exposeState(key: "products") { [weak appState] in
            return appState?.products.map { product in
                [
                    "id": product.id,
                    "name": product.name,
                    "price": product.price,
                    "category": product.category,
                    "inStock": product.inStock
                ]
            } ?? []
        }
        
        MCPBridge.shared.exposeState(key: "cart") { [weak appState] in
            return appState?.cartItems.map { item in
                [
                    "productId": item.productId,
                    "name": item.name,
                    "price": item.price,
                    "quantity": item.quantity
                ]
            } ?? []
        }
        
        MCPBridge.shared.exposeState(key: "cartTotal") { [weak appState] in
            return appState?.cartTotal ?? 0.0
        }
        
        MCPBridge.shared.exposeState(key: "cartCount") { [weak appState] in
            return appState?.cartItems.reduce(0) { $0 + $1.quantity } ?? 0
        }
        
        // Register action handlers
        registerActionHandlers()
    }
    
    private func registerActionHandlers() {
        // Cart actions
        MCPBridge.shared.registerAction(name: "addToCart") { [weak appState] params in
            guard let productId = params["productId"] as? String else {
                throw MCPError.invalidParams("productId is required")
            }
            guard let product = appState?.products.first(where: { $0.id == productId }) else {
                throw MCPError.invalidParams("Product not found: \(productId)")
            }
            guard product.inStock else {
                throw MCPError.invalidParams("Product out of stock: \(product.name)")
            }
            DispatchQueue.main.async {
                appState?.addToCart(product)
            }
            return ["added": product.name, "productId": productId]
        }
        
        MCPBridge.shared.registerAction(name: "removeFromCart") { [weak appState] params in
            guard let productId = params["productId"] as? String else {
                throw MCPError.invalidParams("productId is required")
            }
            DispatchQueue.main.async {
                appState?.removeFromCart(productId)
            }
            return ["removed": productId]
        }
        
        MCPBridge.shared.registerAction(name: "clearCart") { [weak appState] _ in
            DispatchQueue.main.async {
                appState?.clearCart()
            }
            return ["cleared": true]
        }
        
        MCPBridge.shared.registerAction(name: "updateQuantity") { [weak appState] params in
            guard let productId = params["productId"] as? String else {
                throw MCPError.invalidParams("productId is required")
            }
            let delta = params["delta"] as? Int ?? 1
            if let currentItem = appState?.cartItems.first(where: { $0.productId == productId }) {
                let newQuantity = currentItem.quantity + delta
                DispatchQueue.main.async {
                    appState?.updateQuantity(productId, quantity: newQuantity)
                }
            }
            return ["updated": productId, "delta": delta]
        }
        
        // User actions
        MCPBridge.shared.registerAction(name: "login") { [weak appState] _ in
            DispatchQueue.main.async {
                appState?.login()
            }
            return ["loggedIn": true, "user": ["id": "user_123", "name": "John Doe"]]
        }
        
        MCPBridge.shared.registerAction(name: "logout") { [weak appState] _ in
            DispatchQueue.main.async {
                appState?.logout()
            }
            return ["loggedOut": true]
        }
        
        // Navigation is handled by TabView - not programmatic in this app
        MCPBridge.shared.registerAction(name: "navigate") { params in
            // iOS TabView doesn't support programmatic navigation easily
            // Return success but note that navigation isn't supported
            let route = params["route"] as? String ?? "unknown"
            return ["navigatedTo": route, "note": "iOS TabView navigation not programmatic"]
        }
    }
}

// MARK: - App State

class AppState: ObservableObject {
    @Published var currentUser: User?
    @Published var isLoggedIn: Bool = false
    @Published var products: [Product] = []
    @Published var cartItems: [CartItem] = []
    
    var cartTotal: Double {
        cartItems.reduce(0) { $0 + ($1.price * Double($1.quantity)) }
    }
    
    init() {
        loadMockProducts()
    }
    
    func loadMockProducts() {
        products = [
            Product(id: "1", name: "Wireless Headphones", description: "High-quality wireless headphones with noise cancellation", price: 149.99, category: "Electronics", rating: 4.5, inStock: true),
            Product(id: "2", name: "Smart Watch", description: "Feature-rich smartwatch with health tracking", price: 299.99, category: "Electronics", rating: 4.8, inStock: true),
            Product(id: "3", name: "Running Shoes", description: "Comfortable running shoes for everyday training", price: 89.99, category: "Sports", rating: 4.3, inStock: true),
            Product(id: "4", name: "Laptop Stand", description: "Ergonomic aluminum laptop stand", price: 49.99, category: "Office", rating: 4.6, inStock: false),
            Product(id: "5", name: "Coffee Maker", description: "Automatic coffee maker with timer", price: 79.99, category: "Home", rating: 4.2, inStock: true),
        ]
    }
    
    func login() {
        currentUser = User(id: "user_123", name: "John Doe", email: "john@example.com")
        isLoggedIn = true
    }
    
    func logout() {
        currentUser = nil
        isLoggedIn = false
    }
    
    func addToCart(_ product: Product) {
        if let index = cartItems.firstIndex(where: { $0.productId == product.id }) {
            cartItems[index].quantity += 1
        } else {
            cartItems.append(CartItem(productId: product.id, name: product.name, price: product.price, quantity: 1))
        }
    }
    
    func removeFromCart(_ productId: String) {
        cartItems.removeAll { $0.productId == productId }
    }
    
    func updateQuantity(_ productId: String, quantity: Int) {
        if let index = cartItems.firstIndex(where: { $0.productId == productId }) {
            if quantity <= 0 {
                cartItems.remove(at: index)
            } else {
                cartItems[index].quantity = quantity
            }
        }
    }
    
    func clearCart() {
        cartItems.removeAll()
    }
}

// MARK: - Models

struct User: Identifiable, Codable {
    let id: String
    let name: String
    let email: String
}

struct Product: Identifiable, Codable {
    let id: String
    let name: String
    let description: String
    let price: Double
    let category: String
    let rating: Double
    let inStock: Bool
}

struct CartItem: Identifiable, Codable {
    var id: String { productId }
    let productId: String
    let name: String
    let price: Double
    var quantity: Int
}
