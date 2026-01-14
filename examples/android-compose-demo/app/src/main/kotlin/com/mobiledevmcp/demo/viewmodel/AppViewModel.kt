/**
 * App ViewModel - Central state management
 */

package com.mobiledevmcp.demo.viewmodel

import androidx.lifecycle.ViewModel
import com.mobiledevmcp.demo.mcp.MCPBridge
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class User(
    val id: String,
    val name: String,
    val email: String
)

data class Product(
    val id: String,
    val name: String,
    val description: String,
    val price: Double,
    val imageUrl: String,
    val category: String,
    val rating: Double,
    val inStock: Boolean
)

data class CartItem(
    val productId: String,
    val name: String,
    val price: Double,
    var quantity: Int
)

data class AppState(
    val currentUser: User? = null,
    val isLoggedIn: Boolean = false,
    val products: List<Product> = emptyList(),
    val cartItems: List<CartItem> = emptyList(),
    val selectedProduct: Product? = null,
    val isLoading: Boolean = false
) {
    val cartTotal: Double
        get() = cartItems.sumOf { it.price * it.quantity }
    
    val cartItemCount: Int
        get() = cartItems.sumOf { it.quantity }
}

class AppViewModel : ViewModel() {
    
    private val _state = MutableStateFlow(AppState())
    val state: StateFlow<AppState> = _state.asStateFlow()
    
    init {
        loadMockProducts()
        exposeStateToMCP()
        registerActionsToMCP()
    }
    
    private fun exposeStateToMCP() {
        MCPBridge.exposeState("currentUser") { _state.value.currentUser?.let {
            mapOf("id" to it.id, "name" to it.name, "email" to it.email)
        }}
        MCPBridge.exposeState("user") { _state.value.currentUser?.let {
            mapOf("id" to it.id, "name" to it.name, "email" to it.email)
        }}
        MCPBridge.exposeState("isLoggedIn") { _state.value.isLoggedIn }
        MCPBridge.exposeState("products") { _state.value.products.map {
            mapOf("id" to it.id, "name" to it.name, "price" to it.price, "category" to it.category, "inStock" to it.inStock)
        }}
        MCPBridge.exposeState("cart") { _state.value.cartItems.map {
            mapOf("productId" to it.productId, "name" to it.name, "price" to it.price, "quantity" to it.quantity)
        }}
        MCPBridge.exposeState("cartTotal") { _state.value.cartTotal }
        MCPBridge.exposeState("cartCount") { _state.value.cartItemCount }
    }
    
    private fun registerActionsToMCP() {
        // Cart actions
        MCPBridge.registerAction("addToCart") { params ->
            val productId = params["productId"] as? String
                ?: throw IllegalArgumentException("productId is required")
            val product = _state.value.products.find { it.id == productId }
                ?: throw IllegalArgumentException("Product not found: $productId")
            if (!product.inStock) {
                throw IllegalArgumentException("Product out of stock: ${product.name}")
            }
            addToCart(product)
            mapOf("added" to product.name, "productId" to productId)
        }
        
        MCPBridge.registerAction("removeFromCart") { params ->
            val productId = params["productId"] as? String
                ?: throw IllegalArgumentException("productId is required")
            removeFromCart(productId)
            mapOf("removed" to productId)
        }
        
        MCPBridge.registerAction("clearCart") { _ ->
            clearCart()
            mapOf("cleared" to true)
        }
        
        MCPBridge.registerAction("updateQuantity") { params ->
            val productId = params["productId"] as? String
                ?: throw IllegalArgumentException("productId is required")
            val delta = (params["delta"] as? Number)?.toInt() ?: 1
            val currentItem = _state.value.cartItems.find { it.productId == productId }
            if (currentItem != null) {
                updateQuantity(productId, currentItem.quantity + delta)
            }
            mapOf("updated" to productId, "delta" to delta)
        }
        
        // User actions
        MCPBridge.registerAction("login") { _ ->
            login()
            mapOf("loggedIn" to true, "user" to mapOf("id" to "user_123", "name" to "John Doe"))
        }
        
        MCPBridge.registerAction("logout") { _ ->
            logout()
            mapOf("loggedOut" to true)
        }
        
        // Navigation - Android uses NavController which isn't easily accessible from ViewModel
        MCPBridge.registerAction("navigate") { params ->
            val route = params["route"] as? String ?: "unknown"
            // Navigation is handled by NavController in MainScreen, not easily accessible here
            mapOf("navigatedTo" to route, "note" to "Android navigation not accessible from ViewModel")
        }
        
        // Register UI components for inspection
        registerUIComponents()
    }
    
