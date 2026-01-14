import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Trash2, CheckCircle, Lock, 
  ImageIcon, Phone, Instagram, Facebook, Edit2, LogOut 
} from 'lucide-react';

// Firebase Imports
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot 
} from 'firebase/firestore';

// --- Safe Firebase Initialization ---
const getViteEnv = (key) => {
  try {
    return import.meta.env[key] || "";
  } catch (e) {
    return "";
  }
};

const firebaseConfig = {
  apiKey: getViteEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getViteEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getViteEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getViteEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getViteEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getViteEnv('VITE_FIREBASE_APP_ID')
};

// Initialize Firebase only if we have at least an API Key and Project ID
let auth = null;
let db = null;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.error("Firebase init error:", err);
  }
}

const STORE_ID = "shine_husna_final";

export default function App() {
  const [view, setView] = useState('home');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for missing config to show a helpful message instead of a white screen
  const isConfigMissing = !firebaseConfig.apiKey || !firebaseConfig.projectId;

  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(err => console.error("Auth failed:", err));
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) {
      if (!isConfigMissing) setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'stores', STORE_ID, 'products'), 
      (s) => {
        setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Firestore error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const addToCart = (p) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === p.id);
      if (exists) return prev.map(i => i.id === p.id ? {...i, qty: i.qty + 1} : i);
      return [...prev, {...p, qty: 1}];
    });
  };

  const totalPrice = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  // Error UI for missing Environment Variables
  if (isConfigMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50 p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md border border-rose-100">
          <Lock className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Configuration Required</h2>
          <p className="text-slate-600 mb-6">
            The app is live, but your Firebase Environment Variables are missing in the dashboard settings.
          </p>
          <div className="text-left bg-slate-50 p-4 rounded-lg text-xs font-mono text-slate-500 mb-4">
            Required: VITE_FIREBASE_API_KEY...
          </div>
          <p className="text-sm text-slate-400 italic">Add these to Vercel/Render settings and redeploy.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-rose-100 px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-serif font-bold text-rose-600 cursor-pointer" onClick={() => setView('home')}>
          Shine with Husna
        </h1>
        <div className="flex items-center gap-6">
          <button className="relative p-2" onClick={() => setView('cart')}>
            <ShoppingBag className="w-6 h-6 text-slate-700" />
            {cart.length > 0 && (
              <span className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
          </div>
        ) : (
          <>
            {view === 'home' && (
              <>
                <div className="text-center my-12">
                  <h2 className="text-4xl font-serif font-medium text-slate-800">Skincare that glows with you</h2>
                  <p className="text-slate-500 mt-2">Hand-picked premium products in Afghanistan.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {products.map(product => (
                    <div key={product.id} className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-slate-100 group">
                      <div className="h-64 overflow-hidden bg-slate-100">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                      <div className="p-6">
                        <h3 className="text-lg font-bold">{product.name}</h3>
                        <p className="text-rose-600 font-bold text-xl mt-1">{product.price} AFN</p>
                        <button 
                          onClick={() => addToCart(product)}
                          className="w-full mt-4 bg-rose-500 text-white py-3 rounded-xl font-medium hover:bg-rose-600 transition-colors"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  ))}
                  {products.length === 0 && (
                    <div className="col-span-full text-center py-20 text-slate-400">
                      No products available yet.
                    </div>
                  )}
                </div>
              </>
            )}

            {view === 'cart' && (
              <div className="max-w-2xl mx-auto py-12">
                <h2 className="text-3xl font-serif mb-8">Your Cart</h2>
                {cart.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed rounded-3xl text-slate-400">
                    Your cart is empty.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100">
                        <img src={item.image} className="w-20 h-20 rounded-xl object-cover" alt={item.name} />
                        <div className="flex-grow">
                          <h4 className="font-bold">{item.name}</h4>
                          <p className="text-slate-500">{item.price} AFN × {item.qty}</p>
                        </div>
                        <button onClick={() => setCart(cart.filter(c => c.id !== item.id))} className="text-slate-300 hover:text-red-500">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    <div className="pt-6 border-t flex justify-between items-center text-2xl font-bold">
                      <span>Total</span>
                      <span>{totalPrice} AFN</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-100 py-10 px-6 text-center text-slate-400 text-sm">
        <div className="flex justify-center gap-6 mb-4">
          <Instagram className="w-5 h-5 cursor-pointer hover:text-rose-500" />
          <Facebook className="w-5 h-5 cursor-pointer hover:text-blue-600" />
          <a href="https://wa.me/93764170902" target="_blank" rel="noreferrer"><Phone className="w-5 h-5 hover:text-green-500" /></a>
        </div>
        <p>© 2024 Shine with Husna.</p>
      </footer>
    </div>
  );
}
