/**
 * Product Detail Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { RootState, AppDispatch } from '../store';
import { addItem } from '../store/cartSlice';

type ProductDetailScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ProductDetail'>;
  route: RouteProp<RootStackParamList, 'ProductDetail'>;
};

const ProductDetailScreen: React.FC<ProductDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { productId } = route.params;
  const product = useSelector((state: RootState) =>
    state.products.items.find((p) => p.id === productId)
  );
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const isInCart = cartItems.some((item) => item.productId === productId);

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  const handleAddToCart = () => {
    dispatch(addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      imageUrl: product.imageUrl,
    }));
    console.log('[ProductDetailScreen] Added to cart:', product.name);
  };

  const handleBuyNow = () => {
    if (!isInCart) {
      handleAddToCart();
    }
    navigation.navigate('Cart');
    console.log('[ProductDetailScreen] Buy now clicked');
  };

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: product.imageUrl }} style={styles.image} />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{product.name}</Text>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {product.rating}</Text>
          </View>
        </View>
        
        <Text style={styles.category}>{product.category}</Text>
        
        <Text style={styles.price}>${product.price.toFixed(2)}</Text>
        
        <View style={styles.stockBadge}>
          <Text
            style={[
              styles.stockText,
              { color: product.inStock ? '#4CAF50' : '#f44336' },
            ]}
          >
            {product.inStock ? '✓ In Stock' : '✗ Out of Stock'}
          </Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category</Text>
            <Text style={styles.detailValue}>{product.category}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Rating</Text>
            <Text style={styles.detailValue}>{product.rating} / 5.0</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Product ID</Text>
            <Text style={styles.detailValue}>{product.id}</Text>
          </View>
        </View>
        
        {isInCart && (
          <View style={styles.inCartBadge}>
            <Text style={styles.inCartText}>✓ Already in cart</Text>
          </View>
        )}
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.addButton, (!product.inStock || isInCart) && styles.buttonDisabled]}
            onPress={handleAddToCart}
            disabled={!product.inStock || isInCart}
          >
            <Text style={styles.buttonText}>
              {isInCart ? 'In Cart' : 'Add to Cart'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.buyButton, !product.inStock && styles.buttonDisabled]}
            onPress={handleBuyNow}
            disabled={!product.inStock}
          >
            <Text style={styles.buttonText}>Buy Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  image: {
    width: '100%',
    height: 300,
    backgroundColor: '#f0f0f0',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  ratingBadge: {
    backgroundColor: '#fff8e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffa000',
  },
  category: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6200EE',
    marginTop: 16,
  },
  stockBadge: {
    marginTop: 8,
  },
  stockText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#888',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  inCartBadge: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  inCartText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  addButton: {
    flex: 1,
    backgroundColor: '#6200EE',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buyButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProductDetailScreen;
