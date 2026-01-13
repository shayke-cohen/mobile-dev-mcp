/**
 * MCP Demo App - iOS/SwiftUI
 *
 * Sample app demonstrating Mobile Dev MCP SDK integration.
 */

import SwiftUI

#if DEBUG
import MobileDevMCP
#endif

@main
struct MCPDemoApp: App {
    @StateObject private var appState = AppState()
    
    init() {
        #if DEBUG
        // Initialize MCP SDK
        MCPBridge.shared.initialize(serverUrl: "ws://localhost:8765")
        
        // This will be called later once appState is available
        print("[App] MCP SDK initialized")
        #endif
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .onAppear {
                    #if DEBUG
                    // Expose app state for MCP inspection
                    MCPBridge.shared.exposeState(key: "user") {
                        [
                            "currentUser": appState.currentUser as Any,
                            "isLoggedIn": appState.isLoggedIn
                        ]
                    }
                    
                    MCPBridge.shared.exposeState(key: "cart") {
                        [
                            "items": appState.cartItems.map { ["id": $0.id, "name": $0.name, "price": $0.price, "quantity": $0.quantity] },
                            "total": appState.cartTotal,
                            "itemCount": appState.cartItems.count
                        ]
                    }
                    
                    MCPBridge.shared.exposeState(key: "products") {
                        [
                            "items": appState.products.map { ["id": $0.id, "name": $0.name, "price": $0.price] },
                            "count": appState.products.count
                        ]
                    }
                    
                    // Register feature flags
                    MCPBridge.shared.registerFeatureFlags([
                        "dark_mode": false,
                        "new_checkout": false,
                        "show_recommendations": true
                    ])
                    
                    // Enable features
                    MCPBridge.shared.enableNetworkInterception()
                    MCPBridge.shared.enableLogCapture()
                    #endif
                }
        }
    }
}

// MARK: - App State

class AppState: ObservableObject {
    @Published var currentUser: User?
    @Published var isLoggedIn: Bool = false
    @Published var products: [Product] = []
    @Published var cartItems: [CartItem] = []
    @Published var selectedProduct: Product?
    @Published var isLoading: Bool = false
    
    var cartTotal: Double {
        cartItems.reduce(0) { $0 + ($1.price * Double($1.quantity)) }
    }
    
    init() {
        loadMockProducts()
    }
    
    func loadMockProducts() {
        products = [
            Product(id: "1", name: "Wireless Headphones", description: "High-quality wireless headphones with noise cancellation", price: 149.99, imageUrl: "headphones", category: "Electronics", rating: 4.5, inStock: true),
            Product(id: "2", name: "Smart Watch", description: "Feature-rich smartwatch with health tracking", price: 299.99, imageUrl: "watch", category: "Electronics", rating: 4.8, inStock: true),
            Product(id: "3", name: "Running Shoes", description: "Comfortable running shoes for everyday training", price: 89.99, imageUrl: "shoes", category: "Sports", rating: 4.3, inStock: true),
            Product(id: "4", name: "Laptop Stand", description: "Ergonomic aluminum laptop stand", price: 49.99, imageUrl: "stand", category: "Office", rating: 4.6, inStock: false),
            Product(id: "5", name: "Coffee Maker", description: "Automatic coffee maker with timer", price: 79.99, imageUrl: "coffee", category: "Home", rating: 4.2, inStock: true),
        ]
    }
    
    func login() {
        currentUser = User(id: "user_123", name: "John Doe", email: "john@example.com")
        isLoggedIn = true
        print("[AppState] User logged in: \(currentUser?.name ?? "unknown")")
    }
    
    func logout() {
        currentUser = nil
        isLoggedIn = false
        print("[AppState] User logged out")
    }
    
    func addToCart(_ product: Product) {
        if let index = cartItems.firstIndex(where: { $0.productId == product.id }) {
            cartItems[index].quantity += 1
        } else {
            cartItems.append(CartItem(productId: product.id, name: product.name, price: product.price, quantity: 1))
        }
        print("[AppState] Added to cart: \(product.name)")
    }
    
    func removeFromCart(_ productId: String) {
        cartItems.removeAll { $0.productId == productId }
        print("[AppState] Removed from cart: \(productId)")
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
        print("[AppState] Cart cleared")
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
    let imageUrl: String
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
