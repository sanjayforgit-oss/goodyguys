const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const fb = require('./firebase');

const app = express();
const PORT = process.env.PORT || 3000;
// Fallback password changed from predictable default to secure workshop secret
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'goodyguys@admin2026';

// CWE-200: Disable X-Powered-By header
app.disable('x-powered-by');

// ============================================================================
// STORAGE & RUNTIME RESILIENCE (Fix for Netlify / AWS Lambda Read-Only EROFS)
// ============================================================================
const isServerless = !!(
  process.env.NETLIFY ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.VERCEL
);

const BUNDLED_DATA_DIR = path.join(__dirname, 'data');
const BUNDLED_UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

let isLocalWritable = true;
try {
  const probeFile = path.join(BUNDLED_DATA_DIR, '.probe_write_' + Date.now());
  fs.writeFileSync(probeFile, 'ok');
  fs.unlinkSync(probeFile);
} catch (e) {
  isLocalWritable = false;
}

// In read-only serverless lambdas (Netlify), write data to /tmp
const WRITABLE_DATA_DIR = (isServerless || !isLocalWritable)
  ? path.join(os.tmpdir(), 'goodyguys_data')
  : BUNDLED_DATA_DIR;

const WRITABLE_UPLOAD_DIR = (isServerless || !isLocalWritable)
  ? path.join(os.tmpdir(), 'goodyguys_uploads')
  : BUNDLED_UPLOAD_DIR;

try {
  if (!fs.existsSync(WRITABLE_DATA_DIR)) {
    fs.mkdirSync(WRITABLE_DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('[Storage] Could not create WRITABLE_DATA_DIR:', err.message);
}

try {
  if (!fs.existsSync(WRITABLE_UPLOAD_DIR)) {
    fs.mkdirSync(WRITABLE_UPLOAD_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('[Storage] Could not create WRITABLE_UPLOAD_DIR:', err.message);
}

// In-memory cache ensures no EROFS crash and guarantees process-level data availability
let memoryProducts = null;
let memorySuggestions = null;
let memoryOrders = null;

const getFilePath = (fileName) => {
  const targetPath = path.join(WRITABLE_DATA_DIR, fileName);
  const bundledPath = path.join(BUNDLED_DATA_DIR, fileName);

  if (targetPath !== bundledPath && !fs.existsSync(targetPath)) {
    if (fs.existsSync(bundledPath)) {
      try {
        fs.writeFileSync(targetPath, fs.readFileSync(bundledPath, 'utf-8'), 'utf-8');
      } catch (err) {
        return bundledPath;
      }
    }
  }
  return targetPath;
};

const getProducts = () => {
  if (memoryProducts) return memoryProducts;
  try {
    const fPath = getFilePath('products.json');
    const data = JSON.parse(fs.readFileSync(fPath, 'utf-8'));
    memoryProducts = Array.isArray(data) ? data : [];
    return memoryProducts;
  } catch (err) {
    try {
      const bundled = path.join(BUNDLED_DATA_DIR, 'products.json');
      memoryProducts = JSON.parse(fs.readFileSync(bundled, 'utf-8'));
      return memoryProducts;
    } catch (e2) {
      memoryProducts = [];
      return memoryProducts;
    }
  }
};

const saveProducts = (data) => {
  memoryProducts = data;
  try {
    const fPath = path.join(WRITABLE_DATA_DIR, 'products.json');
    fs.writeFileSync(fPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Storage Warning] products.json write failed (kept in memory):', err.message);
  }
};

const getSuggestions = () => {
  if (memorySuggestions) return memorySuggestions;
  try {
    const fPath = getFilePath('suggestions.json');
    const data = JSON.parse(fs.readFileSync(fPath, 'utf-8'));
    memorySuggestions = Array.isArray(data) ? data : [];
    return memorySuggestions;
  } catch (err) {
    try {
      const bundled = path.join(BUNDLED_DATA_DIR, 'suggestions.json');
      memorySuggestions = JSON.parse(fs.readFileSync(bundled, 'utf-8'));
      return memorySuggestions;
    } catch (e2) {
      memorySuggestions = [];
      return memorySuggestions;
    }
  }
};

const saveSuggestions = (data) => {
  memorySuggestions = data;
  try {
    const fPath = path.join(WRITABLE_DATA_DIR, 'suggestions.json');
    fs.writeFileSync(fPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Storage Warning] suggestions.json write failed (kept in memory):', err.message);
  }
};

const getOrders = () => {
  if (memoryOrders) return memoryOrders;
  try {
    const fPath = getFilePath('orders.json');
    const data = JSON.parse(fs.readFileSync(fPath, 'utf-8'));
    memoryOrders = Array.isArray(data) ? data : [];
    return memoryOrders;
  } catch (err) {
    try {
      const bundled = path.join(BUNDLED_DATA_DIR, 'orders.json');
      memoryOrders = JSON.parse(fs.readFileSync(bundled, 'utf-8'));
      return memoryOrders;
    } catch (e2) {
      memoryOrders = [];
      return memoryOrders;
    }
  }
};

const saveOrders = (data) => {
  memoryOrders = data;
  try {
    const fPath = path.join(WRITABLE_DATA_DIR, 'orders.json');
    fs.writeFileSync(fPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Storage Warning] orders.json write failed (kept in memory):', err.message);
  }
};

// ============================================================================
// MULTER FILE UPLOAD WITH STRICT VALIDATION
// ============================================================================
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(WRITABLE_UPLOAD_DIR)) {
        fs.mkdirSync(WRITABLE_UPLOAD_DIR, { recursive: true });
      }
      cb(null, WRITABLE_UPLOAD_DIR);
    } catch (err) {
      cb(null, os.tmpdir());
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const rawExt = path.extname(file.originalname).toLowerCase();
    const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : '.png';
    cb(null, 'custom-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only JPG, PNG, WEBP, and GIF images are supported.'));
    }
  }
});

