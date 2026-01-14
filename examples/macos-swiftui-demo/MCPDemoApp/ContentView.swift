/**
 * ContentView - macOS SwiftUI Demo
 * 
 * Main content view with sidebar navigation
 */

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var mcpBridge: MCPBridge
    
    var body: some View {
        NavigationSplitView {
            // Sidebar
            List {
                NavigationLink(value: "home") {
                    Label("Home", systemImage: "house")
                }
                
                NavigationLink(value: "products") {
                    Label("Products", systemImage: "bag")
                }
                
                NavigationLink(value: "cart") {
                    Label("Cart (\(cartItemCount))", systemImage: "cart")
                }
                
                NavigationLink(value: "profile") {
                    Label("Profile", systemImage: "person")
                }
                
                Divider()
                
                // MCP Status
                MCPStatusView()
            }
            .listStyle(.sidebar)
            .navigationSplitViewColumnWidth(min: 200, ideal: 220, max: 300)
        } detail: {
            // Main content
            NavigationStack {
                switch appState.currentView {
                case "products":
                    ProductsView()
                case "cart":
                    CartView()
                case "profile":
                    ProfileView()
                default:
                    HomeView()
                }
            }
        }
        .navigationSplitViewStyle(.balanced)
        .onChange(of: appState.currentView) { _, newValue in
            MCPBridge.shared.setNavigationState(route: newValue)
        }
    }
    
    private var cartItemCount: Int {
        appState.cartItems.reduce(0) { $0 + $1.quantity }
    }
}

// MARK: - Home View

struct HomeView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Welcome Section
                VStack(alignment: .leading, spacing: 8) {
                    Text("🛍️ MCP Demo Store")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text(appState.isLoggedIn ? "Welcome back, \(appState.currentUser?.name ?? "User")!" : "Welcome to MCP Demo Store")
                        .font(.title2)
                        .foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.accentColor.opacity(0.1))
                .cornerRadius(12)
                
                // Quick Actions
                Text("Quick Actions")
                    .font(.headline)
                
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    QuickActionCard(title: "Browse Products", icon: "bag.fill", color: .blue) {
                        appState.currentView = "products"
                    }
                    
                    QuickActionCard(title: "View Cart", icon: "cart.fill", color: .green) {
                        appState.currentView = "cart"
                    }
                    
                    QuickActionCard(title: "My Profile", icon: "person.fill", color: .purple) {
                        appState.currentView = "profile"
                    }
                    
                    QuickActionCard(title: "Featured", icon: "star.fill", color: .orange) {
                        appState.currentView = "products"
                    }
                }
                
                // Featured Products
                Text("Featured Products")
                    .font(.headline)
                
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    ForEach(appState.products.prefix(3)) { product in
                        ProductCard(product: product, compact: true)
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Home")
    }
}

// MARK: - Products View

struct ProductsView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 20) {
                ForEach(appState.products) { product in
                    ProductCard(product: product, compact: false)
                }
            }
            .padding()
        }
        .navigationTitle("Products")
    }
}

// MARK: - Cart View

struct CartView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack(spacing: 0) {
            if appState.cartItems.isEmpty {
                ContentUnavailableView(
                    "Your cart is empty",
                    systemImage: "cart",
                    description: Text("Add some products to get started")
                )
            } else {
                List {
                    ForEach(appState.cartItems) { item in
                        CartItemRow(item: item)
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            appState.removeFromCart(appState.cartItems[index].productId)
                        }
                    }
                }
                .listStyle(.inset)
                
                // Cart Summary
                VStack(spacing: 12) {
                    Divider()
                    
                    HStack {
                        Text("Total")
                            .font(.headline)
                        Spacer()
                        Text(String(format: "$%.2f", appState.cartTotal))
                            .font(.title2)
                            .fontWeight(.bold)
                    }
                    
                    Button(action: {
                        // Checkout action
                    }) {
                        Text("Checkout")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    
                    Button(action: {
                        appState.clearCart()
                    }) {
                        Text("Clear Cart")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }
                .padding()
            }
        }
        .navigationTitle("Cart")
    }
}

// MARK: - Profile View

struct ProfileView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack(spacing: 24) {
            if appState.isLoggedIn {
                // User Info
                VStack(spacing: 16) {
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.accentColor)
                    
                    Text(appState.currentUser?.name ?? "User")
                        .font(.title)
                        .fontWeight(.bold)
                    
                    Text(appState.currentUser?.email ?? "")
                        .foregroundColor(.secondary)
                }
                
                Divider()
                
