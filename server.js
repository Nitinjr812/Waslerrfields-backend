require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');

// Initialize app
const app = express();

// Enhanced CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:3000',
            'http://127.0.0.1:5173',
            'https://your-production-frontend.com'
        ];

        // For development, allow all origins
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-auth-token',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Headers',
        'Origin',
        'Accept',
        'X-Requested-With'
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 200,
    maxAge: 86400 // 24 hours
}));

// Standard payload limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Set timeout for requests
app.use((req, res, next) => {
    req.setTimeout(30000); // 30 seconds
    res.setTimeout(30000); // 30 seconds
    next();
});

// Enhanced CORS headers middleware - MUST be before routes
app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token, Origin, Accept, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// MongoDB Connection with optimized settings
mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Error:', err));

// User Model
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, default: 'user' }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

const User = mongoose.model('User', userSchema);

// Cart Model
const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        productId: { type: String, required: true },
        title: { type: String, required: true },
        artist: { type: String, required: true },
        price: { type: Number, required: true },
        image: { type: String },
        quantity: { type: Number, default: 1 }
    }],
    updatedAt: { type: Date, default: Date.now }
});

const Cart = mongoose.model('Cart', cartSchema);

// Add this after your existing schemas and before your existing routes

// Product Model
const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    artist: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, required: true },
    versions: [{
        versionName: { type: String, required: true }, // e.g., "Standard", "Deluxe", "Premium"
        price: { type: Number, required: true },
        description: { type: String },
        image: { type: String }
    }],
    category: { type: String, default: 'music' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);




// Auth Middleware
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.header('x-auth-token')) {
        token = req.header('x-auth-token');
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.user.id);
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        next();
    } catch (err) {
        console.error('Auth error:', err);
        return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
};

// Update Cart
// Enhanced Update Cart Route with better error handling
app.put('/api/cart', protect, async (req, res) => {
    try {
        console.log('=== CART UPDATE REQUEST ===');
        console.log('User ID:', req.user.id);
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        const { items } = req.body;

        // Validate request body
        if (!items) {
            console.log('ERROR: No items provided');
            return res.status(400).json({
                error: 'Items are required',
                success: false,
                received: req.body
            });
        }

        if (!Array.isArray(items)) {
            console.log('ERROR: Items is not an array, received:', typeof items);
            return res.status(400).json({
                error: 'Items must be an array',
                success: false,
                received: typeof items
            });
        }

        // Validate each item structure with detailed error messages
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log(`Validating item ${i}:`, item);

            const missingFields = [];
            if (!item.productId) missingFields.push('productId');
            if (!item.title) missingFields.push('title');
            if (!item.artist) missingFields.push('artist');
            if (item.price === undefined || item.price === null || isNaN(Number(item.price))) {
                missingFields.push('price (must be a valid number)');
            }
            if (item.quantity === undefined || item.quantity === null || isNaN(Number(item.quantity))) {
                missingFields.push('quantity (must be a valid number)');
            }

            if (missingFields.length > 0) {
                console.log(`ERROR: Item ${i} missing/invalid fields:`, missingFields);
                return res.status(400).json({
                    error: `Item at index ${i} is missing or has invalid fields: ${missingFields.join(', ')}`,
                    success: false,
                    item: item,
                    missingFields: missingFields
                });
            }

            // Ensure numeric fields are properly typed
            items[i].price = Number(item.price);
            items[i].quantity = Number(item.quantity);
        }

        console.log('All validations passed. Processed items:', items);

        // Check if user exists
        const userExists = await User.findById(req.user.id);
        if (!userExists) {
            console.log('ERROR: User not found');
            return res.status(404).json({
                error: 'User not found',
                success: false
            });
        }

        // Update or create cart
        const cart = await Cart.findOneAndUpdate(
            { user: req.user.id },
            {
                items: items,
                updatedAt: new Date()
            },
            {
                new: true,
                upsert: true,  // Create if doesn't exist
                runValidators: true  // Run schema validations
            }
        );

        console.log('Cart updated successfully:', cart._id);
        console.log('Items count:', cart.items.length);

        res.json({
            success: true,
            cart: cart,
            message: 'Cart updated successfully'
        });

    } catch (err) {
        console.error('=== CART UPDATE ERROR ===');
        console.error('Error details:', err);
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);

        // Handle specific MongoDB errors
        if (err.name === 'ValidationError') {
            console.error('Validation error details:', err.errors);
            return res.status(400).json({
                error: 'Validation failed',
                details: err.message,
                validationErrors: err.errors,
                success: false
            });
        }

        if (err.name === 'CastError') {
            return res.status(400).json({
                error: 'Invalid data format',
                details: err.message,
                success: false
            });
        }

        // Generic server error
        res.status(500).json({
            error: 'Internal server error',
            message: err.message,
            success: false
        });
    }
});

