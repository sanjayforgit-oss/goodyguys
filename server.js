const express = require('express');
const cookieSession = require('cookie-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Allowed safe image MIME types and file extensions (CWE-434 protection)
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

// Configure Multer for user design / image uploads with strict security filtering
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per image
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are permitted.'));
    }
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security Headers Middleware (CWE-693 defense-in-depth)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cookieSession({
  name: 'session',
  secret: process.env.SESSION_SECRET || 'goodyguys-custom-apparel-secret-key-2026',
  httpOnly: true, // Prevents client-side script access to session cookie (XSS protection)
  sameSite: 'lax', // CSRF mitigation
  maxAge: 7 * 24 * 60 * 60 * 1000
}));

// Paths for JSON storage
const productsPath = path.join(__dirname, 'data', 'products.json');
const suggestionsPath = path.join(__dirname, 'data', 'suggestions.json');
const ordersPath = path.join(__dirname, 'data', 'orders.json');

const getProducts = () => {
  try {
    return JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
  } catch (err) {
    return [];
  }
};

const saveProducts = (data) => {
  fs.writeFileSync(productsPath, JSON.stringify(data, null, 2), 'utf-8');
};

const getSuggestions = () => {
  try {
    return JSON.parse(fs.readFileSync(suggestionsPath, 'utf-8'));
  } catch (err) {
    return [];
  }
};

const saveSuggestions = (data) => {
  fs.writeFileSync(suggestionsPath, JSON.stringify(data, null, 2), 'utf-8');
};

const getOrders = () => {
  try {
    return JSON.parse(fs.readFileSync(ordersPath, 'utf-8'));
  } catch (err) {
    return [];
  }
};

const saveOrders = (data) => {
  fs.writeFileSync(ordersPath, JSON.stringify(data, null, 2), 'utf-8');
};

// Global session middleware
app.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = [];
  if (!req.session.orders) req.session.orders = [];
  res.locals.cartCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
  res.locals.isAdmin = !!req.session.isAdmin;
  next();
});

// 1. Home Page
app.get('/', (req, res) => {
  const products = getProducts();
  const suggestions = getSuggestions();
  res.render('index', { products, allProducts: products, suggestionsCount: suggestions.length });
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
  res.render('products', {
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
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.redirect('/products');
  const related = products.filter(p => p.id !== product.id).slice(0, 3);
  res.render('product-detail', { product, related });
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
    calculatedPrice,
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

  const id = parseInt(productId);
  const products = getProducts();
  const product = products.find(p => p.id === id);
  if (!product) return res.redirect('/products');

  const qty = parseInt(quantity) || 1;

  // Server-authoritative unit price calculation (CWE-602 protection against price tampering)
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

  // Handle uploaded images
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
    customText: customText?.trim() || '',
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
  const idx = parseInt(index);
  if (req.session.cart && req.session.cart[idx]) {
    const qty = parseInt(quantity);
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
  const idx = parseInt(index);
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
  res.render('cart', { cartItems, subtotal });
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
  res.render('checkout', { cartItems, subtotal });
});

// 9. Place Order
app.post('/checkout', upload.single('paymentProof'), (req, res) => {
  const { name, email, phone, address, city, pincode, specialNotes, paymentMethod, upiTransactionId } = req.body || {};
  const products = getProducts();
  const items = (req.session.cart || []).map(item => {
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
  const isUpi = paymentMethod && paymentMethod.includes('UPI');

  const order = {
    id: 'GG' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
    items,
    customer: { name, email, phone, address, city, pincode, specialNotes: specialNotes || '' },
    paymentMethod: paymentMethod || 'COD',
    upiTransactionId: upiTransactionId ? upiTransactionId.trim() : '',
    paymentStatus: isUpi ? 'Pending Verification' : 'COD (Pay on Delivery)',
    paymentProofFile: req.file ? '/uploads/' + req.file.filename : null,
    subtotal,
    shipping,
    total,
    status: isUpi ? 'Payment Verification Needed' : 'Confirmed',
    date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  };

  // Save to persistent file storage
  const allOrders = getOrders();
  allOrders.push(order);
  saveOrders(allOrders);

  // Keep in session
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
  res.render('order-success', { order });
});

// 11. Suggestions Board Page
app.get('/suggest', (req, res) => {
  const suggestions = getSuggestions();
  const successMessage = req.query.submitted ? 'Your suggestion has been submitted! Our workshop team will review it.' : '';
  res.render('suggest', { suggestions, successMessage });
});

// 12. Submit New Suggestion
app.post('/suggest', (req, res) => {
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
  }
  res.redirect('/suggest?submitted=1');
});

// 13. Upvote Suggestion
app.post('/suggest/upvote', (req, res) => {
  const { id } = req.body || {};
  const suggestions = getSuggestions();
  const target = suggestions.find(s => s.id === parseInt(id));
  if (target) {
    target.upvotes = (target.upvotes || 0) + 1;
    saveSuggestions(suggestions);
  }
  res.redirect('/suggest');
});

// 14. Admin Login & Dashboard
app.get('/admin', (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  const orders = getOrders();
  const products = getProducts();
  const suggestions = getSuggestions();
  const activeTab = req.query.tab || 'orders';
  res.render('admin', {
    orders,
    products,
    suggestions,
    suggestionsCount: suggestions.length,
    activeTab
  });
});

app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin');
  res.render('admin-login', { error: null });
});

// Rate limiting map for admin login attempts (CWE-307 brute-force mitigation)
const loginAttempts = new Map();

app.post('/admin/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, resetAt: now + 10 * 60 * 1000 };

  if (now > attempts.resetAt) {
    attempts.count = 0;
    attempts.resetAt = now + 10 * 60 * 1000;
  }

  if (attempts.count >= 5) {
    const minutesLeft = Math.ceil((attempts.resetAt - now) / 60000);
    return res.render('admin-login', {
      error: `Too many failed attempts. Login locked for ${minutesLeft} minute(s) to protect the workshop.`
    });
  }

  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    loginAttempts.delete(ip);
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    attempts.count += 1;
    loginAttempts.set(ip, attempts);
    const remaining = 5 - attempts.count;
    res.render('admin-login', {
      error: `Incorrect workshop password. ${remaining > 0 ? remaining + ' attempt(s) remaining.' : 'Account locked.'}`
    });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  res.redirect('/admin/login');
});

// 15. Update Order Status in Admin
app.post('/admin/orders/status', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  const { orderId, status } = req.body || {};
  const allOrders = getOrders();
  const order = allOrders.find(o => o.id === orderId);
  if (order) {
    order.status = status;
    saveOrders(allOrders);
  }
  res.redirect('/admin?tab=orders');
});

