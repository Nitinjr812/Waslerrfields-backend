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
        if (!req.files || !req.files.audio) {
            return res.status(400).json({ success: false, message: 'Please upload an audio file' });
        }

        const audioFile = req.files.audio;

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(audioFile.tempFilePath, {
            resource_type: 'auto',
            folder: 'music_tracks'
        });

        const music = await Music.create({
            title: req.body.title,
            description: req.body.description,
            price: req.body.price,
            audioUrl: result.secure_url,
            user: req.user.id
        });

        res.status(201).json({
            success: true,
            data: music
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

// @desc    Get all music tracks
// @route   GET /api/music
// @access  Public
router.get('/', async (req, res) => {
    try {
        const music = await Music.find().populate('user', 'name');

        res.status(200).json({
            success: true,
            count: music.length,
            data: music
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

module.exports = router;