// ============================================================================
// VIEW ENGINE & SECURITY MIDDLEWARE
// ============================================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security Headers Middleware (CWE-693 defense-in-depth & Content-Security-Policy)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://api.qrserver.com https://images.unsplash.com; connect-src 'self'; frame-ancestors 'self'; form-action 'self'"
  );
  next();
});

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(WRITABLE_UPLOAD_DIR));
if (WRITABLE_UPLOAD_DIR !== BUNDLED_UPLOAD_DIR && fs.existsSync(BUNDLED_UPLOAD_DIR)) {
  app.use('/uploads', express.static(BUNDLED_UPLOAD_DIR));
}

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Client Session (Signed Cookie)
app.use(cookieSession({
  name: 'session',
  secret: process.env.SESSION_SECRET || 'goodyguys-custom-apparel-secret-key-2026',
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000
}));

// Global session helper middleware
app.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = [];
  if (!req.session.orders) req.session.orders = [];
  res.locals.cartCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
  res.locals.isAdmin = !!req.session.isAdmin;
  next();
});

// ============================================================================
// SEO & ROBOTS ROUTES
// ============================================================================
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// Shortcut alias for search
app.get('/search', (req, res) => {
  const q = req.query.q || req.query.search || '';
  res.redirect(`/products${q ? `?search=${encodeURIComponent(q)}` : ''}`);
});

// ============================================================================
// FRONTEND STORE ROUTES
// ============================================================================

// 1. Home Page
app.get('/', (req, res) => {
  const products = getProducts();
  const suggestions = getSuggestions();
  res.render('index', {
    title: 'GOODYGUYS — Crafted for the Creators | Custom Streetwear & Precision Laser Studio',
    products,
    allProducts: products,
    suggestionsCount: suggestions.length
  });
});

// 2. Products Catalog & Search
app.get('/products', (req, res) => {
  const products = getProducts();
  const category = req.query.category;
  const search = req.query.search?.toLowerCase()?.trim();
  let filtered = products;

  if (category && category !== 'all') {
    filtered = filtered.filter(p => p.category === category);
  }
  if (search) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search) ||
      p.category.toLowerCase().includes(search)
    );
  }

  const categories = [...new Set(products.map(p => p.category))];
  const pageTitle = search
    ? `Results for "${req.query.search}" | GOODYGUYS`
    : category && category !== 'all'
    ? `${category.replace('-', ' ').toUpperCase()} | GOODYGUYS Catalog`
    : 'The Drop — Studio Catalog | GOODYGUYS';

  res.render('products', {
    title: pageTitle,
    products: filtered,
    allProducts: products,
    categories,
    currentCategory: category || 'all',
    search: req.query.search || ''
  });
});