    private fun registerUIComponents() {
        // Register tab buttons
        MCPBridge.registerComponent("tab-home", "Button", getText = { "Home" })
        MCPBridge.registerComponent("tab-products", "Button", getText = { "Products" })
        MCPBridge.registerComponent("tab-cart", "Button", getText = {
            "Cart (${_state.value.cartItems.sumOf { it.quantity }})"
        })
        MCPBridge.registerComponent("tab-profile", "Button", getText = { "Profile" })
        
        // Register header text
        MCPBridge.registerComponent("app-title", "Text", getText = { "MCP Demo Store" })
        MCPBridge.registerComponent("welcome-text", "Text", getText = {
            if (_state.value.isLoggedIn) "Welcome back, ${_state.value.currentUser?.name}!"
            else "Mobile Dev MCP SDK Demo"
        })
        
        // Register cart total
        MCPBridge.registerComponent("cart-total", "Text", getText = {
            "$${String.format("%.2f", _state.value.cartTotal)}"
        })
        
        // Register login/logout buttons
        MCPBridge.registerComponent("login-button", "Button", onTap = { login() }, getText = { "Login" })
        MCPBridge.registerComponent("logout-button", "Button", onTap = { logout() }, getText = { "Logout" })
        
        // Register product buttons (first 3)
        _state.value.products.take(3).forEach { product ->
            MCPBridge.registerComponent(
                testId = "add-to-cart-${product.id}",
                type = "Button",
                props = mapOf("productId" to product.id, "productName" to product.name),
                onTap = { addToCart(product) },
                getText = { if (product.inStock) "Add to Cart" else "Out of Stock" }
            )
        }
        
        // Set initial navigation state
        MCPBridge.setNavigationState("home")
    }
    
    private fun loadMockProducts() {
        val products = listOf(
            Product("1", "Wireless Headphones", "High-quality wireless headphones with noise cancellation", 149.99, "headphones", "Electronics", 4.5, true),
            Product("2", "Smart Watch", "Feature-rich smartwatch with health tracking", 299.99, "watch", "Electronics", 4.8, true),
            Product("3", "Running Shoes", "Comfortable running shoes for everyday training", 89.99, "shoes", "Sports", 4.3, true),
            Product("4", "Laptop Stand", "Ergonomic aluminum laptop stand", 49.99, "stand", "Office", 4.6, false),
            Product("5", "Coffee Maker", "Automatic coffee maker with timer", 79.99, "coffee", "Home", 4.2, true)
        )
        _state.update { it.copy(products = products) }
    }
    
    fun login() {
        val user = User("user_123", "John Doe", "john@example.com")
        _state.update { it.copy(currentUser = user, isLoggedIn = true) }
        android.util.Log.i("AppViewModel", "User logged in: ${user.name}")
    }
    
    fun logout() {
        _state.update { it.copy(currentUser = null, isLoggedIn = false) }
        android.util.Log.i("AppViewModel", "User logged out")
    }
    
    fun addToCart(product: Product) {
        _state.update { state ->
            val existingItem = state.cartItems.find { it.productId == product.id }
            val newCartItems = if (existingItem != null) {
                state.cartItems.map { item ->
                    if (item.productId == product.id) {
                        item.copy(quantity = item.quantity + 1)
                    } else {
                        item
                    }
                }
            } else {
                state.cartItems + CartItem(product.id, product.name, product.price, 1)
            }
            state.copy(cartItems = newCartItems)
        }
        android.util.Log.i("AppViewModel", "Added to cart: ${product.name}")
    }
    
    fun removeFromCart(productId: String) {
        _state.update { state ->
            state.copy(cartItems = state.cartItems.filter { it.productId != productId })
        }
        android.util.Log.i("AppViewModel", "Removed from cart: $productId")
    }
    
    fun updateQuantity(productId: String, quantity: Int) {
        _state.update { state ->
            if (quantity <= 0) {
                state.copy(cartItems = state.cartItems.filter { it.productId != productId })
            } else {
                val newCartItems = state.cartItems.map { item ->
                    if (item.productId == productId) {
                        item.copy(quantity = quantity)
                    } else {
                        item
                    }
                }
                state.copy(cartItems = newCartItems)
            }
        }
    }
    
    fun selectProduct(product: Product) {
        _state.update { it.copy(selectedProduct = product) }
    }
    
    fun clearCart() {
        _state.update { it.copy(cartItems = emptyList()) }
        android.util.Log.i("AppViewModel", "Cart cleared")
    }
}
