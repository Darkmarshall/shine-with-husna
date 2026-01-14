import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, 
  Menu, 
  X, 
  Phone, 
  Instagram, 
  Facebook, 
  Plus, 
  Minus, 
  Trash2, 
  Settings, 
  Package, 
  Users, 
  LogOut, 
  CheckCircle,
  Truck,
  Search,
  Edit2,
  Save,
  ArrowRight,
  Upload,
  Lock,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Constants & Utilities ---
const ADMIN_PASSWORD = 'husna123';

const formatPrice = (price) => {
  return new Intl.NumberFormat('en-AF', {
    style: 'currency',
    currency: 'AFN',
    maximumFractionDigits: 0
  }).format(price);
};

// --- Image Compression Utility ---
// Compresses images to ensure they fit in Firestore documents and load fast
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Resize to max 800px width
        const scaleSize = MAX_WIDTH / img.width;
        
        // If image is smaller than max, don't resize
        if (scaleSize >= 1) {
            resolve(event.target.result); 
            return;
        }

        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Compress to JPEG with 0.7 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = "button" }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-rose-500 text-white hover:bg-rose-600 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed",
    secondary: "bg-white text-rose-900 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 disabled:opacity-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
    outline: "border-2 border-rose-500 text-rose-500 hover:bg-rose-50"
  };

  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <input 
      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all disabled:bg-gray-100"
      {...props}
    />
  </div>
);