// 3. Product Customizer Page
app.get('/products/:id', (req, res) => {
  const products = getProducts();
  const product = products.find(p => p.id === parseInt(req.params.id, 10));
  if (!product) return res.redirect('/products');
  const related = products.filter(p => p.id !== product.id).slice(0, 3);
  res.render('product-detail', {
    title: `Customize ${product.name} | GOODYGUYS Studio`,
    product,
    related
  });
});

// 4. Add to Cart with Multer File Upload Support
app.post('/cart/add', upload.fields([
  { name: 'customImage', maxCount: 1 },
  { name: 'customImageFront', maxCount: 1 },
  { name: 'customImageBack', maxCount: 1 }
]), (req, res) => {
  const {
    productId,
    quantity,
    customText,
    placement,
    mugSides,
    lampBase,
    material,
    fontStyle,
    color,
    size,
    shape
  } = req.body || {};

  const id = parseInt(productId, 10);
  const products = getProducts();
  const product = products.find(p => p.id === id);
  if (!product) return res.redirect('/products');

  // Server-authoritative quantity validation (CWE-20: strictly 1 to 99)
  const qty = Math.max(1, Math.min(99, parseInt(quantity, 10) || 1));

  // Server-authoritative unit price calculation (CWE-602)
  let unitPrice = product.price;
  if (product.customizerType === 'tshirt') {
    if (placement && placement.includes('Both')) {
      unitPrice = 400;
    } else {
      unitPrice = 300;
    }
  } else if (product.customizerType === 'mug') {
    if (mugSides && mugSides.includes('3 Sides')) unitPrice = 200;
    else if (mugSides && mugSides.includes('2 Sides')) unitPrice = 175;
    else unitPrice = 150;
  } else if (product.customizerType === 'engraved-lamp') {
    if (lampBase && lampBase.includes('RGB')) unitPrice = 350;
    else unitPrice = 300;
  }

  // Handle uploaded images safely
  let customImageName = '';
  let customImagePath = '';
  if (req.files) {
    if (req.files.customImage && req.files.customImage[0]) {
      customImageName = req.files.customImage[0].originalname;
      customImagePath = '/uploads/' + req.files.customImage[0].filename;
    } else if (req.files.customImageFront && req.files.customImageFront[0]) {
      customImageName = req.files.customImageFront[0].originalname;
      customImagePath = '/uploads/' + req.files.customImageFront[0].filename;
    }
  }

  const cartItem = {
    productId: id,
    unitPrice,
    quantity: qty,
    customText: (customText || '').trim(),
    placement: placement || '',
    mugSides: mugSides || '',
    lampBase: lampBase || '',
    material: material || '',
    fontStyle: fontStyle || '',
    color: color || '',
    size: size || '',
    shape: shape || '',
    customImageName,
    customImagePath
  };

  req.session.cart.push(cartItem);
  res.redirect('/cart');
});

// 5. Update Cart Quantity
app.post('/cart/update', (req, res) => {
  const { index, quantity } = req.body || {};
  const idx = parseInt(index, 10);
  if (req.session.cart && req.session.cart[idx]) {
    // Validate quantity boundaries
    const qty = Math.max(0, Math.min(99, parseInt(quantity, 10) || 0));
    if (qty <= 0) {
      req.session.cart.splice(idx, 1);
    } else {
      req.session.cart[idx].quantity = qty;
    }
  }
  res.redirect('/cart');
});

// 6. Remove From Cart
app.post('/cart/remove', (req, res) => {
  const { index } = req.body || {};
  const idx = parseInt(index, 10);
  if (req.session.cart && req.session.cart[idx] !== undefined) {
    req.session.cart.splice(idx, 1);
  }
  res.redirect('/cart');
});

