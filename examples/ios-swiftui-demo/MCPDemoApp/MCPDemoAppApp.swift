/**
 * MCP Demo App - iOS/SwiftUI (Standalone Version)
 */

import SwiftUI

@main
struct MCPDemoAppApp: App {
    @StateObject private var appState = AppState()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
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
