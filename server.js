// server.js - Alternative approach using multer instead of express-fileupload
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const multer = require('multer');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Route files
const auth = require('./routes/auth');
const music = require('./routes/music');

const app = express();

// Body parser
app.use(express.json());

// Enable CORS with specific options
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'], 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// Mount routers
app.use('/api/auth', auth);
app.use('/api/music', music);

const PORT = process.env.PORT || 5000;

const server = app.listen(
    PORT,
    console.log(
        `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
    )
);

app.get("/", (req, res) => {
    res.json({
        status: true
    })
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});

// Alternative music routes using multer
// routes/music.js - Updated version with multer 
const router = express.Router(); 

const { protect } = require('./middlewares/auth');
const Music = require('./models/Music');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dsjec7thv',
    api_key: process.env.CLOUDINARY_API_KEY || '792389153259629',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'aLgZw_S0fQsVb5JTlydEOLgyaYk'
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Please upload only audio files!'), false);
        }
    }
});

// @desc    Upload music
// @route   POST /api/music
// @access  Private
router.post('/', protect, upload.single('audio'), async (req, res) => {
    try {
        console.log('Request body:', req.body);
        console.log('Request file:', req.file ? req.file.originalname : 'No file');

        // Check if file exists
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please upload an audio file'
            });
        }

        // Validate required fields
        const { title, description, price } = req.body;
        if (!title || !description || !price) {
            return res.status(400).json({
                success: false,
                message: 'Please provide title, description, and price'
            });
        }

        console.log('Uploading to Cloudinary...');

        // Upload buffer to Cloudinary using upload_stream
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: 'auto',
                    folder: 'music_tracks',
                    use_filename: true,
                    unique_filename: true
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary error:', error);
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            ).end(req.file.buffer);
        });

        console.log('Cloudinary upload successful:', uploadResult.secure_url);

        // Create music record in database
        const music = await Music.create({
            title: title.trim(),
            description: description.trim(),
            price: parseFloat(price),
            audioUrl: uploadResult.secure_url,
            user: req.user.id
        });

        console.log('Music created in database:', music._id);

        res.status(201).json({
            success: true,
            message: 'Music uploaded successfully',
            data: music
        });
    } catch (err) {
        console.error('Upload error:', err);
        
        // Handle multer errors
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: 'File size too large (max 10MB)'
                });
            }
        }
        
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
});

// @desc    Get all music tracks
// @route   GET /api/music
// @access  Public
router.get('/', async (req, res) => {
    try {
        const music = await Music.find().populate('user', 'name').sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: music.length,
            data: music
        });
    } catch (err) {
        console.error('Get music error:', err);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

module.exports = router;