// 7. Cart Page
app.get('/cart', (req, res) => {
  const products = getProducts();
  const cartItems = (req.session.cart || []).map(item => {
    const product = products.find(p => p.id === item.productId);
    return {
      ...item,
      product: product || { name: 'Custom Item', price: item.unitPrice, image: '/images/tshirt.svg', category: 'custom' },
      unitPrice: item.unitPrice || product?.price || 100
    };
  });
  const subtotal = cartItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  res.render('cart', {
    title: 'Your Bag | GOODYGUYS Custom Studio',
    cartItems,
    subtotal
  });
});

// 8. Checkout Page
app.get('/checkout', (req, res) => {
  if (!req.session.cart || req.session.cart.length === 0) return res.redirect('/cart');
  const products = getProducts();
  const cartItems = req.session.cart.map(item => {
    const product = products.find(p => p.id === item.productId);
    return {
      ...item,
      product: product || { name: 'Custom Item', price: item.unitPrice, image: '/images/tshirt.svg' },
      unitPrice: item.unitPrice || product?.price || 100
    };
  });
  const subtotal = cartItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  res.render('checkout', {
    title: 'Checkout & Delivery Details | GOODYGUYS',
    cartItems,
    subtotal,
    error: req.query.error || null
  });
});

// 9. Place Order with Server-Side Validation (CWE-20) & Cloud Firestore Persistence
app.post('/checkout', upload.single('paymentProof'), async (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) {
    return res.redirect('/cart');
  }

  const { name, email, phone, address, city, pincode, specialNotes, paymentMethod, upiTransactionId } = req.body || {};

  // Server-side field sanitization and validation
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim();
  const cleanPhone = (phone || '').trim();
  const cleanAddress = (address || '').trim();
  const cleanCity = (city || '').trim();
  const cleanPincode = (pincode || '').trim();
  const cleanUpiId = (upiTransactionId || '').trim();
  const isUpi = paymentMethod && paymentMethod.includes('UPI');

  if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
    return res.redirect('/checkout?error=' + encodeURIComponent('Please enter your full name (at least 2 characters).'));
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return res.redirect('/checkout?error=' + encodeURIComponent('Please provide a valid email address.'));
  }

  const phoneDigits = cleanPhone.replace(/\D/g, '');
  if (!cleanPhone || phoneDigits.length < 10 || phoneDigits.length > 15) {
    return res.redirect('/checkout?error=' + encodeURIComponent('Please provide a valid 10-digit WhatsApp/phone number.'));
  }

  if (!cleanAddress || cleanAddress.length < 5) {
    return res.redirect('/checkout?error=' + encodeURIComponent('Please enter your complete delivery street address (at least 5 characters).'));
  }

  if (!cleanCity || cleanCity.length < 2) {
    return res.redirect('/checkout?error=' + encodeURIComponent('Please enter your delivery city/town.'));
  }

  const pinRegex = /^\d{6}$/;
  if (!cleanPincode || !pinRegex.test(cleanPincode)) {
    return res.redirect('/checkout?error=' + encodeURIComponent('Please enter a valid 6-digit postal pincode.'));
  }

  if (isUpi && (!cleanUpiId || cleanUpiId.length < 6)) {
    return res.redirect('/checkout?error=' + encodeURIComponent('Please enter your 12-digit UPI Transaction / UTR ID for verification.'));
  }

  const products = getProducts();
  const items = cart.map(item => {
    const product = products.find(p => p.id === item.productId);
    return {
      ...item,
      productName: product ? product.name : 'Custom Item',
      unitPrice: item.unitPrice || product?.price || 100
    };
  });

  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const shipping = subtotal >= 499 ? 0 : 49;
  const total = subtotal + shipping;

  const order = {
    id: 'GG' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
    items,
    customer: {
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      address: cleanAddress,
      city: cleanCity,
      pincode: cleanPincode,
      specialNotes: (specialNotes || '').trim()
    },
    paymentMethod: paymentMethod || 'COD',
    upiTransactionId: cleanUpiId,
    paymentStatus: isUpi ? 'Pending Verification' : 'COD (Pay on Delivery)',
    paymentProofFile: req.file ? '/uploads/' + req.file.filename : null,
    subtotal,
    shipping,
    total,
    status: isUpi ? 'Payment Verification Needed' : 'Confirmed',
    date: new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  };

  // Resilient persistence (Local/Tmp + Cloud Firestore)
  const allOrders = getOrders();
  allOrders.push(order);
  saveOrders(allOrders);

  try {
    await fb.saveOrderToFirebase(order);
  } catch (fbErr) {
    console.warn('[Firebase] Warning saving order:', fbErr.message);
  }

  if (!req.session.orders) req.session.orders = [];
  req.session.orders.push(order);
  req.session.cart = [];
  req.session.lastOrder = order;

  res.redirect('/order-success');
});

