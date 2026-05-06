require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const r2 = require('./config/r2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const s3 = require('./config/r2');
const { generateFileUrl } = require('./utils/fileUrlGenerator');
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
// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Cloudinary Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'waslerr_uploads',
        allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ width: 800, height: 600, crop: 'limit' }]
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
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
        quantity: { type: Number, default: 1 },
        // 🔥 YEH DO FIELDS ADD KAR - BAHUT IMPORTANT!
        version: { type: String, default: null },
        selectedVersionIndex: { type: Number, default: null }
    }],
    updatedAt: { type: Date, default: Date.now }
});

const Cart = mongoose.model('Cart', cartSchema);
// coupoun model
const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    discountPercentage: { type: Number, required: true },
    discountType: {
        type: String,
        enum: ['percent', 'amount'],
        default: 'percent'
    },
    validFrom: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    maxUses: { type: Number, default: null },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Coupon = mongoose.model('Coupon', couponSchema);
// Order Model
const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        productId: { type: String, required: true },
        title: { type: String, required: true },
        artist: { type: String, required: true },
        price: { type: Number, required: true },
        image: { type: String },
        quantity: { type: Number, default: 1 },
        downloadLink: { type: String }
    }],
    totalAmount: { type: Number, required: true },
    paypalOrderId: { type: String, required: true },
    status: { type: String, default: 'pending', enum: ['pending', 'completed', 'failed'] },
    paymentDetails: { type: Object },
    shippingAddress: { type: Object },
    createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// Product Model    
