import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, Plus, Minus, Trash2, Settings, Package, 
  LogOut, CheckCircle, Truck, Edit2, Save, ArrowRight, 
  Lock, Image as ImageIcon, Phone, Instagram, Facebook 
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';

// --- Firebase Configuration ---
// Safely access environment variables with fallbacks to avoid build-time "import.meta" errors
const getEnv = (key) => {
  try {
    return import.meta.env[key] || "";
  } catch (e) {
    return "";
  }
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Initialize Firebase only if the config is valid
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization failed. Check your environment variables.", error);
}

// Use a unique ID for your production data storage path
const STORE_ID = "shine_husna_prod_v1";
const ADMIN_PASSWORD = 'AFGNGN18';

// --- Utilities ---
const formatPrice = (price) => {
  return new Intl.NumberFormat('en-AF', {
    style: 'currency',
    currency: 'AFN',
    maximumFractionDigits: 0
  }).format(price);
};

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
    reader.onerror = (err) => reject(err);
  });
};

// --- Components ---
const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = "button" }) => {
  const variants = {
    primary: "bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50",
    secondary: "bg-white text-rose-900 border border-rose-200 hover:bg-rose-50",
    outline: "border-2 border-rose-500 text-rose-500 hover:bg-rose-50"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <input className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:border-rose-500" {...props} />
  </div>
);

// --- Main App ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [adminTab, setAdminTab] = useState('orders');
  const [editingProduct, setEditingProduct] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const pRef = collection(db, 'stores', STORE_ID, 'products');
    const oRef = collection(db, 'stores', STORE_ID, 'orders');

    const unsubP = onSnapshot(pRef, (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => console.error("Products stream error:", err));

    const unsubO = onSnapshot(oRef, (s) => {
      const ords = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(ords.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    }, (err) => console.error("Orders stream error:", err));

    return () => { unsubP(); unsubO(); };
  }, [user]);

  const addToCart = (p) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === p.id);
      if (exists) return prev.map(i => i.id === p.id ? {...i, qty: i.qty + 1} : i);
      return [...prev, {...p, qty: 1}];
    });
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (e.target.password.value === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setView('admin-dashboard');
    } else {
      alert("Wrong password");
    }
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    if (!db) return;
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'),
      price: Number(fd.get('price')),
      category: fd.get('category'),
      stock: Number(fd.get('stock')),
      image: previewUrl || editingProduct?.image || '',
      updatedAt: serverTimestamp()
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'stores', STORE_ID, 'products', editingProduct.id), data);
      } else {
        await addDoc(collection(db, 'stores', STORE_ID, 'products'), {...data, createdAt: serverTimestamp()});
      }
      setEditingProduct(null);
      setPreviewUrl('');
      e.target.reset();
    } catch (err) { alert("Error saving. Firebase permissions or image size issues."); }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!db) return;
    const fd = new FormData(e.target);
    const order = {
      customer: fd.get('name'),
      phone: fd.get('phone'),
      address: fd.get('address'),
      items: cart,
      total: cart.reduce((s, i) => s + (i.price * i.qty), 0),
      status: 'Pending',
      timestamp: serverTimestamp()
    };
    await addDoc(collection(db, 'stores', STORE_ID, 'orders'), order);
    setCart([]);
    setView('success');
  };

  if (!firebaseConfig.apiKey) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 text-center">
        <div className="max-w-md p-8 border rounded-2xl shadow-sm bg-rose-50">
          <h2 className="text-xl font-bold text-rose-900 mb-2">Setup Required</h2>
          <p className="text-rose-700">Please add your Firebase API keys to the Environment Variables in Vercel or your .env file.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-rose-100 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
            <div className="w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center text-white font-bold">S</div>
            <span className="text-xl font-serif font-bold text-rose-950">Shine with Husna</span>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative cursor-pointer" onClick={() => setView('cart')}>
              <ShoppingBag className="w-6 h-6 text-gray-700" />
              {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{cart.length}</span>}
            </div>
            {isAdmin && <Button onClick={() => setView('admin-dashboard')} variant="secondary" className="text-xs py-1">Admin</Button>}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {view === 'home' && (
          <>
            <div className="text-center py-12">
              <h1 className="text-4xl md:text-5xl font-serif text-rose-950 mb-4">Radiant Skincare</h1>
              <p className="text-gray-500">Premium beauty products from Afghanistan.</p>
            </div>
            {loading ? <p className="text-center py-10">Loading products...</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.map(p => (
                  <div key={p.id} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <img src={p.image} className="w-full h-64 object-cover bg-gray-50" alt={p.name} />
                    <div className="p-4">
                      <h3 className="font-bold text-lg">{p.name}</h3>
                      <p className="text-rose-600 font-bold mb-3">{formatPrice(p.price)}</p>
                      <Button onClick={() => addToCart(p)} className="w-full text-sm" disabled={p.stock <= 0}>
                        {p.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view === 'cart' && (
          <div className="max-w-2xl mx-auto py-10">
            <h2 className="text-2xl font-serif mb-6">Your Cart</h2>
            {cart.length === 0 ? <p>Cart is empty</p> : (
              <div className="space-y-4">
                {cart.map(i => (
                  <div key={i.id} className="flex items-center gap-4 border-b pb-4">
                    <img src={i.image} className="w-16 h-16 rounded object-cover" alt={i.name} />
                    <div className="flex-grow">
                      <h4 className="font-bold">{i.name}</h4>
                      <p>{formatPrice(i.price)} x {i.qty}</p>
                    </div>
                    <button onClick={() => setCart(cart.filter(x => x.id !== i.id))}><Trash2 className="w-5 h-5 text-red-400" /></button>
                  </div>
                ))}
                <div className="pt-4 text-right">
                   <p className="text-xl font-bold mb-4">Total: {formatPrice(cart.reduce((s,i) => s+(i.price*i.qty),0))}</p>
                   <Button onClick={() => setView('checkout')} className="w-full py-3">Order Now (COD)</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'checkout' && (
           <form onSubmit={handleCheckout} className="max-w-md mx-auto py-10 space-y-4 bg-white p-6 rounded-xl border">
              <h2 className="text-2xl font-serif mb-4">Delivery Details</h2>
              <Input name="name" label="Full Name" required />
              <Input name="phone" label="Phone Number" required />
              <textarea name="address" placeholder="Delivery Address" className="w-full p-2 border rounded-lg" required rows="3"></textarea>
              <div className="bg-rose-50 p-4 rounded text-sm text-rose-800">Payment: Cash on Delivery</div>
              <Button type="submit" className="w-full">Confirm Order</Button>
           </form>
        )}

        {view === 'success' && (
          <div className="text-center py-20">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-3xl font-serif mb-2">Order Received!</h2>
            <p className="mb-6 text-gray-500">We will call you soon to confirm.</p>
            <Button onClick={() => setView('home')}>Back to Shop</Button>
          </div>
        )}

        {view === 'admin-login' && (
          <div className="max-w-sm mx-auto py-20">
            <form onSubmit={handleAdminLogin} className="border p-8 rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Lock className="w-5 h-5" /> Admin Portal</h2>
              <Input name="password" type="password" label="Enter Password" required />
              <Button type="submit" className="w-full">Login</Button>
            </form>
          </div>
        )}

        {view === 'admin-dashboard' && (
          <div className="py-6">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Store Management</h2>
              <div className="flex gap-2">
                <Button onClick={() => setAdminTab('orders')} variant={adminTab === 'orders' ? 'primary' : 'secondary'}>Orders</Button>
                <Button onClick={() => setAdminTab('products')} variant={adminTab === 'products' ? 'primary' : 'secondary'}>Products</Button>
                <Button onClick={() => { setIsAdmin(false); setView('home'); }} variant="outline"><LogOut className="w-4 h-4" /></Button>
              </div>
            </div>

            {adminTab === 'orders' ? (
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr><th className="p-4">Customer</th><th className="p-4">Items</th><th className="p-4">Total</th><th className="p-4">Status</th></tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id} className="border-t">
                        <td className="p-4">{o.customer}<br/><span className="text-xs text-gray-500">{o.phone}</span></td>
                        <td className="p-4 text-xs">{o.items.map(i => i.name).join(', ')}</td>
                        <td className="p-4 font-bold">{formatPrice(o.total)}</td>
                        <td className="p-4">
                          <select value={o.status} onChange={(e) => updateDoc(doc(db, 'stores', STORE_ID, 'orders', o.id), {status: e.target.value})} className="border rounded text-sm p-1">
                            <option>Pending</option><option>Shipped</option><option>Delivered</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <form onSubmit={saveProduct} className="border p-6 rounded-xl space-y-4">
                  <h3 className="font-bold">{editingProduct ? 'Edit' : 'Add'} Product</h3>
                  <div className="border-2 border-dashed h-40 flex items-center justify-center rounded-lg cursor-pointer overflow-hidden relative" onClick={() => fileInputRef.current.click()}>
                    {previewUrl || editingProduct?.image ? <img src={previewUrl || editingProduct.image} className="w-full h-full object-cover" alt="Preview" /> : <ImageIcon />}
                    <input type="file" ref={fileInputRef} hidden onChange={async e => { if(e.target.files[0]) setPreviewUrl(await compressImage(e.target.files[0])); }} />
                  </div>
                  <Input name="name" label="Name" defaultValue={editingProduct?.name} required />
                  <Input name="price" label="Price (AFN)" type="number" defaultValue={editingProduct?.price} required />
                  <Input name="stock" label="Stock" type="number" defaultValue={editingProduct?.stock} required />
                  <Input name="category" label="Category" defaultValue={editingProduct?.category} required />
                  <Button type="submit" className="w-full">{editingProduct ? 'Update' : 'Add'}</Button>
                  {editingProduct && <Button onClick={() => {setEditingProduct(null); setPreviewUrl('');}} variant="secondary" className="w-full">Cancel</Button>}
                </form>
                <div className="lg:col-span-2 grid gap-4">
                  {products.map(p => (
                    <div key={p.id} className="flex items-center gap-4 border p-3 rounded-lg">
                      <img src={p.image} className="w-12 h-12 rounded object-cover" alt={p.name} />
                      <div className="flex-grow font-medium">{p.name} - {formatPrice(p.price)}</div>
                      <button onClick={() => setEditingProduct(p)}><Edit2 className="w-4 h-4 text-blue-500" /></button>
                      <button onClick={() => deleteDoc(doc(db, 'stores', STORE_ID, 'products', p.id))}><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <a href="https://wa.me/93764170902" target="_blank" rel="noreferrer" className="fixed bottom-6 right-6 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center gap-2">
        <Phone className="w-6 h-6" /><span className="hidden sm:inline">WhatsApp</span>
      </a>

      <footer className="border-t py-12 text-center text-gray-400 text-sm">
        <p>© 2024 Shine with Husna</p>
        <div className="mt-4 flex justify-center gap-4">
          <Instagram className="w-5 h-5 cursor-pointer" />
          <Facebook className="w-5 h-5 cursor-pointer" />
          <Lock className="w-5 h-5 cursor-pointer hover:text-gray-900" onClick={() => setView('admin-login')} />
        </div>
      </footer>
    </div>
  );
}