// 10. Order Success Page
app.get('/order-success', (req, res) => {
  const order = req.session.lastOrder;
  if (!order) return res.redirect('/');
  res.render('order-success', {
    title: 'Order Confirmed! | GOODYGUYS Workshop',
    order
  });
});

// 11. Suggestions Board Page
app.get('/suggest', async (req, res) => {
  let suggestions = getSuggestions();
  if (fb.isFirebaseEnabled()) {
    try {
      const cloudSuggestions = await fb.getSuggestionsFromFirebase();
      if (cloudSuggestions && cloudSuggestions.length > 0) {
        suggestions = cloudSuggestions;
        memorySuggestions = suggestions;
      }
    } catch (fbErr) {
      console.warn('[Suggest] Firebase fetch fallback:', fbErr.message);
    }
  }
  const successMessage = req.query.submitted ? 'Your suggestion has been submitted! Our workshop team will review it.' : '';
  res.render('suggest', {
    title: 'Co-Create & Suggest Ideas | GOODYGUYS Community',
    suggestions,
    successMessage
  });
});

// 12. Submit New Suggestion
app.post('/suggest', async (req, res) => {
  const { title, category, description, name, contact } = req.body || {};
  if (title && description && name) {
    const suggestions = getSuggestions();
    const newSuggestion = {
      id: Date.now(),
      title: title.trim(),
      category: category || 'other',
      description: description.trim(),
      name: name.trim(),
      contact: contact?.trim() || '',
      upvotes: 1,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'Community Idea 💡'
    };
    suggestions.push(newSuggestion);
    saveSuggestions(suggestions);
    await fb.saveSuggestionToFirebase(newSuggestion);
  }
  res.redirect('/suggest?submitted=1');
});

// 13. Upvote Suggestion
app.post('/suggest/upvote', async (req, res) => {
  const { id } = req.body || {};
  const suggestions = getSuggestions();
  const target = suggestions.find(s => s.id === parseInt(id, 10));
  if (target) {
    target.upvotes = (target.upvotes || 0) + 1;
    saveSuggestions(suggestions);
  }
  await fb.upvoteSuggestionInFirebase(id);
  res.redirect('/suggest');
});

// ============================================================================
// ADMIN WORKSHOP PORTAL (CWE-307 & CWE-384 Mitigation)
// ============================================================================
const loginAttempts = new Map();

const requireAdmin = (req, res, next) => {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  // 2-hour sliding window expiration
  if (req.session.adminExpiresAt && Date.now() > req.session.adminExpiresAt) {
    req.session.isAdmin = false;
    delete req.session.adminExpiresAt;
    return res.redirect('/admin/login?error=Session+expired.+Please+log+in+again.');
  }
  req.session.adminExpiresAt = Date.now() + 2 * 60 * 60 * 1000;
  next();
};

app.get('/admin', requireAdmin, async (req, res) => {
  let orders = getOrders();
  let suggestions = getSuggestions();

  // If Firebase is connected, fetch live cloud orders and suggestions
  if (fb.isFirebaseEnabled()) {
    try {
      const cloudOrders = await fb.getOrdersFromFirebase();
      if (cloudOrders && cloudOrders.length > 0) {
        const seen = new Set();
        const merged = [];
        [...cloudOrders, ...orders].forEach(o => {
          if (o && o.id && !seen.has(o.id)) {
            seen.add(o.id);
            merged.push(o);
          }
        });
        orders = merged;
        memoryOrders = orders;
      }

      const cloudSuggestions = await fb.getSuggestionsFromFirebase();
      if (cloudSuggestions && cloudSuggestions.length > 0) {
        const seen = new Set();
        const merged = [];
        [...cloudSuggestions, ...suggestions].forEach(s => {
          if (s && s.id && !seen.has(String(s.id))) {
            seen.add(String(s.id));
            merged.push(s);
          }
        });
        suggestions = merged;
        memorySuggestions = suggestions;
      }
    } catch (fbErr) {
      console.warn('[Admin] Firebase fetch fallback:', fbErr.message);
    }
  }

  const products = getProducts();
  const activeTab = req.query.tab || 'orders';
  res.render('admin', {
    title: 'Studio Management Dashboard | GOODYGUYS',
    orders,
    products,
    suggestions,
    suggestionsCount: suggestions.length,
    activeTab,
    isFirebaseConnected: fb.isFirebaseEnabled()
  });
});