const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    versions: [{
        name: { type: String, required: true },
        price: { type: Number, required: true },
        r2MusicFile: { type: String },
        features: [String]
    }],
    images: [{
        url: { type: String, required: true },
        publicId: { type: String, required: true }
    }],
    artist: { type: String, required: true },
    category: { type: String, default: 'akashik' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
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

app.post('/api/coupons/validate', protect, async (req, res) => {
    try {
        const { code, totalAmount } = req.body; // ✅ totalAmount bhi lo

        if (!code) {
            return res.status(400).json({ success: false, message: 'Coupon code is required' });
        }

        const coupon = await Coupon.findOne({
            code: code.toUpperCase(), // ✅ uppercase match
            isActive: true
        });

        if (!coupon) {
            return res.status(400).json({ success: false, message: 'Invalid coupon code' });
        }

        const now = new Date();

        if (coupon.validFrom && new Date(coupon.validFrom) > now) {
            return res.status(400).json({ success: false, message: 'Coupon not valid yet' });
        }

        if (coupon.validUntil && new Date(coupon.validUntil) < now) {
            return res.status(400).json({ success: false, message: 'Coupon has expired' });
        }

        if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
            return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
        }

        // ✅ discountType ke hisaab se actual amount calculate karo
        const total = Number(totalAmount) || 0;
        let discountAmount = 0;

        if (coupon.discountType === 'amount') {
            discountAmount = coupon.discountPercentage; // fixed Rs/$ value
        } else {
            // percent — total bheja toh calculate karo, nahi toh sirf % return karo
            discountAmount = total > 0
                ? parseFloat((total * coupon.discountPercentage / 100).toFixed(2))
                : coupon.discountPercentage; // fallback
        }

        res.json({
            success: true,
            discountPercentage: coupon.discountPercentage,
            discountType: coupon.discountType || 'percent', // ✅
            discountAmount,  // ✅ sahi amount
            message: 'Coupon applied successfully',
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Payment Routes 
const { sendEmail } = require('./config/nodemailer');

function getSignedDownloadUrl(fileKey) {
    const params = {
        Bucket: process.env.R2_BUCKET_NAME, // Jo bucket tumne .env me setup kiya
        Key: fileKey,                       // e.g. 'Meditation field.mp3'
        Expires: 600,                       // 10 min expiry in seconds
    };
    return s3.getSignedUrl('getObject', params);
}
app.post('/api/payment/free-order', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });

        const cart = await Cart.findOne({ user: req.user.id });
        if (!cart || cart.items.length === 0)
            return res.status(400).json({ success: false, message: "Cart is empty" });

        // ✅ FIXED: cart.total use karo (coupon ke baad ka amount)
        const rawTotal = cart.items.reduce(
            (sum, item) => sum + Number(item.price) * Number(item.quantity),
            0
        );
        const finalTotal = (cart.total !== undefined && cart.total !== null)
            ? cart.total
            : rawTotal;

        if (finalTotal !== 0)
            return res.status(400).json({
                success: false,
                message: "Order total must be zero for free order"
            });

        const itemsWithDownloadLinks = [];
        const downloadLinks = [];

        for (const item of cart.items) {
            console.log('🔍 Processing cart item:', {
                title: item.title,
                version: item.version,
                selectedVersionIndex: item.selectedVersionIndex
            });

            const product = await Product.findById(item.productId);
            if (!product) {
                console.log('❌ Product not found:', item.productId);
                continue;
            }

            let version;
            if (typeof item.selectedVersionIndex === 'number' && product.versions[item.selectedVersionIndex]) {
                version = product.versions[item.selectedVersionIndex];
                console.log('✅ Using version by index:', item.selectedVersionIndex, version.name);
            } else if (item.version) {
                version = product.versions.find(v => v.name === item.version);
                console.log('✅ Using version by name:', item.version);
            } else {
                version = product.versions[0];
                console.log('⚠️ Using default first version');
            }

            if (!version || !version.r2MusicFile) {
                console.log('❌ No valid version or file found');
                continue;
            }

            const url = getSignedDownloadUrl(version.r2MusicFile);

            itemsWithDownloadLinks.push({
                productId: item.productId,
                title: item.title,
                artist: item.artist,
                price: item.price,
                quantity: item.quantity,
                version: version.name,
                selectedVersionIndex: item.selectedVersionIndex,
                image: item.image,
                downloadLink: url
            });

            downloadLinks.push({
                title: product.title,
                artist: product.artist,
                version: version.name,
                versionIndex: item.selectedVersionIndex,
                url,
            });
        }

        console.log('📤 Download links generated:', downloadLinks.length);

        const order = new Order({
            user: req.user.id,
            items: itemsWithDownloadLinks,
            totalAmount: 0,
            paypalOrderId: "freeorder-" + Date.now(),
            status: "completed",
            paymentDetails: { method: "free", email: user.email },
        });
        await order.save();

        // ✅ NEW: Coupon usedCount increment karo
        if (cart.coupon) {
            await Coupon.findByIdAndUpdate(cart.coupon, { $inc: { usedCount: 1 } });
            console.log('✅ Coupon usage incremented');
        }

        await Cart.findOneAndUpdate({ user: req.user.id }, { items: [], total: null, coupon: null, discount: 0 });

        res.json({
            success: true,
            message: "Free order placed!",
            downloadLinks,
            orderId: order._id,
        });
    } catch (err) {
        console.error("Error in free order route:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});
const getPayPalAccessToken = async () => {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('PayPal credentials missing in environment variables');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    const data = await response.json();

    if (!data.access_token) {
        throw new Error('Failed to get PayPal access token: ' + JSON.stringify(data));
    }

    return data.access_token;
};
// ✅ FIXED: create-paypal-order route
app.post('/api/payment/create-paypal-order', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const cart = await Cart.findOne({ user: req.user.id });
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        const extraAmount = Number(req.body.extraAmount || 0);

        const baseTotal = cart.items.reduce((sum, item) => {
            return sum + (Number(item.price) * Number(item.quantity));
        }, 0);

        const discountedBase = (cart.total !== undefined && cart.total !== null && cart.total < baseTotal)
            ? cart.total
            : baseTotal;

        const total = parseFloat((discountedBase + (extraAmount > 0 ? extraAmount : 0)).toFixed(2));

        if (total <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Total is 0 — use free-order route',
                isFree: true,
            });
        }

        const accessToken = await getPayPalAccessToken();

        // ✅ discount ratio for proportional item prices
        const discountRatio = baseTotal > 0 ? discountedBase / baseTotal : 1;

        const orderPayload = {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    amount: {
                        currency_code: 'USD',
                        value: total.toFixed(2),
                        breakdown: {
                            item_total: {
                                currency_code: 'USD',
                                value: discountedBase.toFixed(2),
                            },
                            handling: {
                                currency_code: 'USD',
                                value: extraAmount > 0 ? extraAmount.toFixed(2) : '0.00',
                            },
                        },
                    },
                    // ✅ proportional prices taaki item_total se match ho
                    items: cart.items.map((item) => ({
                        name: `${item.title} by ${item.artist}`.substring(0, 127),
                        unit_amount: {
                            currency_code: 'USD',
                            value: (Number(item.price) * discountRatio).toFixed(2),
                        },
                        quantity: item.quantity.toString(),
                        sku: item.productId.toString().substring(0, 127),
                    })),
                },
            ],
            application_context: {
                brand_name: 'Waslerr',
                user_action: 'PAY_NOW',
                return_url: `${req.headers.origin}/checkout/success`,
                cancel_url: `${req.headers.origin}/cart`,
                shipping_preference: 'NO_SHIPPING',
            },
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        let paypalResponse;
        try {
            const response = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'PayPal-Request-Id': `waslerr-${req.user.id}-${Date.now()}`,
                },
                body: JSON.stringify(orderPayload),
                signal: controller.signal,
            });
            paypalResponse = await response.json();
        } finally {
            clearTimeout(timeout);
        }

        if (!paypalResponse.id) {
            console.error('PayPal API Error:', paypalResponse);
            return res.status(400).json({
                success: false,
                message: 'PayPal order creation failed',
                paypalError: paypalResponse,
            });
        }

        const approveLink = paypalResponse.links?.find(
            (link) => link.rel === 'payer-action' || link.rel === 'approve'
        );
        if (!approveLink) {
            throw new Error('No approval URL found in PayPal response');
        }

        const dbOrder = new Order({
            user: req.user.id,
            items: cart.items,
            totalAmount: total,
            baseAmount: baseTotal,
            discountedAmount: discountedBase,
            extraAmount: extraAmount,
            paypalOrderId: paypalResponse.id,
            status: 'pending',
            paymentDetails: {
                create_time: paypalResponse.create_time,
                links: paypalResponse.links,
            },
        });

        await dbOrder.save();

        return res.json({
            success: true,
            orderID: paypalResponse.id,
            approvalUrl: approveLink.href,
        });

    } catch (err) {
        console.error('PayPal order error:', err.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to create PayPal order',
            message: err.message,
        });
    }
});
// Capture PayPal Order
app.post('/api/payment/capture-paypal-order', protect, async (req, res) => {
    try {
        const { orderID } = req.body;

        if (!orderID) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        // ✅ Direct REST API v2 se capture
        const accessToken = await getPayPalAccessToken();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        let captureData;
        try {
            const response = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({}),
                signal: controller.signal,
            });
            captureData = await response.json();
        } finally {
            clearTimeout(timeout);
        }

        if (captureData.status !== 'COMPLETED') {
            console.error('PayPal capture failed:', captureData);
            return res.status(400).json({
                success: false,
                message: 'Payment capture failed',
                paypalError: captureData,
            });
        }

        // Update order in DB
        const updatedOrder = await Order.findOneAndUpdate(
            { paypalOrderId: orderID, user: req.user.id },
            {
                status: 'completed',
                paymentDetails: captureData
            },
            { new: true }
        ).populate('user', 'name email');

        if (!updatedOrder) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Clear user's cart
        await Cart.findOneAndUpdate({ user: req.user.id }, { items: [] });

        // Get products
        const productIds = updatedOrder.items.map((item) => item.productId);
        const products = await Product.find({ _id: { $in: productIds } });

        const downloadLinks = [];

        for (const item of updatedOrder.items) {
            const product = products.find(p => p._id.toString() === item.productId.toString());
            if (!product) continue;

            let version;
            if (typeof item.selectedVersionIndex === 'number' && product.versions[item.selectedVersionIndex]) {
                version = product.versions[item.selectedVersionIndex];
            } else if (item.version) {
                version = product.versions.find(v => v.name === item.version);
            } else {
                version = product.versions[0];
            }

            if (!version || !version.r2MusicFile) continue;

            const url = getSignedDownloadUrl(version.r2MusicFile);
            downloadLinks.push({
                title: product.title,
                artist: product.artist,
                version: version.name,
                url
            });
        }

        res.json({
            success: true,
            message: 'Payment captured successfully!',
            order: updatedOrder,
            capture: captureData,
            downloadLinks
        });

    } catch (err) {
        console.error('❗ Payment capture error:', err);

        if (req.body.orderID) {
            await Order.findOneAndUpdate(
                { paypalOrderId: req.body.orderID, user: req.user.id },
                { status: 'failed' }
            );
        }

        res.status(500).json({
            success: false,
            error: 'Failed to complete order',
            message: err.message,
        });
    }
});

