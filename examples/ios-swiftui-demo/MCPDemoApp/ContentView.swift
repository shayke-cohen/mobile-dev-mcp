/**
 * Content View - Main app navigation
 */

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        TabView {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
            
            ProductListView()
                .tabItem {
                    Label("Products", systemImage: "bag.fill")
                }
            
            CartView()
                .tabItem {
                    Label("Cart", systemImage: "cart.fill")
                }
                .badge(appState.cartItems.count)
            
            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
        }
        .accentColor(.purple)
    }
}

// MARK: - Home View

struct HomeView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Welcome Banner
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Welcome\(appState.currentUser.map { ", \($0.name)" } ?? "")!")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                        Text("Discover amazing products")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(Color.purple.opacity(0.1))
                    .cornerRadius(16)
                    
                    // Quick Actions
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                        QuickActionCard(icon: "bag", title: "Products", color: .purple)
                        QuickActionCard(icon: "cart", title: "Cart (\(appState.cartItems.count))", color: .green)
                        QuickActionCard(icon: "shippingbox", title: "Orders", color: .orange)
                        QuickActionCard(icon: "gearshape", title: "Settings", color: .gray)
                    }
                    
                    // Featured Products
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Featured Products")
                            .font(.headline)
                        
                        ForEach(appState.products.prefix(3)) { product in
                            ProductRow(product: product)
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(16)
                    .shadow(radius: 2)
                    
                    // Debug Info
                    VStack(alignment: .leading, spacing: 8) {
                        Label("MCP Demo App", systemImage: "wrench.and.screwdriver")
                            .font(.headline)
                            .foregroundColor(.purple)
                        Text("SwiftUI demo for Mobile Dev MCP SDK")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.purple.opacity(0.1))
                    .cornerRadius(12)
                }
                .padding()
            }
            .navigationTitle("🛍️ MCP Demo Store")
        }
    }
}

struct QuickActionCard: View {
    let icon: String
    let title: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title)
                .foregroundColor(color)
            Text(title)
                .font(.subheadline)
                .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct ProductRow: View {
    let product: Product
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        HStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.purple.opacity(0.2))
                .frame(width: 60, height: 60)
                .overlay(
                    Image(systemName: "bag")
                        .foregroundColor(.purple)
                )
            
            VStack(alignment: .leading, spacing: 4) {
                Text(product.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text("$\(product.price, specifier: "%.2f")")
                    .font(.headline)
                    .foregroundColor(.purple)
            }
            
            Spacer()
            
            Button {
                appState.addToCart(product)
            } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.title2)
                    .foregroundColor(.purple)
            }
            .disabled(!product.inStock)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Product List View

struct ProductListView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        NavigationStack {
            List(appState.products) { product in
                NavigationLink {
                    ProductDetailView(product: product)
                } label: {
                    ProductRow(product: product)
                }
                .listRowSeparator(.hidden)
            }
            .listStyle(.plain)
            .navigationTitle("Products")
        }
    }
}

// MARK: - Product Detail View

struct ProductDetailView: View {
    let product: Product
    @EnvironmentObject var appState: AppState
    @State private var showingAlert = false
    
    var isInCart: Bool {
        appState.cartItems.contains { $0.productId == product.id }
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Product Image
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.purple.opacity(0.2))
                    .frame(height: 250)
                    .overlay(
                        Image(systemName: "bag")
                            .font(.system(size: 60))
                            .foregroundColor(.purple)
                    )
                
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text(product.name)
                            .font(.title)
                            .fontWeight(.bold)
                        Spacer()
                        HStack(spacing: 4) {
                            Image(systemName: "star.fill")
                                .foregroundColor(.yellow)
                            Text("\(product.rating, specifier: "%.1f")")
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.yellow.opacity(0.2))
                        .cornerRadius(20)
                    }
                    
                    Text(product.category)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    Text("$\(product.price, specifier: "%.2f")")
                        .font(.title)
                        .fontWeight(.bold)
                        .foregroundColor(.purple)
                    
                    Text(product.inStock ? "✓ In Stock" : "✗ Out of Stock")
                        .foregroundColor(product.inStock ? .green : .red)
                        .fontWeight(.semibold)
                    
                    Divider()
                    
                    Text("Description")
                        .font(.headline)
                    Text(product.description)
                        .foregroundColor(.secondary)
                }
                .padding()
                
                HStack(spacing: 16) {
                    Button {
                        appState.addToCart(product)
                        showingAlert = true
                    } label: {
                        Label(isInCart ? "In Cart" : "Add to Cart", systemImage: "cart.badge.plus")
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(product.inStock && !isInCart ? Color.purple : Color.gray)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }
                    .disabled(!product.inStock || isInCart)
                }
                .padding(.horizontal)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .alert("Added to Cart", isPresented: $showingAlert) {
            Button("OK", role: .cancel) { }
        }
    }
}

