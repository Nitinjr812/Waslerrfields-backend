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

// Initialize app
const app = express();

// SIMPLIFIED CORS - Remove duplicate middleware
const corsOptions = {
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
    credentials: true,
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
    ]
};

app.use(cors(corsOptions));

// Increase payload limits for large files - BEFORE other middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true, parameterLimit: 50000 }));

// Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Error:', err));

// Models
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

const musicSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    audioUrl: { type: String, required: true },
    cloudinaryId: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Music = mongoose.model('Music', musicSchema);

// Enhanced Audio Upload Setup with chunked upload
// In your backend (server.js), enhance the CORS and upload handling:

// Replace your current CORS setup with this more permissive one for testing:
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400
}));

// Add this middleware to handle preflight requests
app.options('*', cors());

// Modify your Cloudinary storage config:
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'music_uploads',
        resource_type: 'auto',
        allowed_formats: ['mp3', 'wav', 'mpeg'],
        chunk_size: 20 * 1024 * 1024, // Increase to 20MB chunks
        timeout: 120000 // 2 minutes timeout per chunk
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
        fieldSize: 100 * 1024 * 1024,
        files: 1,
        fields: 10
    },
    fileFilter: (req, file, cb) => {
        console.log('File received:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });

        const allowedTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Only MP3 and WAV files are allowed!`), false);
        }
    }
});

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

// FIXED Music Upload Route with better timeout handling
app.post('/api/music', protect, (req, res) => {
    console.log('POST /api/music - Request received');
    console.log('Headers:', req.headers);

    // Extend timeout for this specific route
    req.setTimeout(900000); // 15 minutes
    res.setTimeout(900000); // 15 minutes

    // Add progress logging
    let uploadStartTime = Date.now();

    upload.single('audio')(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    error: "File too large. Maximum size is 100MB"
                });
            }
            return res.status(400).json({
                success: false,
                error: err.message || "File upload error"
            });
        }

        try {
            console.log('Upload time so far:', (Date.now() - uploadStartTime) / 1000, 'seconds');
            console.log('Request body:', req.body);
            console.log('File info:', req.file ? {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                path: req.file.path
            } : 'No file');

            // Validate required fields
            if (!req.body.title || !req.body.price) {
                return res.status(400).json({
                    success: false,
                    error: "Title and price are required"
                });
            }

            // Validate audio file
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: "Audio file is required"
                });
            }

            const newMusic = new Music({
                title: req.body.title,
                description: req.body.description || '',
                price: parseFloat(req.body.price),
                audioUrl: req.file.path,
                cloudinaryId: req.file.filename,
                user: req.user._id
            });

            await newMusic.save();

            console.log('Music saved successfully:', newMusic._id);
            console.log('Total time:', (Date.now() - uploadStartTime) / 1000, 'seconds');

            res.status(201).json({
                success: true,
                message: 'Music uploaded successfully',
                data: newMusic
            });

        } catch (err) {
            console.error('Error creating music:', err);
            res.status(500).json({
                success: false,
                error: "Server error",
                message: err.message
            });
        }
    });
});

app.get('/api/music', async (req, res) => {
    try {
        const music = await Music.find().populate('user', 'name email').sort({ createdAt: -1 });
        res.json(music);
    } catch (err) {
        console.error('Error fetching music:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/music/:id', protect, (req, res) => {
    // Set longer timeout for updates with potential file uploads
    req.setTimeout(900000);
    res.setTimeout(900000);

    upload.single('audio')(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    error: "File too large. Maximum size is 100MB"
                });
            }
            return res.status(400).json({
                success: false,
                error: err.message || "File upload error"
            });
        }

        try {
            const { id } = req.params;
            const { title, description, price } = req.body;

            const music = await Music.findById(id);
            if (!music) {
                return res.status(404).json({ error: 'Music not found' });
            }

            // Check if user owns the music
            if (music.user.toString() !== req.user._id.toString()) {
                return res.status(401).json({ error: 'Not authorized' });
            }

            // Update fields
            music.title = title || music.title;
            music.description = description !== undefined ? description : music.description;
            music.price = price ? parseFloat(price) : music.price;

            // Update audio if new file provided
            if (req.file) {
                // Delete old file from Cloudinary
                if (music.cloudinaryId) {
                    try {
                        await cloudinary.uploader.destroy(music.cloudinaryId, { resource_type: 'auto' });
                    } catch (deleteErr) {
                        console.error('Error deleting old file:', deleteErr);
                    }
                }
                music.audioUrl = req.file.path;
                music.cloudinaryId = req.file.filename;
            }

            await music.save();
            res.json({
                success: true,
                message: 'Music updated successfully',
                data: music
            });
        } catch (err) {
            console.error('Error updating music:', err);
            res.status(500).json({ error: err.message });
        }
    });
});

app.delete('/api/music/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const music = await Music.findById(id);

        if (!music) {
            return res.status(404).json({ error: 'Music not found' });
        }

        // Check if user owns the music
        if (music.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ error: 'Not authorized' });
        }

        // Delete from Cloudinary
        if (music.cloudinaryId) {
            try {
                await cloudinary.uploader.destroy(music.cloudinaryId, { resource_type: 'auto' });
            } catch (deleteErr) {
                console.error('Error deleting from Cloudinary:', deleteErr);
            }
        }

        // Delete from database
        await Music.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Music deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting music:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/", (req, res) => {
    res.json({
        status: true,
        message: "Music API is running!",
        timestamp: new Date().toISOString(),
        cors: "enabled",
        fileUpload: "enabled (100MB limit)"
    });
});

// Enhanced Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);

    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            error: 'File too large. Maximum size is 100MB'
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
    console.log('File upload limit: 100MB');
    console.log('Upload timeout: 15 minutes');
});