// Get User Orders
app.get('/api/orders', protect, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
        const productIds = orders.flatMap(o => o.items.map(i => i.productId));
        const products = await Product.find({ _id: { $in: productIds } });

        const ordersWithLinks = orders.map(order => ({
            ...order.toObject(),
            items: order.items.map(item => {
                const itemObj = item.toObject ? item.toObject() : item; // ✅ FIX 1

                const product = products.find(p => p._id.toString() === itemObj.productId?.toString());

                // ✅ FIX 2: product se image lo agar item mein nahi hai
                const productImage = product?.images?.[0]?.url || null;
                const itemImage = itemObj.image || productImage;

                if (!product) return {
                    ...itemObj,
                    image: itemImage,
                    price: Number(itemObj.price) || 0, // ✅ FIX 3
                };

                let version;
                if (typeof itemObj.selectedVersionIndex === 'number' && product.versions[itemObj.selectedVersionIndex]) {
                    version = product.versions[itemObj.selectedVersionIndex];
                } else if (itemObj.version) {
                    version = product.versions.find(v => v.name === itemObj.version);
                } else {
                    version = product.versions[0];
                }

                return {
                    ...itemObj,
                    image: itemImage,                                              // ✅ image fix
                    price: Number(itemObj.price) || 0,                            // ✅ price NaN fix
                    downloadLink: version?.r2MusicFile
                        ? getSignedDownloadUrl(version.r2MusicFile)
                        : null
                };
            })
        }));

        res.json({ success: true, orders: ordersWithLinks });
    } catch (err) {
        console.error('Get orders error:', err);
        res.status(500).json({ success: false, error: 'Failed to get orders', message: err.message });
    }
});

