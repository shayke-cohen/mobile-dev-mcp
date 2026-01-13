/**
 * Main Screen with Bottom Navigation
 */

package com.mobiledevmcp.demo.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.mobiledevmcp.demo.viewmodel.AppViewModel

sealed class Screen(val route: String, val icon: @Composable () -> Unit, val label: String) {
    object Home : Screen("home", { Icon(Icons.Filled.Home, contentDescription = null) }, "Home")
    object Products : Screen("products", { Icon(Icons.Filled.ShoppingBag, contentDescription = null) }, "Products")
    object Cart : Screen("cart", { Icon(Icons.Filled.ShoppingCart, contentDescription = null) }, "Cart")
    object Profile : Screen("profile", { Icon(Icons.Filled.Person, contentDescription = null) }, "Profile")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(viewModel: AppViewModel = viewModel()) {
    val navController = rememberNavController()
    val state by viewModel.state.collectAsState()
    
    val items = listOf(Screen.Home, Screen.Products, Screen.Cart, Screen.Profile)
    
    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                
                items.forEach { screen ->
                    NavigationBarItem(
                        icon = screen.icon,
                        label = { Text(screen.label) },
                        selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Home.route) {
                HomeScreen(
                    state = state,
                    onLogin = viewModel::login,
                    onLogout = viewModel::logout,
                    onProductClick = { navController.navigate(Screen.Products.route) }
                )
            }
            composable(Screen.Products.route) {
                ProductListScreen(
                    products = state.products,
                    onAddToCart = viewModel::addToCart,
                    onProductClick = viewModel::selectProduct
                )
            }
            composable(Screen.Cart.route) {
                CartScreen(
                    cartItems = state.cartItems,
                    cartTotal = state.cartTotal,
                    isLoggedIn = state.isLoggedIn,
                    onUpdateQuantity = viewModel::updateQuantity,
                    onRemoveItem = viewModel::removeFromCart,
                    onClearCart = viewModel::clearCart
                )
            }
            composable(Screen.Profile.route) {
                ProfileScreen(
                    user = state.currentUser,
                    isLoggedIn = state.isLoggedIn,
                    onLogin = viewModel::login,
                    onLogout = viewModel::logout
                )
            }
        }
    }
}