                // Stats
                HStack(spacing: 40) {
                    VStack {
                        Text("\(appState.cartItems.count)")
                            .font(.title)
                            .fontWeight(.bold)
                        Text("Items in Cart")
                            .foregroundColor(.secondary)
                    }
                    
                    VStack {
                        Text(String(format: "$%.2f", appState.cartTotal))
                            .font(.title)
                            .fontWeight(.bold)
                        Text("Cart Total")
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                Button(action: {
                    appState.logout()
                }) {
                    Label("Sign Out", systemImage: "arrow.right.square")
                        .frame(maxWidth: 200)
                }
                .buttonStyle(.bordered)
            } else {
                // Not logged in
                VStack(spacing: 16) {
                    Image(systemName: "person.circle")
                        .font(.system(size: 80))
                        .foregroundColor(.secondary)
                    
                    Text("Not Signed In")
                        .font(.title)
                        .fontWeight(.bold)
                    
                    Text("Sign in to access your profile")
                        .foregroundColor(.secondary)
                    
                    Button(action: {
                        appState.login()
                    }) {
                        Label("Sign In", systemImage: "person.badge.plus")
                            .frame(maxWidth: 200)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle("Profile")
    }
}

// MARK: - Supporting Views

struct QuickActionCard: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title)
                    .foregroundColor(color)
                
                Text(title)
                    .font(.headline)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(color.opacity(0.1))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

struct ProductCard: View {
    @EnvironmentObject var appState: AppState
    let product: Product
    let compact: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Product Image Placeholder
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.secondary.opacity(0.2))
                .frame(height: compact ? 100 : 150)
                .overlay(
                    Image(systemName: "shippingbox")
                        .font(.system(size: compact ? 30 : 40))
                        .foregroundColor(.secondary)
                )
            
            VStack(alignment: .leading, spacing: 4) {
                Text(product.name)
                    .font(.headline)
                    .lineLimit(1)
                
                if !compact {
                    Text(product.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                HStack {
                    Text(String(format: "$%.2f", product.price))
                        .font(.title3)
                        .fontWeight(.bold)
                    
                    Spacer()
                    
                    if product.inStock {
                        Text("In Stock")
                            .font(.caption)
                            .foregroundColor(.green)
                    } else {
                        Text("Out of Stock")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
            }
            
            Button(action: {
                if product.inStock {
                    appState.addToCart(product)
                }
            }) {
                Text(product.inStock ? "Add to Cart" : "Out of Stock")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(!product.inStock)
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(12)
    }
}

struct CartItemRow: View {
    @EnvironmentObject var appState: AppState
    let item: CartItem
    
    var body: some View {
        HStack(spacing: 12) {
            // Item Image Placeholder
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.secondary.opacity(0.2))
                .frame(width: 60, height: 60)
                .overlay(
                    Image(systemName: "shippingbox")
                        .foregroundColor(.secondary)
                )
            
            VStack(alignment: .leading) {
                Text(item.name)
                    .fontWeight(.medium)
                Text(String(format: "$%.2f", item.price))
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Quantity Controls
            HStack(spacing: 8) {
                Button(action: {
                    appState.updateQuantity(item.productId, quantity: item.quantity - 1)
                }) {
                    Image(systemName: "minus.circle")
                }
                .buttonStyle(.plain)
                
                Text("\(item.quantity)")
                    .frame(width: 30)
                
                Button(action: {
                    appState.updateQuantity(item.productId, quantity: item.quantity + 1)
                }) {
                    Image(systemName: "plus.circle")
                }
                .buttonStyle(.plain)
            }
            
            Text(String(format: "$%.2f", item.price * Double(item.quantity)))
                .fontWeight(.bold)
                .frame(width: 70, alignment: .trailing)
        }
        .padding(.vertical, 4)
    }
}

struct MCPStatusView: View {
    @EnvironmentObject var mcpBridge: MCPBridge
    @State private var showActivityLog = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle()
                    .fill(mcpBridge.isConnected ? Color.green : Color.red)
                    .frame(width: 8, height: 8)
                
                Text("MCP SDK")
                    .font(.caption)
                    .fontWeight(.semibold)
            }
            
            Text(mcpBridge.isConnected ? "Connected" : "Disconnected")
                .font(.caption2)
                .foregroundColor(.secondary)
            
            if !mcpBridge.lastActivity.isEmpty {
                Text(mcpBridge.lastActivity)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            
            HStack {
                Button("Reconnect") {
                    mcpBridge.reconnect()
                }
                .buttonStyle(.link)
                .font(.caption)
                .disabled(mcpBridge.isConnected)
                
                Button("Log") {
                    showActivityLog.toggle()
                }
                .buttonStyle(.link)
                .font(.caption)
            }
        }
        .padding(.vertical, 8)
        .sheet(isPresented: $showActivityLog) {
            ActivityLogView()
        }
    }
}

struct ActivityLogView: View {
    @EnvironmentObject var mcpBridge: MCPBridge
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("MCP Activity Log")
                    .font(.headline)
                Spacer()
                Button("Done") {
                    dismiss()
                }
            }
            .padding()
            
            Divider()
            
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(mcpBridge.activityLog.reversed(), id: \.self) { entry in
                        Text(entry)
                            .font(.system(.caption, design: .monospaced))
                            .padding(.horizontal)
                    }
                }
                .padding(.vertical)
            }
        }
        .frame(width: 500, height: 400)
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
        .environmentObject(MCPBridge.shared)
}
