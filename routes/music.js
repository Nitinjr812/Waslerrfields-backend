// routes/music.js - Fixed for Vercel deployment with proper CORS handling
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const Music = require('../models/Music');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Add CORS headers to all routes in this router
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// @desc    Upload music
// @route   POST /api/music
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        console.log('=== MUSIC UPLOAD START ===');
        console.log('Request method:', req.method);
        console.log('Request headers:', JSON.stringify(req.headers, null, 2));
        console.log('Request body keys:', Object.keys(req.body));
        console.log('Request files:', req.files ? Object.keys(req.files) : 'No files');

        // Validate authentication
        if (!req.user || !req.user.id) {
            console.log('Authentication failed - no user');
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        console.log('User authenticated:', req.user.id);

        // Check for file upload
        if (!req.files || !req.files.audio) {
            console.log('No audio file found in request');
            console.log('Available files:', req.files ? Object.keys(req.files) : 'none');
            
            return res.status(400).json({ 
                success: false, 
                message: 'Please upload an audio file',
                debug: {
                    hasFiles: !!req.files,
                    fileKeys: req.files ? Object.keys(req.files) : [],
                    bodyKeys: Object.keys(req.body)
                }
            });
        }

        const audioFile = req.files.audio;
        console.log('Audio file received:', {
            name: audioFile.name,
            size: audioFile.size,
            mimetype: audioFile.mimetype,
            hasData: !!audioFile.data
        });

        // Validate file type
        if (!audioFile.mimetype.startsWith('audio/')) {
            console.log('Invalid file type:', audioFile.mimetype);
            return res.status(400).json({
                success: false,
                message: 'Please upload a valid audio file'
            });
        }

        // Validate file size (10MB limit)
        if (audioFile.size > 10 * 1024 * 1024) {
            console.log('File too large:', audioFile.size);
            return res.status(400).json({
                success: false,
                message: 'File size too large (max 10MB)'
            });
        }

        // Validate required fields
        const { title, description, price } = req.body;
        console.log('Form data:', { title, description, price });

        if (!title || !description || !price) {
            console.log('Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Please provide title, description, and price',
                received: { title: !!title, description: !!description, price: !!price }
            });
        }

        // Validate price
        const numericPrice = parseFloat(price);
        if (isNaN(numericPrice) || numericPrice < 0) {
            console.log('Invalid price:', price);
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid price'
            });
        }

        console.log('Starting Cloudinary upload...');

        // Upload to Cloudinary using upload_stream
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'auto',
                    folder: 'music_tracks',
                    use_filename: true,
                    unique_filename: true,
                    timeout: 60000 // 60 second timeout
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary error:', error);
                        reject(new Error(`Cloudinary upload failed: ${error.message}`));
                    } else {
                        console.log('Cloudinary upload successful:', result.secure_url);
                        resolve(result);
                    }
                }
            );

            // Write the buffer to the upload stream
            uploadStream.end(audioFile.data);
        });

        console.log('Creating database record...');

        // Create music record in database
        const music = await Music.create({
            title: title.trim(),
            description: description.trim(),
            price: numericPrice,
            audioUrl: uploadResult.secure_url,
            user: req.user.id
        });

        console.log('Success! Music created:', music._id);
        console.log('=== MUSIC UPLOAD END ===');

        res.status(201).json({
            success: true,
            message: 'Music uploaded successfully',
            data: {
                id: music._id,
                title: music.title,
                description: music.description,
                price: music.price,
                audioUrl: music.audioUrl,
                createdAt: music.createdAt
            }
        });

    } catch (err) {
        console.error('=== MUSIC UPLOAD ERROR ===');
        console.error('Error details:', err);
        console.error('Stack trace:', err.stack);
        
        // Handle specific errors
        let errorMessage = 'Server Error';
        let statusCode = 500;

        if (err.message.includes('Cloudinary')) {
            errorMessage = 'Failed to upload file to cloud storage';
            statusCode = 502;
        } else if (err.name === 'ValidationError') {
            errorMessage = 'Invalid data provided';
            statusCode = 400;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'Upload timeout - please try again';
            statusCode = 408;
        }

        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// @desc    Get all music tracks
// @route   GET /api/music
// @access  Public
router.get('/', async (req, res) => {
    try {
        console.log('Fetching all music tracks...');
        
        const music = await Music.find()
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .lean(); // Use lean() for better performance

        console.log(`Found ${music.length} music tracks`);

        res.status(200).json({
            success: true,
            count: music.length,
            data: music
        });
    } catch (err) {
        console.error('Get music error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch music tracks',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
});

// @desc    Get single music track
// @route   GET /api/music/:id
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const music = await Music.findById(req.params.id).populate('user', 'name email');

        if (!music) {
            return res.status(404).json({
                success: false,
                message: 'Music track not found'
            });
        }

        res.status(200).json({
            success: true,
            data: music
        });
    } catch (err) {
        console.error('Get single music error:', err);
        
        if (err.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Music track not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

// @desc    Delete music track
// @route   DELETE /api/music/:id
// @access  Private (only owner or admin)
router.delete('/:id', protect, async (req, res) => {
    try {
        const music = await Music.findById(req.params.id);

        if (!music) {
            return res.status(404).json({
                success: false,
                message: 'Music track not found'
            });
        }

        // Check if user owns the music or is admin
        if (music.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this music track'
            });
        }

        await Music.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Music track deleted successfully'
        });
    } catch (err) {
        console.error('Delete music error:', err);
        
        if (err.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Music track not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

module.exports = router;