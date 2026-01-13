/**
 * App ViewModel - Central state management
 */

package com.mobiledevmcp.demo.viewmodel

import androidx.lifecycle.ViewModel
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
