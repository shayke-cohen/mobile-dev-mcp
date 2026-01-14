/**
 * React Native MCP Demo App
 * 
 * A sample e-commerce app demonstrating the Mobile Dev MCP SDK
 * Features: Tab navigation, Products, Cart, User Profile
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useColorScheme,
  FlatList,
} from 'react-native';

// MCP SDK Integration
import { MCPBridge } from './mcp/MCPBridge';

// Sample products data
const PRODUCTS = [
  { id: '1', name: 'Wireless Headphones', price: 149.99, category: 'Electronics', rating: 4.5, inStock: true },
  { id: '2', name: 'Smart Watch', price: 299.99, category: 'Electronics', rating: 4.8, inStock: true },
  { id: '3', name: 'Running Shoes', price: 89.99, category: 'Sports', rating: 4.3, inStock: true },
  { id: '4', name: 'Yoga Mat', price: 29.99, category: 'Sports', rating: 4.1, inStock: true },
  { id: '5', name: 'Coffee Maker', price: 79.99, category: 'Home', rating: 4.2, inStock: true },
  { id: '6', name: 'Desk Lamp', price: 45.99, category: 'Home', rating: 4.6, inStock: false },
];

type Product = typeof PRODUCTS[0];
type CartItem = Product & { quantity: number };
type Tab = 'home' | 'products' | 'cart' | 'profile';
type User = { id: string; name: string; email: string } | null;

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User>(null);
  const [mcpState, setMcpState] = useState({
    isConnected: false,
    lastActivity: '',
    reconnectCount: 0,
    activityLog: [] as Array<{timestamp: string; message: string}>,
  });
  const [showActivityLog, setShowActivityLog] = useState(false);

  // Initialize MCP SDK
  useEffect(() => {
    if (__DEV__) {
      // Initialize the MCP SDK
      // SDK auto-detects platform and uses appropriate host:
      // - Android emulator: ws://10.0.2.2:8765
      // - iOS simulator/device: ws://localhost:8765
      MCPBridge.initialize({
        debug: true,
      });

      // Enable features
      MCPBridge.enableLogCapture();
      MCPBridge.enableNetworkInterception();

      // Register feature flags
      MCPBridge.registerFeatureFlags({
        dark_mode: false,
        new_checkout: false,
        show_recommendations: true,
      });

      // Subscribe to state changes
      const unsubscribe = MCPBridge.subscribe((state) => {
        setMcpState(state);
      });

      return () => {
        unsubscribe();
        MCPBridge.disconnect();
      };
    }
  }, []);

  // Expose app state to MCP (update when state changes)
  useEffect(() => {
    if (__DEV__) {
      MCPBridge.exposeState('cart', () => cart);
      MCPBridge.exposeState('user', () => user);
      MCPBridge.exposeState('currentTab', () => currentTab);
      MCPBridge.exposeState('products', () => PRODUCTS);
      MCPBridge.exposeState('cartTotal', () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
      MCPBridge.exposeState('cartCount', () => cart.reduce((sum, item) => sum + item.quantity, 0));
    }
  }, [cart, user, currentTab]);

  // Track navigation state for MCP
  useEffect(() => {
    if (__DEV__) {
      MCPBridge.setNavigationState(currentTab);
    }
  }, [currentTab]);

  // Register MCP action handlers (allows remote control of the app)
  useEffect(() => {
    if (__DEV__) {
      MCPBridge.registerActions({
        // Navigation
        navigate: (params) => {
          const route = params.route as Tab;
          if (['home', 'products', 'cart', 'profile'].includes(route)) {
            setCurrentTab(route);
            return { navigatedTo: route };
          }
          throw new Error(`Invalid route: ${route}`);
        },

        // Cart actions
        addToCart: (params) => {
          const productId = params.productId as string;
          const product = PRODUCTS.find(p => p.id === productId);
          if (!product) {
            throw new Error(`Product not found: ${productId}`);
          }
          if (!product.inStock) {
            throw new Error(`Product out of stock: ${product.name}`);
          }
          addToCart(product);
          return { added: product.name, productId };
        },

        removeFromCart: (params) => {
          const productId = params.productId as string;
          removeFromCart(productId);
          return { removed: productId };
        },

        clearCart: () => {
          setCart([]);
          return { cleared: true };
        },

        updateQuantity: (params) => {
          const productId = params.productId as string;
          const delta = params.delta as number;
          updateQuantity(productId, delta);
          return { updated: productId, delta };
        },

        // User actions
        login: () => {
          login();
          return { loggedIn: true, user: { id: 'user_123', name: 'John Doe' } };
        },

        logout: () => {
          logout();
          return { loggedOut: true };
        },
      });
    }
  }, [addToCart, removeFromCart, updateQuantity, login, logout]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const login = () => {
    setUser({ id: 'user_123', name: 'John Doe', email: 'john@example.com' });
  };

  const logout = () => {
    setUser(null);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const styles = createStyles(isDarkMode);

  // ==================== HOME SCREEN ====================
  const renderHome = () => (
    <ScrollView style={styles.screenContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>🛍️ MCP Demo Store</Text>
        <Text style={styles.subtitle}>
          {user ? `Welcome back, ${user.name}!` : 'Mobile Dev MCP SDK Demo'}
        </Text>
      </View>

      {/* MCP SDK Status Banner - at top for visibility */}
      {__DEV__ && (
        <View style={[styles.debugBanner, mcpState.isConnected && styles.debugBannerConnected]}>
          <View style={styles.debugHeader}>
            <Text style={styles.debugTitle}>🔧 MCP SDK</Text>
            <View style={[styles.connectionDot, mcpState.isConnected ? styles.connected : styles.disconnected]} />
            <Text style={styles.connectionText}>
              {mcpState.isConnected ? 'Connected' : 'Disconnected'}
              {mcpState.reconnectCount > 0 && !mcpState.isConnected ? ` (${mcpState.reconnectCount})` : ''}
            </Text>
          </View>
          {mcpState.lastActivity ? (
            <Text style={styles.activityText} numberOfLines={1}>{mcpState.lastActivity}</Text>
          ) : null}
          <Text style={styles.debugText}>Server: {MCPBridge.getServerUrl()}</Text>
          <View style={styles.debugActions}>
            <TouchableOpacity 
              style={[styles.debugButton, mcpState.isConnected && styles.debugButtonDisabled]}
              onPress={() => MCPBridge.reconnect()}
              disabled={mcpState.isConnected}>
              <Text style={styles.debugButtonText}>🔄 Reconnect</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.debugButton}
              onPress={() => setShowActivityLog(true)}>
              <Text style={styles.debugButtonText}>📋 Activity Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome!</Text>
        <Text style={styles.cardText}>
          This is a sample e-commerce app demonstrating the Mobile Dev MCP SDK integration for AI-assisted development.
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{PRODUCTS.length}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{cartCount}</Text>
          <Text style={styles.statLabel}>In Cart</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>${cartTotal.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity style={styles.quickAction} onPress={() => setCurrentTab('products')}>
          <Text style={styles.quickActionIcon}>🛍️</Text>
          <Text style={styles.quickActionText}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction} onPress={() => setCurrentTab('cart')}>
          <Text style={styles.quickActionIcon}>🛒</Text>
          <Text style={styles.quickActionText}>Cart ({cartCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction} onPress={() => setCurrentTab('profile')}>
          <Text style={styles.quickActionIcon}>👤</Text>
          <Text style={styles.quickActionText}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Featured Products */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Featured Products</Text>
      </View>
      {PRODUCTS.slice(0, 3).map(product => (
        <View key={product.id} style={styles.productCard}>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productCategory}>{product.category}</Text>
            <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => addToCart(product)}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      ))}
      
      {/* Activity Log Modal */}
      {showActivityLog && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && styles.textLight]}>MCP SDK Activity</Text>
              <TouchableOpacity onPress={() => setShowActivityLog(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, isDarkMode && styles.textLight]}>Status:</Text>
              <View style={[styles.connectionDot, mcpState.isConnected ? styles.connected : styles.disconnected]} />
              <Text style={[styles.statusValue, isDarkMode && styles.textLight]}>
                {mcpState.isConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
            {mcpState.reconnectCount > 0 && (
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, isDarkMode && styles.textLight]}>Reconnect Attempts:</Text>
                <Text style={styles.reconnectCount}>{mcpState.reconnectCount}</Text>
              </View>
            )}
            <Text style={[styles.logHeader, isDarkMode && styles.textLight]}>Activity Log:</Text>
            <ScrollView style={styles.logContainer}>
              {mcpState.activityLog.length === 0 ? (
                <Text style={styles.noLogs}>No activity yet</Text>
              ) : (
                mcpState.activityLog.slice().reverse().map((entry, index) => (
                  <Text key={index} style={[
                    styles.logEntry,
                    entry.message.includes('Error') && styles.logError,
                    entry.message.includes('Connected!') && styles.logSuccess,
                    entry.message.includes('Command') && styles.logCommand,
                    entry.message.includes('Response') && styles.logResponse,
                  ]}>
                    {entry.timestamp} {entry.message}
                  </Text>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </ScrollView>
  );

  // ==================== PRODUCTS SCREEN ====================
  const renderProducts = () => (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Products</Text>
      </View>
      <FlatList
        data={PRODUCTS}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <View style={styles.productInfo}>
              <View style={styles.productHeader}>
                <Text style={styles.productName}>{item.name}</Text>
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingText}>⭐ {item.rating}</Text>
                </View>
              </View>
              <Text style={styles.productCategory}>{item.category}</Text>
              <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
              <Text style={item.inStock ? styles.inStock : styles.outOfStock}>
                {item.inStock ? '✓ In Stock' : '✗ Out of Stock'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.addButton, !item.inStock && styles.disabledButton]}
              onPress={() => item.inStock && addToCart(item)}
              disabled={!item.inStock}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );

  // ==================== CART SCREEN ====================
  const renderCart = () => (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Shopping Cart</Text>
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🛒</Text>
          <Text style={styles.emptyStateTitle}>Your cart is empty</Text>
          <Text style={styles.emptyStateText}>Add items to get started</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setCurrentTab('products')}>
            <Text style={styles.buttonText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName}>{item.name}</Text>
                  <Text style={styles.cartItemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                </View>
                <View style={styles.quantityControls}>
                  <TouchableOpacity style={styles.qtyButton} onPress={() => updateQuantity(item.id, -1)}>
                    <Text style={styles.qtyButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyButton} onPress={() => updateQuantity(item.id, 1)}>
                    <Text style={styles.qtyButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeFromCart(item.id)}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          />
          <View style={styles.cartFooter}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalAmount}>${cartTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Shipping</Text>
              <Text style={styles.freeShipping}>Free</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalAmount}>${cartTotal.toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.checkoutButton}>
              <Text style={styles.buttonText}>Checkout (${cartTotal.toFixed(2)})</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  // ==================== PROFILE SCREEN ====================
  const renderProfile = () => (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.profileContent}>
        {user ? (
          <>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
              </View>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Account</Text>
              <View style={styles.profileItem}>
                <Text style={styles.profileItemIcon}>📦</Text>
                <Text style={styles.profileItemText}>Orders</Text>
                <Text style={styles.profileItemChevron}>›</Text>
              </View>
              <View style={styles.profileItem}>
                <Text style={styles.profileItemIcon}>💳</Text>
                <Text style={styles.profileItemText}>Payment Methods</Text>
                <Text style={styles.profileItemChevron}>›</Text>
              </View>
              <View style={styles.profileItem}>
                <Text style={styles.profileItemIcon}>📍</Text>
                <Text style={styles.profileItemText}>Addresses</Text>
                <Text style={styles.profileItemChevron}>›</Text>
              </View>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Settings</Text>
              <View style={styles.profileItem}>
                <Text style={styles.profileItemIcon}>🔔</Text>
                <Text style={styles.profileItemText}>Notifications</Text>
                <Text style={styles.profileItemChevron}>›</Text>
              </View>
              <View style={styles.profileItem}>
                <Text style={styles.profileItemIcon}>🔒</Text>
                <Text style={styles.profileItemText}>Privacy</Text>
                <Text style={styles.profileItemChevron}>›</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Text style={styles.logoutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>👤</Text>
            <Text style={styles.emptyStateTitle}>Not signed in</Text>
            <Text style={styles.emptyStateText}>Sign in to access your profile</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={login}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.aboutSection}>
          <Text style={styles.profileSectionTitle}>About</Text>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>App</Text>
            <Text style={styles.aboutValue}>MCP Demo Store</Text>
          </View>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Platform</Text>
            <Text style={styles.aboutValue}>React Native</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  // ==================== TAB BAR ====================
  const TabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity style={styles.tabItem} onPress={() => setCurrentTab('home')}>
        <Text style={[styles.tabIcon, currentTab === 'home' && styles.tabIconActive]}>🏠</Text>
        <Text style={[styles.tabLabel, currentTab === 'home' && styles.tabLabelActive]}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tabItem} onPress={() => setCurrentTab('products')}>
        <Text style={[styles.tabIcon, currentTab === 'products' && styles.tabIconActive]}>🛍️</Text>
        <Text style={[styles.tabLabel, currentTab === 'products' && styles.tabLabelActive]}>Products</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tabItem} onPress={() => setCurrentTab('cart')}>
        <View>
          <Text style={[styles.tabIcon, currentTab === 'cart' && styles.tabIconActive]}>🛒</Text>
          {cartCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{cartCount}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.tabLabel, currentTab === 'cart' && styles.tabLabelActive]}>Cart</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tabItem} onPress={() => setCurrentTab('profile')}>
        <Text style={[styles.tabIcon, currentTab === 'profile' && styles.tabIconActive]}>👤</Text>
        <Text style={[styles.tabLabel, currentTab === 'profile' && styles.tabLabelActive]}>Profile</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        {currentTab === 'home' && renderHome()}
        {currentTab === 'products' && renderProducts()}
        {currentTab === 'cart' && renderCart()}
        {currentTab === 'profile' && renderProfile()}
      </View>
      <TabBar />
    </SafeAreaView>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5',
    },
    container: {
      flex: 1,
    },
    screenContainer: {
      flex: 1,
      backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5',
    },
    screenHeader: {
      padding: 16,
      backgroundColor: '#6200EE',
    },
    screenTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#fff',
    },
    header: {
      padding: 24,
      alignItems: 'center',
      backgroundColor: '#6200EE',
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#fff',
    },
    subtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 4,
    },
    card: {
      backgroundColor: isDark ? '#2d2d44' : '#fff',
      margin: 16,
      padding: 20,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? '#fff' : '#333',
      marginBottom: 8,
    },
    cardText: {
      fontSize: 14,
      color: isDark ? '#ccc' : '#666',
      lineHeight: 20,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: 16,
      marginVertical: 8,
    },
    statCard: {
      backgroundColor: isDark ? '#2d2d44' : '#fff',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      minWidth: 100,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    statNumber: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#6200EE',
    },
    statLabel: {
      fontSize: 12,
      color: isDark ? '#aaa' : '#888',
      marginTop: 4,
    },
    quickActionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      padding: 16,
    },
    quickAction: {
      backgroundColor: isDark ? '#2d2d44' : '#fff',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      width: 100,
    },
    quickActionIcon: {
      fontSize: 24,
      marginBottom: 8,
    },
    quickActionText: {
      fontSize: 12,
      color: isDark ? '#ccc' : '#666',
    },
    sectionHeader: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#fff' : '#333',
    },
    primaryButton: {
      backgroundColor: '#6200EE',
      marginHorizontal: 16,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    debugBanner: {
      backgroundColor: isDark ? '#3d3d5c' : '#e8e8ff',
      margin: 16,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#6200EE',
    },
    debugBannerConnected: {
      borderColor: '#4CAF50',
    },
    debugHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    debugTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#6200EE',
    },
    connectionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: 8,
      marginRight: 4,
    },
    connected: {
      backgroundColor: '#4CAF50',
    },
    disconnected: {
      backgroundColor: '#F44336',
    },
    connectionText: {
      fontSize: 12,
      color: isDark ? '#ccc' : '#666',
    },
    activityText: {
      fontSize: 10,
      color: isDark ? '#999' : '#888',
      marginBottom: 4,
    },
    debugText: {
      fontSize: 12,
      color: isDark ? '#ccc' : '#666',
    },
    debugActions: {
      flexDirection: 'row',
      marginTop: 8,
      gap: 8,
    },
    debugButton: {
      backgroundColor: isDark ? '#4a4a6a' : '#ddd',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    debugButtonDisabled: {
      opacity: 0.5,
    },
    debugButtonText: {
      fontSize: 12,
      color: isDark ? '#fff' : '#333',
    },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 20,
      width: '90%',
      maxHeight: '80%',
    },
    modalContentDark: {
      backgroundColor: '#2d2d44',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#333',
    },
    modalClose: {
      fontSize: 24,
      color: '#999',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    statusLabel: {
      fontSize: 14,
      color: '#666',
      marginRight: 8,
    },
    statusValue: {
      fontSize: 14,
      color: '#333',
      marginLeft: 4,
    },
    reconnectCount: {
      fontSize: 14,
      color: '#FF9800',
      fontWeight: '600',
    },
    textLight: {
      color: '#fff',
    },
    logHeader: {
      fontSize: 14,
      fontWeight: '600',
      color: '#333',
      marginTop: 12,
      marginBottom: 8,
    },
    logContainer: {
      backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5',
      borderRadius: 8,
      padding: 12,
      maxHeight: 200,
    },
    noLogs: {
      color: '#999',
      fontStyle: 'italic',
    },
    logEntry: {
      fontSize: 11,
      fontFamily: 'monospace',
      color: isDark ? '#ccc' : '#333',
      marginBottom: 4,
    },
    logError: {
      color: '#F44336',
    },
    logSuccess: {
      color: '#4CAF50',
    },
    logCommand: {
      color: '#2196F3',
    },
    logResponse: {
      color: '#9C27B0',
    },
    listContent: {
      padding: 16,
    },
    productCard: {
      backgroundColor: isDark ? '#2d2d44' : '#fff',
      padding: 16,
      borderRadius: 12,
      marginHorizontal: 16,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    productInfo: {
      flex: 1,
    },
    productHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    productName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#fff' : '#333',
    },
    ratingBadge: {
      backgroundColor: '#FFF3E0',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    ratingText: {
      fontSize: 12,
      color: '#FF9800',
    },
    productCategory: {
      fontSize: 12,
      color: isDark ? '#aaa' : '#888',
      marginTop: 2,
    },
    productPrice: {
      fontSize: 16,
      fontWeight: '700',
      color: '#6200EE',
      marginTop: 4,
    },
    inStock: {
      fontSize: 12,
      color: '#4CAF50',
      marginTop: 2,
    },
    outOfStock: {
      fontSize: 12,
      color: '#F44336',
      marginTop: 2,
    },
    addButton: {
      backgroundColor: '#6200EE',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    disabledButton: {
      backgroundColor: '#ccc',
    },
    addButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyStateIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyStateTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? '#fff' : '#333',
      marginBottom: 8,
    },
    emptyStateText: {
      fontSize: 14,
      color: isDark ? '#aaa' : '#666',
      marginBottom: 24,
    },
    cartItem: {
      backgroundColor: isDark ? '#2d2d44' : '#fff',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    cartItemInfo: {
      flex: 1,
    },
    cartItemName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#fff' : '#333',
    },
    cartItemPrice: {
      fontSize: 14,
      color: '#6200EE',
      fontWeight: '600',
      marginTop: 4,
    },
    quantityControls: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 16,
    },
    qtyButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? '#3d3d5c' : '#f0f0f0',
      justifyContent: 'center',
      alignItems: 'center',
    },
    qtyButtonText: {
      fontSize: 18,
      color: '#6200EE',
      fontWeight: '600',
    },
    qtyText: {
      fontSize: 16,
      fontWeight: '600',
      marginHorizontal: 12,
      color: isDark ? '#fff' : '#333',
    },
    removeText: {
      fontSize: 20,
      color: '#F44336',
    },
    cartFooter: {
      padding: 16,
      backgroundColor: isDark ? '#2d2d44' : '#fff',
      borderTopWidth: 1,
      borderTopColor: isDark ? '#444' : '#eee',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    totalLabel: {
      fontSize: 14,
      color: isDark ? '#aaa' : '#666',
    },
    totalAmount: {
      fontSize: 14,
      color: isDark ? '#fff' : '#333',
    },
    freeShipping: {
      fontSize: 14,
      color: '#4CAF50',
    },
    grandTotalRow: {
      borderTopWidth: 1,
      borderTopColor: isDark ? '#444' : '#eee',
      paddingTop: 8,
      marginTop: 8,
      marginBottom: 16,
    },
    grandTotalLabel: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#fff' : '#333',
    },
    grandTotalAmount: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#6200EE',
    },
    checkoutButton: {
      backgroundColor: '#4CAF50',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    profileContent: {
      padding: 16,
    },
    profileHeader: {
      alignItems: 'center',
      padding: 24,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#6200EE',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    avatarText: {
      fontSize: 32,
      color: '#fff',
      fontWeight: '600',
    },
    profileName: {
      fontSize: 24,
      fontWeight: '600',
      color: isDark ? '#fff' : '#333',
    },
    profileEmail: {
      fontSize: 14,
      color: isDark ? '#aaa' : '#666',
      marginTop: 4,
    },
    profileSection: {
      backgroundColor: isDark ? '#2d2d44' : '#fff',
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
    },
    profileSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#aaa' : '#888',
      padding: 16,
      paddingBottom: 8,
    },
    profileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#3d3d5c' : '#f0f0f0',
    },
    profileItemIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    profileItemText: {
      flex: 1,
      fontSize: 16,
      color: isDark ? '#fff' : '#333',
    },
    profileItemChevron: {
      fontSize: 20,
      color: isDark ? '#aaa' : '#ccc',
    },
    logoutButton: {
      backgroundColor: '#F44336',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
    },
    logoutButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    aboutSection: {
      backgroundColor: isDark ? '#2d2d44' : '#fff',
      borderRadius: 12,
      marginTop: 8,
      padding: 16,
    },
    aboutItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    aboutLabel: {
      fontSize: 14,
      color: isDark ? '#aaa' : '#666',
    },
    aboutValue: {
      fontSize: 14,
      color: isDark ? '#fff' : '#333',
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#2d2d44' : '#fff',
      borderTopWidth: 1,
      borderTopColor: isDark ? '#3d3d5c' : '#eee',
      paddingBottom: 8,
      paddingTop: 8,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
    },
    tabIcon: {
      fontSize: 24,
      opacity: 0.5,
    },
    tabIconActive: {
      opacity: 1,
    },
    tabLabel: {
      fontSize: 10,
      color: isDark ? '#aaa' : '#888',
      marginTop: 4,
    },
    tabLabelActive: {
      color: '#6200EE',
      fontWeight: '600',
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -8,
      backgroundColor: '#F44336',
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '600',
    },
  });

export default App;
