/**
 * React Native MCP Demo App
 * 
 * This sample app demonstrates how to integrate the Mobile Dev MCP SDK
 * with a React Native application for AI-assisted development in Cursor.
 */

import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { store } from './store';
import HomeScreen from './screens/HomeScreen';
import ProductListScreen from './screens/ProductListScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import CartScreen from './screens/CartScreen';

// Import MCP SDK
import { MCPBridge } from '@mobile-dev-mcp/react-native';

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  ProductList: undefined;
  ProductDetail: { productId: string };
  Cart: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Navigation ref for MCP SDK
export const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

// Initialize MCP SDK in development mode
if (__DEV__) {
  MCPBridge.initialize({
    serverUrl: 'ws://localhost:8765',
    autoConnect: true,
    debug: true,
  });

  // Expose Redux store for state inspection
  MCPBridge.exposeState('store', () => store.getState());
  
  // Enable automatic features
  MCPBridge.enableNetworkInterception();
  MCPBridge.enableLogCapture();
  
  // Register feature flags
  MCPBridge.registerFeatureFlags({
    'new_checkout': false,
    'dark_mode': false,
    'show_recommendations': true,
  });

  console.log('[App] MCP SDK initialized');
}

function App(): React.JSX.Element {
  useEffect(() => {
    // Set navigation ref for MCP SDK
    if (__DEV__ && navigationRef.current) {
      MCPBridge.setNavigationRef(navigationRef);
    }
  }, []);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator 
            initialRouteName="Home"
            screenOptions={{
              headerStyle: { backgroundColor: '#6200EE' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: 'bold' },
            }}
          >
            <Stack.Screen 
              name="Home" 
              component={HomeScreen} 
              options={{ title: 'MCP Demo Store' }}
            />
            <Stack.Screen 
              name="ProductList" 
              component={ProductListScreen} 
              options={{ title: 'Products' }}
            />
            <Stack.Screen 
              name="ProductDetail" 
              component={ProductDetailScreen} 
              options={{ title: 'Product Details' }}
            />
            <Stack.Screen 
              name="Cart" 
              component={CartScreen} 
              options={{ title: 'Shopping Cart' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}

export default App;