// Get Single Order
app.get('/api/orders/:id', protect, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            order
        });
    } catch (err) {
        console.error('Get order error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to get order',
            message: err.message
        });
    }
});

app.post('/api/admin/coupons', protect, async (req, res) => {
    try {
        const { code, discountPercentage, discountType, validFrom, validUntil, maxUses, isActive } = req.body;

        if (!code || discountPercentage === undefined) {
            return res.status(400).json({ success: false, message: 'Code and discount required' });
        }

        const existing = await Coupon.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Coupon code already exists' });
        }

        const coupon = new Coupon({
            code: code.toUpperCase(),
            discountPercentage: Number(discountPercentage),
            discountType: discountType || 'percent',   // ✅
            validFrom: validFrom || null,
            validUntil: validUntil || null,
            maxUses: maxUses || null,
            isActive: isActive ?? true,
        });

        await coupon.save();
        res.status(201).json({ success: true, message: 'Coupon created', coupon });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating coupon', error: error.message });
    }
});
app.get('/api/admin/coupons', protect, async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json({ success: true, coupons });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching coupons', error: error.message });
    }
});
app.put('/api/admin/coupons/:id', protect, async (req, res) => {
    try {
        const { code, discountPercentage, discountType, validUntil, maxUses, isActive } = req.body;

        const coupon = await Coupon.findByIdAndUpdate(
            req.params.id,
            { code, discountPercentage, discountType, validUntil: validUntil || null, maxUses: maxUses || null, isActive },
            { new: true }
        );

        if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

        res.json({ success: true, message: 'Coupon updated', coupon });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating coupon', error: error.message });
    }
});
app.put('/api/cart', protect, async (req, res) => {
    try {
        const { items, couponCode } = req.body;

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Items must be an array' });
        }

        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        let discountAmount = 0;
        let appliedCoupon = null;

        if (couponCode) {
            const coupon = await Coupon.findOne({
                code: couponCode.toUpperCase(),   // ✅ uppercase match
                isActive: true
            });

            if (!coupon) {
                return res.status(400).json({ error: 'Invalid coupon code' });
            }

            const now = new Date();

            // ✅ Yeh check pehle ulta tha, ab sahi hai
            if (coupon.validUntil && new Date(coupon.validUntil) < now) {
                return res.status(400).json({ error: 'Coupon has expired' });
            }
            if (coupon.validFrom && new Date(coupon.validFrom) > now) {
                return res.status(400).json({ error: 'Coupon is not active yet' });
            }

            // ✅ maxUses check
            if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
                return res.status(400).json({ error: 'Coupon usage limit reached' });
            }

            // ✅ percent ya fixed amount dono handle
            if (coupon.discountType === 'amount') {
                discountAmount = coupon.discountPercentage; // yahan value = fixed Rs/$ amount
            } else {
                discountAmount = total * (coupon.discountPercentage / 100);
            }

            appliedCoupon = coupon;
        }

        const discountedTotal = Math.max(0, total - discountAmount); // ✅ kabhi negative nahi hoga

        let cart = await Cart.findOne({ user: req.user.id });
        if (!cart) cart = new Cart({ user: req.user.id });

        cart.items = items;
        cart.coupon = appliedCoupon ? appliedCoupon._id : null;
        cart.discount = discountAmount;
        cart.total = discountedTotal;

        await cart.save();

        res.json({
            success: true,
            cart,
            originalTotal: total,
            discountAmount,
            finalTotal: discountedTotal,
            isFree: discountedTotal === 0   // ✅ frontend ko pata chalega free hai
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Also improve the GET cart route
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

// Product CRUD Routes

// Create Product with Images
app.post('/api/products', protect, upload.array('images', 5), async (req, res) => {
    try {
        console.log('=== CREATE PRODUCT REQUEST ===');
        console.log('User ID:', req.user.id);
        console.log('Body:', req.body);
        console.log('Files:', req.files);

        const { title, description, versions, artist, category } = req.body;

        // Validate required fields
        if (!title || !description || !artist) {
            return res.status(400).json({
                success: false,
                error: 'Title, description, and artist are required'
            });
        }

        // Check images are uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one image is required'
            });
        }

        // Parse versions if it's a string
        let parsedVersions = [];
        if (versions) {
            try {
                parsedVersions = typeof versions === 'string' ? JSON.parse(versions) : versions;
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid versions format'
                });
            }
        }

        console.log('📦 Parsed versions before validation:', JSON.stringify(parsedVersions, null, 2));

        // ✅ FIXED: price 0 bhi valid hai, trim r2MusicFile
        for (const v of parsedVersions) {
            const price = Number(v.price);
            const r2File = v.r2MusicFile?.trim();

            if (!v.name?.trim()) {
                return res.status(400).json({
                    success: false,
                    error: `Version name is required`
                });
            }
            if (isNaN(price) || v.price === '' || v.price === null || v.price === undefined) {
                return res.status(400).json({
                    success: false,
                    error: `Version "${v.name}" price is invalid`
                });
            }
            if (!r2File) {
                return res.status(400).json({
                    success: false,
                    error: `Version "${v.name}" r2MusicFile is required`
                });
            }
        }

        // ✅ Clean + convert price to number, trim r2MusicFile
        parsedVersions = parsedVersions.map(v => ({
            name: v.name.trim(),
            price: Number(v.price),
            r2MusicFile: v.r2MusicFile.trim(),
            features: Array.isArray(v.features)
                ? v.features.filter(f => f?.trim())
                : []
        }));

        console.log('✅ Final cleaned versions:', JSON.stringify(parsedVersions, null, 2));

        // Process uploaded images
        const images = req.files.map(file => ({
            url: file.path,
            publicId: file.filename
        }));

        // Create product
        const product = new Product({
            title,
            description,
            versions: parsedVersions,
            images,
            artist,
            category: category,
            createdBy: req.user.id
        });

        await product.save();

        console.log('✅ Product created successfully:', product._id);
        console.log('✅ Versions saved:', JSON.stringify(product.versions, null, 2));

        res.status(201).json({
            success: true,
            product,
            message: 'Product created successfully'
        });

    } catch (err) {
        console.error('=== CREATE PRODUCT ERROR ===');
        console.error('Error:', err);

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    await cloudinary.uploader.destroy(file.filename);
                } catch (cleanupErr) {
                    console.error('Cleanup error:', cleanupErr);
                }
            }
        }

        res.status(500).json({
            success: false,
            error: 'Server error',
            message: err.message
        });
    }
});
// Get All Products (Public)
app.get('/api/products', async (req, res) => {
    try {
        const { page = 1, limit = 10, category, search } = req.query;

        const query = { isActive: true };

        if (category && category !== 'all') {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { artist: { $regex: search, $options: 'i' } }
            ];
        }

        const products = await Product.find(query)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Product.countDocuments(query);

        res.json({
            success: true,
            products,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (err) {
        console.error('Get products error:', err);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: err.message
        });
    }
});

