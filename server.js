require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const Admin = require('./models/Admin');


// Initialize app
const app = express();

// Middleware 
const corsOptions = {
    origin: ['http://localhost:5173', 'https://wasllerfield.netlify.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));
app.use(express.json());

// Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Error:', err));

// Models
const User = require('./models/User');
const Music = require('./models/Music');

// Audio Upload Setup
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'music_uploads',
        resource_type: 'auto',
        allowed_formats: ['mp3', 'wav']
    }
});

const upload = multer({ storage });

// Auth Middleware
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.header('x-auth-token')) {
        token = req.header('x-auth-token');
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }
};

// Routes

// Test Route
app.get('/api/test', (req, res) => {
    res.json({ message: "API Working!" });
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
        res.status(500).send('Server error');
    }
});
// Add this to your server.js after existing imports
const Admin = require('./models/Admin');

// Add this after your existing middleware setup
// Admin Auth Middleware
const adminProtect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.header('x-auth-token')) {
        token = req.header('x-auth-token');
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Admin access denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id);

        if (!admin || !admin.isActive) {
            return res.status(401).json({ success: false, message: 'Admin not found or inactive' });
        }
        
        req.admin = admin;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid admin token' });
    }
};

// Add these routes after your existing auth routes

// =================== ADMIN AUTH ROUTES ===================

// Admin Login Route
app.post('/api/admin/login', [
    check('username', 'Username is required').not().isEmpty(),
    check('password', 'Password is required').exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const { username, password } = req.body;

    try {
        // Find admin with password field included
        let admin = await Admin.findOne({ username }).select('+password');

        if (!admin) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if account is locked
        if (admin.isLocked) {
            return res.status(423).json({
                success: false,
                message: 'Account is temporarily locked due to too many failed login attempts'
            });
        }

        // Check if admin is active
        if (!admin.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Admin account is deactivated'
            });
        }

        // Compare password
        const isMatch = await admin.comparePassword(password);

        if (!isMatch) {
            // Increment login attempts
            await admin.incLoginAttempts();
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Reset login attempts on successful login
        await admin.resetLoginAttempts();

        // Create JWT payload
        const payload = {
            id: admin._id,
            username: admin.username,
            role: admin.role,
            type: 'admin'
        };

        // Sign token
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '7d'
        });

        res.json({
            success: true,
            token,
            admin: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
                lastLogin: admin.lastLogin
            }
        });

    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

// Create Admin Route (for development - remove in production)
app.post('/api/admin/create', async (req, res) => {
    try {
        const { username, email, password, role = 'admin' } = req.body;

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({
            $or: [{ username }, { email }]
        });

        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'Admin with this username or email already exists'
            });
        }

        const newAdmin = new Admin({
            username,
            email,
            password,
            role
        });

        await newAdmin.save();

        res.status(201).json({
            success: true,
            message: 'Admin created successfully',
            admin: {
                id: newAdmin._id,
                username: newAdmin.username,
                email: newAdmin.email,
                role: newAdmin.role
            }
        });

    } catch (err) {
        console.error('Create admin error:', err);
        res.status(500).json({
            success: false,
            message: 'Error creating admin'
        });
    }
});

// Get Admin Profile
app.get('/api/admin/profile', adminProtect, async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin._id);
        res.json({
            success: true,
            admin: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: admin.role,
                lastLogin: admin.lastLogin,
                createdAt: admin.createdAt
            }
        });
    } catch (err) {
        console.error('Get admin profile error:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching admin profile'
        });
    }
});

// Update Admin Password
app.put('/api/admin/password', adminProtect, [
    check('currentPassword', 'Current password is required').not().isEmpty(),
    check('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const { currentPassword, newPassword } = req.body;

        // Find admin with password
        const admin = await Admin.findById(req.admin._id).select('+password');

        // Verify current password
        const isMatch = await admin.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        admin.password = newPassword;
        await admin.save();

        res.json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (err) {
        console.error('Update password error:', err);
        res.status(500).json({
            success: false,
            message: 'Error updating password'
        });
    }
});

// Admin Logout (optional - mainly for clearing server-side sessions if needed)
app.post('/api/admin/logout', adminProtect, async (req, res) => {
    try {
        // You can add any server-side logout logic here if needed
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (err) {
        console.error('Admin logout error:', err);
        res.status(500).json({
            success: false,
            message: 'Error during logout'
        });
    }
});

// Initialize default admin on server start
// Add this right before your server listen code
const initializeDefaultAdmin = async () => {
    try {
        await Admin.createDefaultAdmin();
    } catch (error) {
        console.error('Failed to initialize default admin:', error.message);
    }
};

// Call this function when MongoDB connects
// Replace your MongoDB connection code with this:
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('MongoDB Connected');
        await initializeDefaultAdmin();
    })
    .catch(err => console.log('MongoDB Error:', err));
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
        res.status(500).send('Server error');
    }
});


// Music Routes - WITH AUTHENTICATION
app.post('/api/music', protect, upload.single('audio'), async (req, res) => {
    try {
        const { title, description, price } = req.body;
        const newMusic = new Music({
            title,
            description,
            price,
            audioUrl: req.file.path,
            cloudinaryId: req.file.filename,
            user: req.user.id // Now req.user exists because of protect middleware
        });
        await newMusic.save();
        res.status(201).json(newMusic);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/music', async (req, res) => {
    try {
        const music = await Music.find();
        res.json(music);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/music/:id', protect, upload.single('audio'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, price } = req.body;

        const music = await Music.findById(id);
        if (!music) {
            return res.status(404).json({ error: 'Music not found' });
        }

        // Check if user owns the music
        if (music.user.toString() !== req.user.id) {
            return res.status(401).json({ error: 'Not authorized' });
        }

        music.title = title || music.title;
        music.description = description || music.description;
        music.price = price || music.price;

        if (req.file) {
            await cloudinary.uploader.destroy(music.cloudinaryId);
            music.audioUrl = req.file.path;
            music.cloudinaryId = req.file.filename;
        }

        await music.save();
        res.json({ message: 'Music updated successfully', music });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/music/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const music = await Music.findById(id);

        if (!music) {
            return res.status(404).json({ error: 'Music not found' });
        }

        // Check if user owns the music
        if (music.user.toString() !== req.user.id) {
            return res.status(401).json({ error: 'Not authorized' });
        }

        await cloudinary.uploader.destroy(music.cloudinaryId);
        await music.deleteOne(); // Updated method

        res.json({ message: 'Music deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/music/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const music = await Music.findById(id);

        if (!music) {
            return res.status(404).json({ error: 'Music not found' });
        }

        // Check if user owns the music
        if (music.user.toString() !== req.user.id) {
            return res.status(401).json({ error: 'Not authorized' });
        }

        await cloudinary.uploader.destroy(music.cloudinaryId);
        await music.remove();

        res.json({ message: 'Music deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Add this to your server.js if not already present
// Get single music track
app.get('/api/music/:id', async (req, res) => {
    try {
        const music = await Music.findById(req.params.id);
        if (!music) {
            return res.status(404).json({ error: 'Music not found' });
        }
        res.json(music);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/', (req, res) => {
    res.json({
        status: true,

    })
})

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});