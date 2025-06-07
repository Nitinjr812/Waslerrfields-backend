// routes/music.js - Fixed for Vercel deployment
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const Music = require('../models/Music');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dsjec7thv',
    api_key: process.env.CLOUDINARY_API_KEY || '792389153259629',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'aLgZw_S0fQsVb5JTlydEOLgyaYk'
});

// @desc    Upload music
// @route   POST /api/music
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        console.log('Request received');
        console.log('Body:', req.body);
        console.log('Files:', req.files);

        if (!req.files || !req.files.audio) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please upload an audio file',
                debug: {
                    hasFiles: !!req.files,
                    fileKeys: req.files ? Object.keys(req.files) : []
                }
            });
        }

        const audioFile = req.files.audio;
        console.log('Audio file details:', {
            name: audioFile.name,
            size: audioFile.size,
            mimetype: audioFile.mimetype
        });

        // Validate file type
        if (!audioFile.mimetype.startsWith('audio/')) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a valid audio file'
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

        console.log('Starting Cloudinary upload...');

        // For Vercel, use the data buffer instead of temp file path
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
                        console.log('Cloudinary upload successful');
                        resolve(result);
                    }
                }
            ).end(audioFile.data); // Use audioFile.data instead of tempFilePath
        });

        console.log('Creating database record...');

        // Create music record in database
        const music = await Music.create({
            title: title.trim(),
            description: description.trim(),
            price: parseFloat(price),
            audioUrl: uploadResult.secure_url,
            user: req.user.id
        });

        console.log('Success! Music ID:', music._id);

        res.status(201).json({
            success: true,
            message: 'Music uploaded successfully',
            data: music
        });
    } catch (err) {
        console.error('Detailed error:', err);
        res.status(500).json({
            success: false,
            message: 'Server Error',
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