// Get Single Product (Public)
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            isActive: true
        }).populate('createdBy', 'name email');

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        res.json({
            success: true,
            product
        });

    } catch (err) {
        console.error('Get product error:', err);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: err.message
        });
    }
});

// Update Product (Protected)
app.put('/api/products/:id', protect, upload.array('newImages', 5), async (req, res) => {
    try {
        console.log('=== UPDATE PRODUCT REQUEST ===');
        console.log('Product ID:', req.params.id);
        console.log('User ID:', req.user.id);
        console.log('Body:', req.body);
        console.log('New Files:', req.files);

        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }
        // ...models and protect middleware ke import...


        // Node/Express, protected
        app.delete('/api/orders', protect, async (req, res) => {
            try {
                await Order.deleteMany({ user: req.user.id });
                res.json({ success: true, message: "All orders cleared" });
            } catch (err) {
                res.status(500).json({ success: false, error: err.message });
            }
        });


        const { title, description, versions, artist, category, removeImages } = req.body;

        // Parse versions if provided
        let parsedVersions = product.versions;
        if (versions) {
            try {
                parsedVersions = typeof versions === 'string' ? JSON.parse(versions) : versions;
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid versions format'
                });
            }
        }

        // Handle image removal
        if (removeImages) {
            const imagesToRemove = typeof removeImages === 'string' ? JSON.parse(removeImages) : removeImages;
            for (const publicId of imagesToRemove) {
                try {
                    await cloudinary.uploader.destroy(publicId);
                    product.images = product.images.filter(img => img.publicId !== publicId);
                } catch (err) {
                    console.error('Error removing image:', err);
                }
            }
        }

        // Add new images
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => ({
                url: file.path,
                publicId: file.filename
            }));
            product.images.push(...newImages);
        }

        // Update fields
        if (title) product.title = title;
        if (description) product.description = description;
        if (versions) product.versions = parsedVersions;
        if (artist) product.artist = artist;
        if (category) product.category = category;

        await product.save();

        console.log('Product updated successfully:', product._id);

        res.json({
            success: true,
            product,
            message: 'Product updated successfully'
        });

    } catch (err) {
        console.error('=== UPDATE PRODUCT ERROR ===');
        console.error('Error:', err);

        res.status(500).json({
            success: false,
            error: 'Server error',
            message: err.message
        });
    }
});

