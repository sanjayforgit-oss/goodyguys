const path = require('path');
const fs = require('fs');

let db = null;
let isConnected = false;

try {
  let serviceAccount = null;

  // 1. Check Netlify / production environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      serviceAccount = typeof rawEnv === 'object' ? rawEnv : JSON.parse(rawEnv);
      if (typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
    } catch (parseErr) {
      console.warn('[Firebase] Warning: Could not parse FIREBASE_SERVICE_ACCOUNT env:', parseErr.message);
    }
  }

  // 2. Fall back to local file if not in env
  if (!serviceAccount) {
    const localKeyPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(localKeyPath)) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
      } catch (fileErr) {
        console.warn('[Firebase] Warning: Could not parse serviceAccountKey.json:', fileErr.message);
      }
    }
  }

  if (serviceAccount && serviceAccount.project_id && serviceAccount.private_key) {
    const { initializeApp, getApps, cert } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');

    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount)
      });
    }

    db = getFirestore();
    isConnected = true;
    console.log(`🔥 [Firebase] Connected successfully to Cloud Firestore project: "${serviceAccount.project_id}"`);
  } else {
    console.log('ℹ️  [Firebase] No credentials found. Running in local filesystem mode.');
  }
} catch (err) {
  console.warn('[Firebase Initialization Notice]:', err.message);
  db = null;
  isConnected = false;
}

const isFirebaseEnabled = () => isConnected && db !== null;

// ============================================================================
// ORDERS
// ============================================================================
const getOrdersFromFirebase = async () => {
  if (!isFirebaseEnabled()) return null;
  try {
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ ...doc.data(), firestoreDocId: doc.id }));
  } catch (err) {
    // If createdAt index isn't created yet, fall back to un-ordered query
    try {
      const snapshot = await db.collection('orders').get();
      return snapshot.docs.map(doc => ({ ...doc.data(), firestoreDocId: doc.id }));
    } catch (fallbackErr) {
      console.warn('[Firebase getOrders Warning]:', fallbackErr.message);
      return null;
    }
  }
};

const saveOrderToFirebase = async (order) => {
  if (!isFirebaseEnabled()) return false;
  try {
    const { FieldValue } = require('firebase-admin/firestore');
    const docData = {
      ...order,
      createdAt: FieldValue.serverTimestamp()
    };
    await db.collection('orders').doc(order.id).set(docData);
    console.log(`🔥 [Firebase] Order ${order.id} saved to Cloud Firestore.`);
    return true;
  } catch (err) {
    console.warn('[Firebase saveOrder Warning]:', err.message);
    return false;
  }
};

const updateOrderStatusInFirebase = async (orderId, status) => {
  if (!isFirebaseEnabled()) return false;
  try {
    await db.collection('orders').doc(orderId).update({ status });
    return true;
  } catch (err) {
    console.warn('[Firebase updateOrderStatus Warning]:', err.message);
    return false;
  }
};

const verifyPaymentInFirebase = async (orderId) => {
  if (!isFirebaseEnabled()) return false;
  try {
    await db.collection('orders').doc(orderId).update({
      paymentStatus: 'Paid (Verified by Admin)',
      status: 'Printing / Laser Cutting'
    });
    return true;
  } catch (err) {
    console.warn('[Firebase verifyPayment Warning]:', err.message);
    return false;
  }
};

// ============================================================================
// SUGGESTIONS
// ============================================================================
const getSuggestionsFromFirebase = async () => {
  if (!isFirebaseEnabled()) return null;
  try {
    const snapshot = await db.collection('suggestions').get();
    const suggestions = snapshot.docs.map(doc => ({ ...doc.data(), firestoreDocId: doc.id }));
    return suggestions.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
  } catch (err) {
    console.warn('[Firebase getSuggestions Warning]:', err.message);
    return null;
  }
};

const saveSuggestionToFirebase = async (suggestion) => {
  if (!isFirebaseEnabled()) return false;
  try {
    const { FieldValue } = require('firebase-admin/firestore');
    const docId = String(suggestion.id || Date.now());
    await db.collection('suggestions').doc(docId).set({
      ...suggestion,
      createdAt: FieldValue.serverTimestamp()
    });
    console.log(`🔥 [Firebase] Suggestion ${docId} saved to Cloud Firestore.`);
    return true;
  } catch (err) {
    console.warn('[Firebase saveSuggestion Warning]:', err.message);
    return false;
  }
};

const upvoteSuggestionInFirebase = async (suggestionId) => {
  if (!isFirebaseEnabled()) return false;
  try {
    const { FieldValue } = require('firebase-admin/firestore');
    const docId = String(suggestionId);
    await db.collection('suggestions').doc(docId).update({
      upvotes: FieldValue.increment(1)
    });
    return true;
  } catch (err) {
    console.warn('[Firebase upvoteSuggestion Warning]:', err.message);
    return false;
  }
};

const updateSuggestionStatusInFirebase = async (suggestionId, status) => {
  if (!isFirebaseEnabled()) return false;
  try {
    const docId = String(suggestionId);
    await db.collection('suggestions').doc(docId).update({ status });
    return true;
  } catch (err) {
    console.warn('[Firebase updateSuggestionStatus Warning]:', err.message);
    return false;
  }
};

// ============================================================================
// PRODUCTS
// ============================================================================
const getProductsFromFirebase = async () => {
  if (!isFirebaseEnabled()) return null;
  try {
    const snapshot = await db.collection('products').get();
    if (snapshot.empty) return null;
    const prods = snapshot.docs.map(doc => doc.data());
    return prods.sort((a, b) => (a.id || 0) - (b.id || 0));
  } catch (err) {
    console.warn('[Firebase getProducts Warning]:', err.message);
    return null;
  }
};

const syncProductsToFirebase = async (products) => {
  if (!isFirebaseEnabled() || !Array.isArray(products) || products.length === 0) return false;
  try {
    const batch = db.batch();
    products.forEach(p => {
      const docRef = db.collection('products').doc(String(p.id));
      batch.set(docRef, p, { merge: true });
    });
    await batch.commit();
    console.log(`🔥 [Firebase] Synced ${products.length} products to Cloud Firestore.`);
    return true;
  } catch (err) {
    console.warn('[Firebase syncProducts Warning]:', err.message);
    return false;
  }
};

const saveSingleProductToFirebase = async (product) => {
  if (!isFirebaseEnabled()) return false;
  try {
    await db.collection('products').doc(String(product.id)).set(product, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firebase saveProduct Warning]:', err.message);
    return false;
  }
};

const deleteProductFromFirebase = async (productId) => {
  if (!isFirebaseEnabled()) return false;
  try {
    await db.collection('products').doc(String(productId)).delete();
    return true;
  } catch (err) {
    console.warn('[Firebase deleteProduct Warning]:', err.message);
    return false;
  }
};

module.exports = {
  isFirebaseEnabled,
  getOrdersFromFirebase,
  saveOrderToFirebase,
  updateOrderStatusInFirebase,
  verifyPaymentInFirebase,
  getSuggestionsFromFirebase,
  saveSuggestionToFirebase,
  upvoteSuggestionInFirebase,
  updateSuggestionStatusInFirebase,
  getProductsFromFirebase,
  syncProductsToFirebase,
  saveSingleProductToFirebase,
  deleteProductFromFirebase
};