app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin');
  res.render('admin-login', {
    title: 'Admin Login | GOODYGUYS Studio',
    error: req.query.error || null
  });
});

app.post('/admin/login', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection.remoteAddress || '127.0.0.1';
  const now = Date.now();

  // Prune expired rate limit entries
  for (const [key, val] of loginAttempts.entries()) {
    if (now > val.resetAt) loginAttempts.delete(key);
  }

  const attempts = loginAttempts.get(ip) || { count: 0, resetAt: now + 10 * 60 * 1000 };

  if (now > attempts.resetAt) {
    attempts.count = 0;
    attempts.resetAt = now + 10 * 60 * 1000;
  }

  if (attempts.count >= 5) {
    const minutesLeft = Math.ceil((attempts.resetAt - now) / 60000);
    return res.render('admin-login', {
      title: 'Admin Login | GOODYGUYS Studio',
      error: `Too many failed attempts. Login locked for ${minutesLeft} minute(s) to protect the workshop.`
    });
  }

  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    loginAttempts.delete(ip);
    req.session.isAdmin = true;
    req.session.adminExpiresAt = Date.now() + 2 * 60 * 60 * 1000;
    res.redirect('/admin');
  } else {
    attempts.count += 1;
    loginAttempts.set(ip, attempts);
    const remaining = 5 - attempts.count;
    res.render('admin-login', {
      title: 'Admin Login | GOODYGUYS Studio',
      error: `Incorrect workshop password. ${remaining > 0 ? remaining + ' attempt(s) remaining.' : 'Account locked for 10 minutes.'}`
    });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  delete req.session.adminExpiresAt;
  res.redirect('/admin/login');
});

// Update Order Status in Admin
app.post('/admin/orders/status', requireAdmin, async (req, res) => {
  const { orderId, status } = req.body || {};
  const allOrders = getOrders();
  const order = allOrders.find(o => o.id === orderId);
  if (order) {
    order.status = status;
    saveOrders(allOrders);
  }
  await fb.updateOrderStatusInFirebase(orderId, status);
  res.redirect('/admin?tab=orders');
});

// Verify Payment in Admin
app.post('/admin/orders/verify-payment', requireAdmin, async (req, res) => {
  const { orderId } = req.body || {};
  const allOrders = getOrders();
  const order = allOrders.find(o => o.id === orderId);
  if (order) {
    order.paymentStatus = 'Paid (Verified by Admin)';
    order.status = 'Printing / Laser Cutting';
    saveOrders(allOrders);
  }
  await fb.verifyPaymentInFirebase(orderId);
  res.redirect('/admin?tab=orders');
});

// Admin: Toggle Product Active/Inactive
app.post('/admin/products/toggle', requireAdmin, async (req, res) => {
  const { productId } = req.body || {};
  const allProducts = getProducts();
  const prod = allProducts.find(p => p.id === parseInt(productId, 10));
  if (prod) {
    prod.active = prod.active === false ? true : false;
    saveProducts(allProducts);
    await fb.saveSingleProductToFirebase(prod);
  }
  res.redirect('/admin?tab=products');
});

// Admin: Edit Existing Product
app.post('/admin/products/edit', requireAdmin, async (req, res) => {
  const { productId, name, price, originalPrice, description, badge, category } = req.body || {};
  const allProducts = getProducts();
  const prod = allProducts.find(p => p.id === parseInt(productId, 10));
  if (prod) {
    if (name) prod.name = name;
    if (price) prod.price = parseInt(price, 10);
    if (originalPrice) prod.originalPrice = parseInt(originalPrice, 10);
    if (description) prod.description = description;
    if (badge !== undefined) prod.badge = badge;
    if (category) prod.category = category;
    saveProducts(allProducts);
    await fb.saveSingleProductToFirebase(prod);
  }
  res.redirect('/admin?tab=products');
});