// Delete Product (Protected)
app.delete('/api/products/:id', protect, async (req, res) => {
    try {
        console.log('=== DELETE PRODUCT REQUEST ===');
        console.log('Product ID:', req.params.id);
        console.log('User ID:', req.user.id);

        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Check if user owns the product or is admin


        // Delete images from Cloudinary
        for (const image of product.images) {
            try {
                await cloudinary.uploader.destroy(image.publicId);
            } catch (err) {
                console.error('Error deleting image from Cloudinary:', err);
            }
        }

        await Product.findByIdAndDelete(req.params.id);

        console.log('Product deleted successfully:', req.params.id);

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (err) {
        console.error('=== DELETE PRODUCT ERROR ===');
        console.error('Error:', err);

        res.status(500).json({
            success: false,
            error: 'Server error',
            message: err.message
        });
    }
});

// Get Products by User (Protected)
app.get('/api/products/user/me', protect, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const products = await Product.find({ createdBy: req.user.id })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Product.countDocuments({ createdBy: req.user.id });

        res.json({
            success: true,
            products,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (err) {
        console.error('Get user products error:', err);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: err.message
        });
    }
});
// Admin: Get All Orders (paste karne ke liye jagah: capture-paypal-order route ke baad)
app.get('/api/admin/orders', async (req, res) => {
    try {

        const orders = await Order.find({
            status: 'completed',
            totalAmount: { $gt: 0 }
        })
            .populate('user', 'name email')  // User name + email populate
            .sort({ createdAt: -1 })  // Latest first
            .lean();

        res.json({
            success: true,
            orders,
            count: orders.length
        });
    } catch (err) {
        console.error('Orders error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/admin/orders/completed', async (req, res) => {
    try {
        const orders = await Order.find({ status: 'completed' })  // 🔥 Yahan filter!
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            orders,
            count: orders.length
        });
    } catch (err) {
        console.error('Completed orders error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});
// 🔥 DELETE ORDER ENDPOINT
app.delete('/api/admin/orders/:id', async (req, res) => {
    try {


        const { id } = req.params;
        const deletedOrder = await Order.findByIdAndDelete(id);

        if (!deletedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({
            success: true,
            message: 'Order deleted successfully',
            deletedOrderId: id
        });
    } catch (err) {
        console.error('Delete order error:', err);
        res.status(500).json({ success: false, message: err.message });
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
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);
app.get('/api/orders/:productId/reaccess', protect, async (req, res) => {
    const { productId } = req.params;

    // Logic to find user order and check if purchased
    const order = await Order.findOne({ user: req.user.id, 'items.productId': productId, status: 'completed' });
    if (!order) {
        return res.status(403).json({ success: false, message: 'You need to purchase this item first.' });
    }

    // Purchase verified, ab correct file ka URL generate karna hai
    // Maan lo product file ka naam tumhe order.items me milta hai (jaise order.items[0].filename)
    const purchasedItem = order.items.find(item => item.productId === productId);
    if (!purchasedItem) {
        return res.status(404).json({ success: false, message: 'Product details not found in order.' });
    }

    const fileUrl = generateFileUrl(purchasedItem.filename);

    res.json({
        success: true,
        downloadLink: fileUrl,
        message: 'Access granted! Your purchased file is ready.'
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