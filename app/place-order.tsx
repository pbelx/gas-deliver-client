// app/place-order.tsx - Fixed version
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { apiService, GasCylinder, CreateOrderPayload } from '../services/api';
import { useRouter } from 'expo-router';

interface CartItem extends GasCylinder {
  quantity: number;
}

export default function PlaceOrderScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  
  // State
  const [cylinders, setCylinders] = useState<GasCylinder[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address || '');
  const [deliveryLat, setDeliveryLat] = useState(user?.latitude?.toString() || '');
  const [deliveryLng, setDeliveryLng] = useState(user?.longitude?.toString() || '');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const DELIVERY_FEE = 5000;

  // Load gas cylinders
  useEffect(() => {
    loadCylinders();
  }, []);

  const loadCylinders = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const data = await apiService.getAllGasCylinders(token);
      setCylinders(data.filter(c => c.isAvailable && c.stockQuantity > 0));
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load gas cylinders');
    } finally {
      setLoading(false);
    }
  };

  // Cart operations
  const addToCart = (cylinder: GasCylinder) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === cylinder.id);
      if (existing) {
        if (existing.quantity >= cylinder.stockQuantity) {
          Alert.alert('Stock Limit', `Only ${cylinder.stockQuantity} available`);
          return prev;
        }
        return prev.map(item =>
          item.id === cylinder.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...cylinder, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.id === id) {
            const newQuantity = item.quantity + change;
            if (newQuantity <= 0) return null;
            if (newQuantity > item.stockQuantity) {
              Alert.alert('Stock Limit', `Only ${item.stockQuantity} available`);
              return item;
            }
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + DELIVERY_FEE;

  // Validation
  const canPlaceOrder = () => {
    return cart.length > 0 && 
           deliveryAddress.trim() && 
           deliveryLat && 
           deliveryLng && 
           !loading;
  };

  // Place order - Fixed version
  const placeOrder = async () => {
    if (!user || !token) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    if (!canPlaceOrder()) {
      Alert.alert('Incomplete Order', 'Please fill all required fields and add items');
      return;
    }

    const lat = parseFloat(deliveryLat);
    const lng = parseFloat(deliveryLng);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('Invalid Coordinates', 'Please enter valid latitude and longitude');
      return;
    }

    setLoading(true);
    try {
      // Ensure all fields are properly formatted
      const orderData: CreateOrderPayload = {
        customerId: user.id.toString(), // Ensure it's a string
        items: cart.map(item => ({
          cylinderId: item.id.toString(), // Ensure it's a string
          quantity: Number(item.quantity), // Ensure it's a number
        })),
        deliveryAddress: deliveryAddress.trim(),
        deliveryLatitude: Number(lat), // Ensure it's a number
        deliveryLongitude: Number(lng), // Ensure it's a number
      };

      // Only add special instructions if they exist
      if (instructions.trim()) {
        orderData.specialInstructions = instructions.trim();
      }

      console.log('Final order data being sent:', JSON.stringify(orderData, null, 2));
      console.log('User object:', user);
      console.log('Token exists:', !!token);
      
      const response = await apiService.createOrder(orderData, token);
      
      Alert.alert(
        'Order Placed!',
        `Order #${response.orderNumber} placed successfully!\nTotal: UGX ${response.totalAmount.toLocaleString()}`,
        [
          { text: 'View Orders', onPress: () => router.push('/home') },
          { 
            text: 'New Order', 
            onPress: () => {
              setCart([]);
              setInstructions('');
              loadCylinders(); // Refresh stock
            }
          }
        ]
      );
    } catch (err: any) {
      console.error('Order placement error:', err);
      Alert.alert('Order Failed', err.message || 'Please try again');
      if (err.message?.includes('stock')) {
        loadCylinders(); // Refresh stock if stock error
      }
    } finally {
      setLoading(false);
    }
  };

  // ... (keep all your render functions exactly as they are)

  const renderCylinder = ({ item }: { item: GasCylinder }) => (
    <View style={styles.cylinderCard}>
      <View style={styles.cylinderInfo}>
        <Text style={styles.cylinderName}>{item.name}</Text>
        <Text style={styles.cylinderDetails}>
          {item.weight}kg • {item.brand} • Stock: {item.stockQuantity}
        </Text>
        <Text style={styles.cylinderPrice}>UGX {item.price.toLocaleString()}</Text>
        {item.description && (
          <Text style={styles.cylinderDesc} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.addBtn, loading && styles.disabledBtn]}
        onPress={() => addToCart(item)}
        disabled={loading}
      >
        <Text style={styles.addBtnText}>Add</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartInfo}>
        <Text style={styles.cartName}>{item.name}</Text>
        <Text style={styles.cartPrice}>UGX {item.price.toLocaleString()} each</Text>
      </View>
      <View style={styles.quantityControls}>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => updateQuantity(item.id, -1)}
          disabled={loading}
        >
          <Text style={styles.qtyBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <TouchableOpacity
          style={[styles.qtyBtn, item.quantity >= item.stockQuantity && styles.disabledBtn]}
          onPress={() => updateQuantity(item.id, 1)}
          disabled={loading || item.quantity >= item.stockQuantity}
        >
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.itemTotal}>
        UGX {(item.price * item.quantity).toLocaleString()}
      </Text>
    </View>
  );

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Please log in to place an order</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')}>
          <Text style={styles.loginBtnText}>Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Place Order</Text>
        <Text style={styles.subtitle}>Select gas cylinders and delivery details</Text>
      </View>

      {/* Error Display */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadCylinders} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Available Cylinders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Gas Cylinders</Text>
        {loading && cylinders.length === 0 ? (
          <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
        ) : (
          <FlatList
            data={cylinders}
            renderItem={renderCylinder}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No gas cylinders available</Text>
            }
          />
        )}
      </View>

      {/* Cart */}
      {cart.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Order ({cart.length} items)</Text>
          <FlatList
            data={cart}
            renderItem={renderCartItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Delivery Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Details</Text>
        <TextInput
          style={styles.input}
          placeholder="Delivery Address *"
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          multiline
          editable={!loading}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Latitude *"
            value={deliveryLat}
            onChangeText={setDeliveryLat}
            keyboardType="numeric"
            editable={!loading}
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Longitude *"
            value={deliveryLng}
            onChangeText={setDeliveryLng}
            keyboardType="numeric"
            editable={!loading}
          />
        </View>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Special Instructions (Optional)"
          value={instructions}
          onChangeText={setInstructions}
          multiline
          numberOfLines={3}
          editable={!loading}
        />
      </View>

      {/* Order Summary */}
      {cart.length > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>UGX {subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee:</Text>
            <Text style={styles.summaryValue}>UGX {DELIVERY_FEE.toLocaleString()}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>UGX {total.toLocaleString()}</Text>
          </View>
        </View>
      )}

      {/* Place Order Button */}
      <TouchableOpacity
        style={[styles.orderBtn, !canPlaceOrder() && styles.disabledBtn]}
        onPress={placeOrder}
        disabled={!canPlaceOrder()}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.orderBtnText}>
            Place Order - UGX {total.toLocaleString()}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

// ... (keep all your styles exactly as they are)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    marginBottom: 10,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fee',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#d63384',
    flex: 1,
  },
  retryBtn: {
    backgroundColor: '#d63384',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loginBtn: {
    backgroundColor: '#007bff',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 20,
    borderRadius: 10,
    elevation: 1,
  },
  summarySection: {
    backgroundColor: '#e3f2fd',
    margin: 10,
    padding: 20,
    borderRadius: 10,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  loader: {
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  cylinderCard: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cylinderInfo: {
    flex: 1,
    marginRight: 15,
  },
  cylinderName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cylinderDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  cylinderPrice: {
    fontSize: 15,
    fontWeight: '500',
    color: '#007bff',
    marginBottom: 4,
  },
  cylinderDesc: {
    fontSize: 12,
    color: '#777',
    fontStyle: 'italic',
  },
  addBtn: {
    backgroundColor: '#28a745',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cartInfo: {
    flex: 2,
  },
  cartName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  cartPrice: {
    fontSize: 14,
    color: '#666',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  qtyBtn: {
    backgroundColor: '#007bff',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  quantity: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 15,
    minWidth: 25,
    textAlign: 'center',
  },
  itemTotal: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '47%',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#555',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#2196f3',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  orderBtn: {
    backgroundColor: '#007bff',
    margin: 15,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  orderBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledBtn: {
    backgroundColor: '#ccc',
  },
  bottomSpace: {
    height: 20,
  },
});