// 15b. Verify Payment in Admin
app.post('/admin/orders/verify-payment', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  const { orderId } = req.body || {};
  const allOrders = getOrders();
  const order = allOrders.find(o => o.id === orderId);
  if (order) {
    order.paymentStatus = 'Paid (Verified by Admin)';
    order.status = 'Printing / Laser Cutting';
    saveOrders(allOrders);
  }
  res.redirect('/admin?tab=orders');
});

// 15c. Admin: Toggle Product Active/Inactive
app.post('/admin/products/toggle', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  const { productId } = req.body || {};
  const allProducts = getProducts();
  const prod = allProducts.find(p => p.id === parseInt(productId));
  if (prod) {
    prod.active = prod.active === false ? true : false;
    saveProducts(allProducts);
  }
  res.redirect('/admin?tab=products');
});

// 15d. Admin: Edit Existing Product
app.post('/admin/products/edit', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  const { productId, name, price, originalPrice, description, badge, category } = req.body || {};
  const allProducts = getProducts();
  const prod = allProducts.find(p => p.id === parseInt(productId));
  if (prod) {
    if (name) prod.name = name;
    if (price) prod.price = parseInt(price);
    if (originalPrice) prod.originalPrice = parseInt(originalPrice);
    if (description) prod.description = description;
    if (badge !== undefined) prod.badge = badge;
    if (category) prod.category = category;
    saveProducts(allProducts);
  }
  res.redirect('/admin?tab=products');
});

// 15e. Admin: Add New Product
app.post('/admin/products/add', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  const { name, category, price, originalPrice, description, badge, customizerType, image } = req.body || {};
  const allProducts = getProducts();
  const newId = allProducts.length > 0 ? Math.max(...allProducts.map(p => p.id)) + 1 : 1;
  const newProduct = {
    id: newId,
    name: name || 'New Custom Product',
    category: category || 'custom',
    customizerType: customizerType || 'image-keychain',
    description: description || 'Custom handcrafted merchandise by GOODYGUYS studio.',
    price: parseInt(price) || 150,
    originalPrice: parseInt(originalPrice) || (parseInt(price) || 150) * 1.5,
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
  res.redirect('/admin?tab=products');
});

// 15f. Admin: Delete Product
app.post('/admin/products/delete', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  const { productId } = req.body || {};
  let allProducts = getProducts();
  allProducts = allProducts.filter(p => p.id !== parseInt(productId));
  saveProducts(allProducts);
  res.redirect('/admin?tab=products');
});

// 15g. Admin: Toggle Product Options (Sizes, Shapes, Placement, Colors)
app.post('/admin/products/toggle-option', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  const { productId, optionType, optionValue, enabled } = req.body || {};
  const allProducts = getProducts();
  const prod = allProducts.find(p => p.id === parseInt(productId));
  if (prod) {
    if (!prod.disabledOptions) prod.disabledOptions = [];
    const optKey = `${optionType}:${optionValue}`;
    if (enabled === 'false') {
      if (!prod.disabledOptions.includes(optKey)) prod.disabledOptions.push(optKey);
    } else {
      prod.disabledOptions = prod.disabledOptions.filter(k => k !== optKey);
    }
    saveProducts(allProducts);
  }
  res.redirect('/admin?tab=options');
});

// 15h. Admin: Update Customer Suggestion Status
app.post('/admin/suggestions/status', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  const { suggestionId, status } = req.body || {};
  const suggestions = getSuggestions();
  const sugg = suggestions.find(s => s.id === parseInt(suggestionId));
  if (sugg) {
    sugg.status = status;
    saveSuggestions(suggestions);
  }
  res.redirect('/admin?tab=suggestions');
});

// 16. API Placeholder Fallback
app.get('/api/placeholder/:width/:height', (req, res) => {
  const { width, height } = req.params;
  const text = req.query.text || 'CustomPrints';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#8b5cf6"/>
        <stop offset="100%" style="stop-color:#ec4899"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)" rx="8"/>
    <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-family="'Inter',sans-serif" font-size="20" font-weight="bold">${text}</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 CustomPrints & Laser Studio running at http://localhost:${PORT}`);
  });
}

module.exports = app;