const Badge = ({ status }) => {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800"
  };
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${styles[status.toLowerCase()] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

// --- Main Application ---

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); // home, cart, checkout, admin-login, admin-dashboard
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Admin State
  const [adminTab, setAdminTab] = useState('orders'); // orders, products
  const [editingProduct, setEditingProduct] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef(null);

  // --- Authentication & Data Fetching ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, setUser);
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch Products
    const productsRef = collection(db, 'artifacts', appId, 'public', 'data', 'products');
    const unsubscribeProducts = onSnapshot(productsRef, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
      setLoading(false);
    }, (err) => console.error("Error fetching products:", err));

    // Fetch Orders
    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    const unsubscribeOrders = onSnapshot(ordersRef, (snapshot) => {
      const ords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      ords.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setOrders(ords);
    }, (err) => console.error("Error fetching orders:", err));

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
    };
  }, [user]);

  // --- Cart Logic ---
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.qty), 0), [cart]);

  // --- Admin Logic ---
  const handleAdminLogin = (e) => {
    e.preventDefault();
    const pass = e.target.password.value;
    if (pass === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setView('admin-dashboard');
    } else {
      alert('Incorrect password');
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setIsUploading(true);
        const compressedBase64 = await compressImage(file);
        setPreviewUrl(compressedBase64);
        setImageFile(file); // Keep original just in case, though we use base64
        setIsUploading(false);
      } catch (err) {
        console.error("Image processing error", err);
        alert("Error processing image. Please try a different file.");
        setIsUploading(false);
      }
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (isUploading) {
        alert("Please wait for the image to finish processing.");
        return;
    }

    const formData = new FormData(e.target);
    
    // Use previewUrl as the image source (it's the base64 string)
    // If editing and no new image selected, use existing image
    const finalImage = previewUrl || (editingProduct ? editingProduct.image : "https://placehold.co/400x400?text=No+Image");

    const productData = {
      name: formData.get('name'),
      price: Number(formData.get('price')),
      category: formData.get('category'),
      description: formData.get('description'),
      image: finalImage,
      stock: Number(formData.get('stock')),
      updatedAt: serverTimestamp()
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'products'), {
          ...productData,
          createdAt: serverTimestamp()
        });
      }
      
      // Reset Form
      setEditingProduct(null);
      setPreviewUrl('');
      setImageFile(null);
      e.target.reset();
      if(fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Error saving product:", err);
      alert("Failed to save product. The image might be too large.");
    }
  };

  const deleteProduct = async (id) => {
    if (confirm("Are you sure you want to delete this product?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id));
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId), {
      status: newStatus
    });
  };

  // --- Checkout Logic ---
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    const formData = new FormData(e.target);
    const orderData = {
      customerName: formData.get('name'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      items: cart,
      total: cartTotal,
      status: 'Pending',
      timestamp: serverTimestamp(),
      paymentMethod: 'COD'
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), orderData);
      setCart([]);
      setView('order-success');
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Checkout failed. Please try again.");
    }
  };

  const resetForm = () => {
      setEditingProduct(null);
      setPreviewUrl('');
      setImageFile(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
      const form = document.querySelector('form');
      if (form) form.reset();
  }

  // --- Views ---

  const Navbar = () => (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-rose-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center cursor-pointer" onClick={() => setView('home')}>
            <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-white font-bold mr-2">S</div>
            <span className="text-xl font-serif text-rose-950 font-bold tracking-tight">Shine with Husna</span>
          </div>

          <div className="flex items-center space-x-6">
            <button onClick={() => setView('home')} className="hidden md:block text-gray-600 hover:text-rose-600 font-medium">Shop</button>
            <div className="relative cursor-pointer" onClick={() => setView('cart')}>
              <ShoppingBag className="h-6 w-6 text-gray-700 hover:text-rose-600 transition-colors" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </div>
            
            {/* If Admin is logged in, show Dashboard link, else show nothing (hidden from customers) */}
            {isAdmin && (
               <button onClick={() => setView('admin-dashboard')} className="flex items-center text-rose-600 font-medium bg-rose-50 px-3 py-1 rounded-full">
                 <Settings className="w-4 h-4 mr-1" /> Admin
               </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );

  const ProductCard = ({ product }) => (
    <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col h-full">
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Out of stock overlay */}
        {product.stock <= 0 && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-sm">
                <span className="bg-gray-900 text-white px-3 py-1 text-sm font-bold uppercase rounded-full">Out of Stock</span>
            </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <div className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">{product.category}</div>
        <h3 className="text-lg font-serif text-gray-900 mb-2">{product.name}</h3>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-grow">{product.description}</p>
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
          <span className="text-lg font-bold text-rose-900">{formatPrice(product.price)}</span>
          <Button 
            onClick={() => addToCart(product)} 
            className="!px-3 !py-1.5 !text-sm !rounded-full"
            variant={product.stock > 0 ? "secondary" : "outline"}
            disabled={product.stock <= 0}
          >
            {product.stock > 0 ? <><Plus className="w-4 h-4" /> Add</> : "Unavailable"}
          </Button>
        </div>
      </div>
    </div>
  );

  const HomeView = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto mb-16 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-serif text-rose-950 mb-4">Natural Beauty for Radiant Skin</h1>
        <p className="text-gray-600 text-lg">Discover the finest skincare products. Pure, organic, and effective.</p>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-rose-50 rounded-3xl">
          <p className="text-rose-800 text-lg mb-4">No products available yet.</p>
          <p className="text-gray-500">Our collection is being curated.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {products.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );

  const CartView = () => (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h2 className="text-3xl font-serif text-rose-950 mb-8">Your Shopping Cart</h2>
      
      {cart.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Your cart is empty.</p>
          <Button onClick={() => setView('home')} className="mt-6 mx-auto" variant="outline">Start Shopping</Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {cart.map(item => (
              <div key={item.id} className="p-6 flex items-center gap-6">
                <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-lg bg-gray-50" />
                <div className="flex-grow">
                  <h3 className="font-medium text-gray-900 text-lg">{item.name}</h3>
                  <p className="text-rose-600 font-bold mt-1">{formatPrice(item.price)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:bg-gray-100 rounded text-gray-500"><Minus className="w-4 h-4" /></button>
                  <span className="w-8 text-center font-medium">{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:bg-gray-100 rounded text-gray-500"><Plus className="w-4 h-4" /></button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 p-2">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 p-6 border-t border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-600 text-lg">Total</span>
              <span className="text-2xl font-bold text-rose-900">{formatPrice(cartTotal)}</span>
            </div>
            <Button onClick={() => setView('checkout')} className="w-full py-3 text-lg">
              Proceed to Checkout
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const CheckoutView = () => (
    <div className="max-w-xl mx-auto px-4 py-12">
      <button onClick={() => setView('cart')} className="flex items-center text-gray-500 hover:text-rose-600 mb-6">
        <ArrowRight className="w-4 h-4 mr-2 rotate-180" /> Back to Cart
      </button>
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-serif text-rose-950 mb-6">Cash on Delivery Info</h2>
        <form onSubmit={handleCheckout} className="space-y-4">
          <Input name="name" label="Full Name" required placeholder="Full Name" />
          <Input name="phone" label="Phone Number" required placeholder="070 123 4567" type="tel" />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
            <textarea 
              name="address" 
              required 
              rows="3" 
              placeholder="Street, City, Province..." 
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all"
            ></textarea>
          </div>
          
          <div className="bg-rose-50 p-4 rounded-lg flex items-start gap-3 mt-6">
            <CheckCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-rose-800">
              <p className="font-bold">Payment on Delivery</p>
              <p>You will pay <strong>{formatPrice(cartTotal)}</strong> in cash when the courier arrives.</p>
            </div>
          </div>

          <Button type="submit" className="w-full mt-6 py-3">Confirm Order</Button>
        </form>
      </div>
    </div>
  );

  const OrderSuccessView = () => (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-3xl font-serif text-gray-900 mb-2">Order Placed!</h2>
      <p className="text-gray-600 mb-8">Thank you for shopping with Shine with Husna. We will contact you shortly to confirm your delivery.</p>
      <Button onClick={() => setView('home')}>Continue Shopping</Button>
    </div>
  );

  // --- Admin Views ---

  const AdminLogin = () => (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-rose-600" />
          </div>
          <h2 className="text-2xl font-serif text-gray-900">Store Manager</h2>
          <p className="text-sm text-gray-500 mt-1">Restricted Access</p>
        </div>
        <form onSubmit={handleAdminLogin}>
          <Input type="password" name="password" label="Password" required autoFocus />
          <Button type="submit" className="w-full mt-2">Login</Button>
          <button 
            type="button" 
            onClick={() => setView('home')} 
            className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600"
          >
            Return to Store
          </button>
        </form>
      </div>
    </div>
  );

  const AdminDashboard = () => (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-serif text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Manage your inventory and orders.</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => { setIsAdmin(false); setView('home'); }} variant="outline">
             <LogOut className="w-4 h-4" /> Logout
           </Button>
        </div>
      </div>

      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        <button 
          onClick={() => setAdminTab('orders')}
          className={`flex items-center px-6 py-3 rounded-full font-medium transition-all whitespace-nowrap ${adminTab === 'orders' ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
        >
          <Truck className="w-4 h-4 mr-2" /> Orders ({orders.length})
        </button>
        <button 
          onClick={() => setAdminTab('products')}
          className={`flex items-center px-6 py-3 rounded-full font-medium transition-all whitespace-nowrap ${adminTab === 'products' ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
        >
          <Package className="w-4 h-4 mr-2" /> Products ({products.length})
        </button>
      </div>

      {adminTab === 'orders' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 text-sm font-semibold text-gray-600">Ref</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Customer</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Items</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Total</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Date</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="p-4 text-xs font-mono text-gray-500">{order.id.slice(0, 5)}</td>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{order.customerName}</div>
                      <div className="text-sm text-gray-500">{order.phone}</div>
                      <div className="text-xs text-gray-400 mt-1 max-w-[200px] truncate">{order.address}</div>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {order.items.map(i => (
                        <div key={i.id}>{i.qty}x {i.name}</div>
                      ))}
                    </td>
                    <td className="p-4 font-medium text-gray-900">{formatPrice(order.total)}</td>
                    <td className="p-4"><Badge status={order.status} /></td>
                    <td className="p-4 text-sm text-gray-500">
                      {order.timestamp?.seconds ? new Date(order.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}
                    </td>
                    <td className="p-4">
                      <select 
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className="text-sm border-gray-300 rounded-md shadow-sm focus:border-rose-300 focus:ring focus:ring-rose-200 focus:ring-opacity-50 p-1 bg-white border cursor-pointer"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Processing">Processing</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-500">No orders found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Form */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 mb-4">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <form onSubmit={handleProductSubmit} className="space-y-4">
                {/* Image Upload Area */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden"
                        style={{ minHeight: '150px' }}
                    >
                        {(previewUrl || editingProduct?.image) ? (
                            <img 
                                src={previewUrl || editingProduct?.image} 
                                alt="Preview" 
                                className="absolute inset-0 w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                            />
                        ) : (
                            <div className="text-center text-gray-400">
                                <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                                <span className="text-sm">Click to upload image</span>
                            </div>
                        )}
                        
                        {isUploading && (
                             <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
                             </div>
                        )}
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleImageSelect} 
                        accept="image/*" 
                        className="hidden" 
                    />
                    <p className="text-xs text-gray-500 mt-1">Max size optimized automatically.</p>
                </div>

                <Input name="name" label="Product Name" defaultValue={editingProduct?.name} required />
                <div className="grid grid-cols-2 gap-4">
                  <Input name="price" label="Price (AFN)" type="number" defaultValue={editingProduct?.price} required />
                  <Input name="stock" label="Stock" type="number" defaultValue={editingProduct?.stock} required />
                </div>
                <Input name="category" label="Category" defaultValue={editingProduct?.category} placeholder="e.g. Serum, Cream" required />
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea name="description" rows="3" defaultValue={editingProduct?.description} className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-rose-500 outline-none"></textarea>
                </div>
                
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={isUploading}>
                    <Save className="w-4 h-4" /> {editingProduct ? 'Update' : 'Save'}
                  </Button>
                  {editingProduct && (
                    <Button type="button" variant="secondary" onClick={resetForm}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Product List */}
          <div className="lg:col-span-2">
             <div className="grid gap-4">
               {products.map(p => (
                 <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                   <img src={p.image} alt={p.name} className="w-16 h-16 object-cover rounded-lg bg-gray-50" />
                   <div className="flex-grow">
                     <h4 className="font-bold text-gray-900">{p.name}</h4>
                     <p className="text-sm text-gray-500">{p.category} • Stock: {p.stock}</p>
                     <p className="text-rose-600 font-bold">{formatPrice(p.price)}</p>
                   </div>
                   <div className="flex gap-2">
                     <button 
                        onClick={() => {
                            setEditingProduct(p);
                            setPreviewUrl(''); // Clear any pending upload
                            setImageFile(null);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }} 
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                     >
                       <Edit2 className="w-4 h-4" />
                     </button>
                     <button onClick={() => deleteProduct(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                 </div>
               ))}
               {products.length === 0 && (
                 <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-xl">
                   No products found. Start by adding one.
                 </div>
               )}
             </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-rose-100 selection:text-rose-900">
      <Navbar />

      <main className="pb-24">
        {view === 'home' && <HomeView />}
        {view === 'cart' && <CartView />}
        {view === 'checkout' && <CheckoutView />}
        {view === 'order-success' && <OrderSuccessView />}
        {view === 'admin-login' && <AdminLogin />}
        {view === 'admin-dashboard' && <AdminDashboard />}
      </main>

      {/* Floating WhatsApp Button */}
      {!isAdmin && (
          <a 
            href="https://wa.me/93764170902" 
            target="_blank" 
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:bg-[#128C7E] transition-all hover:scale-110 z-50 flex items-center gap-2"
          >
            <Phone className="w-6 h-6" />
            <span className="font-medium hidden sm:block">Chat with us</span>
          </a>
      )}

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif text-rose-950 font-bold mb-4">Shine with Husna</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-8">Premium skincare products curated for your natural glow. Delivery available all across Afghanistan.</p>
          <div className="flex justify-center gap-6 text-gray-400">
            <Instagram className="w-6 h-6 hover:text-rose-600 cursor-pointer" />
            <Facebook className="w-6 h-6 hover:text-blue-600 cursor-pointer" />
          </div>
          
          <div className="flex flex-col items-center mt-8 space-y-4">
             <p className="text-sm text-gray-400">© 2024 Shine with Husna. All rights reserved.</p>
             {/* Discreet Admin Link */}
             {!isAdmin && (
                 <button 
                   onClick={() => setView('admin-login')} 
                   className="text-gray-200 hover:text-gray-400 transition-colors"
                   aria-label="Staff Access"
                 >
                   <Lock className="w-4 h-4" />
                 </button>
             )}
          </div>
        </div>
      </footer>
    </div>
  );
}