// MARK: - Cart View

struct CartView: View {
    @EnvironmentObject var appState: AppState
    @State private var showingCheckoutAlert = false
    
    var body: some View {
        NavigationStack {
            Group {
                if appState.cartItems.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "cart")
                            .font(.system(size: 60))
                            .foregroundColor(.gray)
                        Text("Your cart is empty")
                            .font(.title2)
                            .fontWeight(.medium)
                        Text("Add items to get started")
                            .foregroundColor(.secondary)
                    }
                } else {
                    List {
                        ForEach(appState.cartItems) { item in
                            CartItemRow(item: item)
                        }
                        .onDelete { indexSet in
                            indexSet.forEach { index in
                                let item = appState.cartItems[index]
                                appState.removeFromCart(item.productId)
                            }
                        }
                        
                        Section {
                            HStack {
                                Text("Total")
                                    .font(.headline)
                                Spacer()
                                Text("$\(appState.cartTotal, specifier: "%.2f")")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.purple)
                            }
                        }
                        
                        Section {
                            Button {
                                showingCheckoutAlert = true
                            } label: {
                                Text("Checkout")
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.green)
                                    .foregroundColor(.white)
                                    .cornerRadius(12)
                            }
                            .listRowBackground(Color.clear)
                        }
                    }
                }
            }
            .navigationTitle("Cart")
            .alert("Order Placed!", isPresented: $showingCheckoutAlert) {
                Button("OK") { appState.clearCart() }
            }
        }
    }
}

struct CartItemRow: View {
    let item: CartItem
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        HStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.purple.opacity(0.2))
                .frame(width: 50, height: 50)
                .overlay(Image(systemName: "bag").foregroundColor(.purple))
            
            VStack(alignment: .leading) {
                Text(item.name).fontWeight(.medium)
                Text("$\(item.price, specifier: "%.2f")").foregroundColor(.secondary)
            }
            
            Spacer()
            
            HStack(spacing: 12) {
                Button { appState.updateQuantity(item.productId, quantity: item.quantity - 1) }
                label: { Image(systemName: "minus.circle") }
                
                Text("\(item.quantity)").fontWeight(.semibold)
                
                Button { appState.updateQuantity(item.productId, quantity: item.quantity + 1) }
                label: { Image(systemName: "plus.circle") }
            }
            .foregroundColor(.purple)
        }
    }
}

// MARK: - Profile View

struct ProfileView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        NavigationStack {
            List {
                if let user = appState.currentUser {
                    Section {
                        HStack(spacing: 16) {
                            Circle()
                                .fill(Color.purple.opacity(0.2))
                                .frame(width: 60, height: 60)
                                .overlay(Text(String(user.name.prefix(1))).font(.title).foregroundColor(.purple))
                            
                            VStack(alignment: .leading) {
                                Text(user.name).font(.headline)
                                Text(user.email).font(.subheadline).foregroundColor(.secondary)
                            }
                        }
                    }
                    
                    Section {
                        Button(role: .destructive) { appState.logout() }
                        label: { Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right") }
                    }
                } else {
                    Section {
                        Button { appState.login() }
                        label: { Label("Sign In", systemImage: "person.crop.circle.badge.plus") }
                    }
                }
                
                Section("About") {
                    LabeledContent("App", value: "MCP Demo")
                    LabeledContent("Version", value: "1.0.0")
                }
            }
            .navigationTitle("Profile")
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
}
