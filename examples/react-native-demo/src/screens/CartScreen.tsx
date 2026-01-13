/**
 * Cart Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import {
  CartItem,
  removeItem,
  updateQuantity,
  applyPromoCode,
  clearCart,
} from '../store/cartSlice';

const CartScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const cart = useSelector((state: RootState) => state.cart);
  const user = useSelector((state: RootState) => state.user);
  const [promoInput, setPromoInput] = useState('');

  const handleQuantityChange = (productId: string, delta: number) => {
    const item = cart.items.find((i) => i.productId === productId);
    if (item) {
      const newQuantity = item.quantity + delta;
      if (newQuantity < 1) {
        dispatch(removeItem(productId));
        console.log('[CartScreen] Removed item:', productId);
      } else {
        dispatch(updateQuantity({ productId, quantity: newQuantity }));
        console.log('[CartScreen] Updated quantity:', productId, newQuantity);
      }
    }
  };

  const handleRemoveItem = (productId: string) => {
    dispatch(removeItem(productId));
    console.log('[CartScreen] Removed item:', productId);
  };

  const handleApplyPromo = () => {
    if (promoInput.toUpperCase() === 'SAVE10') {
      dispatch(applyPromoCode({ code: 'SAVE10', discount: 10 }));
      console.log('[CartScreen] Applied promo code: SAVE10');
      Alert.alert('Success', 'Promo code applied! $10 discount.');
    } else if (promoInput.toUpperCase() === 'SAVE20') {
      dispatch(applyPromoCode({ code: 'SAVE20', discount: 20 }));
      console.log('[CartScreen] Applied promo code: SAVE20');
      Alert.alert('Success', 'Promo code applied! $20 discount.');
    } else {
      console.log('[CartScreen] Invalid promo code:', promoInput);
      Alert.alert('Error', 'Invalid promo code');
    }
    setPromoInput('');
  };

  const handleCheckout = () => {
    if (!user.isLoggedIn) {
      Alert.alert('Please Sign In', 'You need to sign in to checkout');
      console.log('[CartScreen] Checkout blocked - not logged in');
      return;
    }

    if (cart.items.length === 0) {
      Alert.alert('Empty Cart', 'Add items to your cart before checkout');
      console.log('[CartScreen] Checkout blocked - empty cart');
      return;
    }

    // Simulate checkout
    Alert.alert(
      'Order Placed!',
      `Total: $${cart.total.toFixed(2)}\nThank you for your order!`,
      [
        {
          text: 'OK',
          onPress: () => {
            dispatch(clearCart());
            console.log('[CartScreen] Checkout completed, cart cleared');
          },
        },
      ]
    );
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <Image
        source={{ uri: item.imageUrl || 'https://picsum.photos/80/80' }}
        style={styles.itemImage}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(item.productId, -1)}
          >
            <Text style={styles.quantityButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(item.productId, 1)}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemTotal}>
          ${(item.price * item.quantity).toFixed(2)}
        </Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item.productId)}
        >
          <Text style={styles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (cart.items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptyText}>Add items to get started</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cart.items}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.listContainer}
        ListFooterComponent={
          <View style={styles.footer}>
            {/* Promo Code Section */}
            <View style={styles.promoSection}>
              <TextInput
                style={styles.promoInput}
                placeholder="Enter promo code"
                value={promoInput}
                onChangeText={setPromoInput}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.promoButton} onPress={handleApplyPromo}>
                <Text style={styles.promoButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>

            {cart.promoCode && (
              <View style={styles.promoApplied}>
                <Text style={styles.promoAppliedText}>
                  ✓ Promo "{cart.promoCode}" applied: -${cart.discount.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Order Summary */}
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal ({cart.itemCount} items)</Text>
                <Text style={styles.summaryValue}>
                  ${(cart.total + cart.discount).toFixed(2)}
                </Text>
              </View>
              {cart.discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <Text style={[styles.summaryValue, styles.discountText]}>
                    -${cart.discount.toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Shipping</Text>
                <Text style={styles.summaryValue}>Free</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${cart.total.toFixed(2)}</Text>
              </View>
            </View>

            {/* Checkout Button */}
            <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
              <Text style={styles.checkoutButtonText}>
                Checkout (${cart.total.toFixed(2)})
              </Text>
            </TouchableOpacity>

            {/* Debug Info */}
            {__DEV__ && (
              <View style={styles.debugInfo}>
                <Text style={styles.debugText}>
                  💡 Try promo codes: SAVE10, SAVE20
                </Text>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  cartItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    backgroundColor: '#f0f0f0',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 16,
    color: '#333',
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6200EE',
  },
  removeButton: {
    marginTop: 8,
    padding: 4,
  },
  removeButtonText: {
    fontSize: 12,
    color: '#f44336',
  },
  footer: {
    marginTop: 8,
  },
  promoSection: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  promoInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  promoButton: {
    backgroundColor: '#6200EE',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    margin: 4,
  },
  promoButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  promoApplied: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  promoAppliedText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  summary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  discountText: {
    color: '#4CAF50',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6200EE',
  },
  checkoutButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  debugInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    alignItems: 'center',
  },
  debugText: {
    fontSize: 12,
    color: '#e65100',
  },
});

export default CartScreen;