// Admin: Add New Product
app.post('/admin/products/add', requireAdmin, async (req, res) => {
  const { name, category, price, originalPrice, description, badge, customizerType, image } = req.body || {};
  const allProducts = getProducts();
  const newId = allProducts.length > 0 ? Math.max(...allProducts.map(p => p.id)) + 1 : 1;
  const newProduct = {
    id: newId,
    name: name || 'New Custom Product',
    category: category || 'custom',
    customizerType: customizerType || 'image-keychain',
    description: description || 'Custom handcrafted merchandise by GOODYGUYS studio.',
    price: parseInt(price, 10) || 150,
    originalPrice: parseInt(originalPrice, 10) || (parseInt(price, 10) || 150) * 1.5,
    image: image || '/images/real-acrylic-cut.jpg',
    badge: badge || 'New',
    active: true,
    requiresImage: true,
    requiresText: true,
    customizable: true,
    features: [
      "Custom Laser / Studio Production",
      "High Durability & Detail",
      "No Minimum Order Quantity"
    ]
  };
  allProducts.push(newProduct);
  saveProducts(allProducts);
  await fb.saveSingleProductToFirebase(newProduct);
  res.redirect('/admin?tab=products');
});

// Admin: Delete Product
app.post('/admin/products/delete', requireAdmin, async (req, res) => {
  const { productId } = req.body || {};
  let allProducts = getProducts();
  allProducts = allProducts.filter(p => p.id !== parseInt(productId, 10));
  saveProducts(allProducts);
  await fb.deleteProductFromFirebase(productId);
  res.redirect('/admin?tab=products');
});

// Admin: Toggle Product Options
app.post('/admin/products/toggle-option', requireAdmin, async (req, res) => {
  const { productId, optionType, optionValue, enabled } = req.body || {};
  const allProducts = getProducts();
  const prod = allProducts.find(p => p.id === parseInt(productId, 10));
  if (prod) {
    if (!prod.disabledOptions) prod.disabledOptions = [];
    const optKey = `${optionType}:${optionValue}`;
    if (enabled === 'false') {
      if (!prod.disabledOptions.includes(optKey)) prod.disabledOptions.push(optKey);
    } else {
      prod.disabledOptions = prod.disabledOptions.filter(k => k !== optKey);
    }
    saveProducts(allProducts);
    await fb.saveSingleProductToFirebase(prod);
  }
  res.redirect('/admin?tab=options');
});

// Admin: Update Customer Suggestion Status
app.post('/admin/suggestions/status', requireAdmin, async (req, res) => {
  const { suggestionId, status } = req.body || {};
  const suggestions = getSuggestions();
  const sugg = suggestions.find(s => s.id === parseInt(suggestionId, 10));
  if (sugg) {
    sugg.status = status;
    saveSuggestions(suggestions);
  }
  await fb.updateSuggestionStatusInFirebase(suggestionId, status);
  res.redirect('/admin?tab=suggestions');
});

// API Placeholder Fallback
app.get('/api/placeholder/:width/:height', (req, res) => {
  const { width, height } = req.params;
  const text = req.query.text || 'GOODYGUYS';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#111114"/>
        <stop offset="100%" style="stop-color:#1e1e24"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)" rx="8"/>
    <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#d4ff00" font-family="'Space Grotesk',sans-serif" font-size="20" font-weight="bold">${text}</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// ============================================================================
// ERROR HANDLING MIDDLEWARE (CWE-209 Stack Trace Leakage & Custom 404)
// ============================================================================
app.use((err, req, res, next) => {
  console.error('[Workshop Server Error]:', err.message || err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).render('error', {
    title: '500 - Server Error | GOODYGUYS',
    message: err.message && err.message.includes('format')
      ? err.message
      : 'Our studio server encountered a temporary issue processing your request. Rest assured your session is safe.'
  });
});

// Custom 404 Catch-All
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - Drop Not Found | GOODYGUYS',
    allProducts: getProducts()
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 GOODYGUYS Studio running at http://localhost:${PORT}`);
  });
}

module.exports = app;