app.get('/api/cart', protect, async (req, res) => {
    try {
        console.log('=== GET CART REQUEST ===');
        console.log('User ID:', req.user.id);

        let cart = await Cart.findOne({ user: req.user.id });

        if (!cart) {
            console.log('No cart found, creating new one');
            cart = new Cart({
                user: req.user.id,
                items: [],
                updatedAt: new Date()
            });
            await cart.save();
        }

        console.log('Cart found/created with', cart.items.length, 'items');
        res.json({
            success: true,
            ...cart.toObject()
        });

    } catch (err) {
        console.error('=== GET CART ERROR ===');
        console.error('Error:', err);
        res.status(500).json({
            error: 'Server error',
            message: err.message,
            success: false
        });
    }
});

app.delete('/api/cart', protect, async (req, res) => {
    try {
        const cart = await Cart.findOneAndUpdate(
            { user: req.user.id },
            { items: [] },
            { new: true }
        );
        res.json(cart);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});



// Test Route
app.get('/api/test', (req, res) => {
    res.json({ message: "API Working!", timestamp: new Date().toISOString() });
});

// Auth Routes
app.post('/api/auth/register', [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6+ characters').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        user = new User({ name, email, password });
        await user.save();

        const payload = { user: { id: user._id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' });

        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        let user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const payload = { user: { id: user._id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' });

        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/auth/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add these routes after your existing auth routes

// Get all products (public route)
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({ isActive: true }).sort({ createdAt: -1 });
        res.json({
            success: true,
            products: products
        });
    } catch (err) {
        console.error('Get products error:', err);
        res.status(500).json({
            error: 'Server error',
            message: err.message,
            success: false
        });
    }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        res.json({
            success: true,
            product: product
        });
    } catch (err) {
        console.error('Get product error:', err);
        res.status(500).json({
            error: 'Server error',
            message: err.message,
            success: false
        });
    }
});

// Create new product (admin route - no auth needed as per request)
app.post('/api/admin/products', async (req, res) => {
    try {
        console.log('=== CREATE PRODUCT REQUEST ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        const { title, artist, description, price, image, versions } = req.body;

        // Validate required fields
        const missingFields = [];
        if (!title) missingFields.push('title');
        if (!artist) missingFields.push('artist');
        if (!description) missingFields.push('description');
        if (!price && price !== 0) missingFields.push('price');
        if (!image) missingFields.push('image');

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`,
                missingFields: missingFields
            });
        }

        // Validate price
        if (isNaN(Number(price))) {
            return res.status(400).json({
                success: false,
                error: 'Price must be a valid number'
            });
        }

        // Validate versions if provided
        if (versions && Array.isArray(versions)) {
            for (let i = 0; i < versions.length; i++) {
                const version = versions[i];
                if (!version.versionName || !version.price) {
                    return res.status(400).json({
                        success: false,
                        error: `Version ${i + 1} must have versionName and price`
                    });
                }
                if (isNaN(Number(version.price))) {
                    return res.status(400).json({
                        success: false,
                        error: `Version ${i + 1} price must be a valid number`
                    });
                }
            }
        }

        const productData = {
            title,
            artist,
            description,
            price: Number(price),
            image,
            versions: versions || []
        };

        const product = new Product(productData);
        await product.save();

        console.log('Product created successfully:', product._id);

        res.status(201).json({
            success: true,
            product: product,
            message: 'Product created successfully'
        });

    } catch (err) {
        console.error('=== CREATE PRODUCT ERROR ===');
        console.error('Error:', err);

        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: err.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Server error',
            message: err.message
        });
    }
});

// Update product
app.put('/api/admin/products/:id', async (req, res) => {
    try {
        const { title, artist, description, price, image, versions, isActive } = req.body;

        const updateData = {};
        if (title) updateData.title = title;
        if (artist) updateData.artist = artist;
        if (description) updateData.description = description;
        if (price !== undefined) updateData.price = Number(price);
        if (image) updateData.image = image;
        if (versions !== undefined) updateData.versions = versions;
        if (isActive !== undefined) updateData.isActive = isActive;

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            product: product,
            message: 'Product updated successfully'
        });

    } catch (err) {
        console.error('Update product error:', err);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: err.message
        });
    }
});

// Delete product
app.delete('/api/admin/products/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (err) {
        console.error('Delete product error:', err);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: err.message
        });
    }
});

// Get all products for admin (includes inactive)
app.get('/api/admin/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            products: products
        });
    } catch (err) {
        console.error('Get admin products error:', err);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: err.message
        });
    }
});



// Basic route
app.get("/", (req, res) => {
    res.json({
        status: true,
        message: "API is running!",
        timestamp: new Date().toISOString(),
        cors: "enabled"
    });
});

// Enhanced Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);

    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            error: 'Payload too large'
        });
    }

    res.status(500).json({
        success: false,
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('CORS enabled for all origins');
});