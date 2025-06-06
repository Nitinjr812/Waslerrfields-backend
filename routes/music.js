const express = require('express');
const router = express.Router();
const Music = require('../models/Music');

// @route    GET api/music
// @desc     Get all active music
// @access   Public
router.get('/', async (req, res) => {
    try {
        const { genre, artist, search, page = 1, limit = 20 } = req.query;
        
        // Build query
        const query = { isActive: true };
        
        if (genre && genre !== 'all') {
            query.genre = genre;
        }
        
        if (artist) {
            query.artist = { $regex: artist, $options: 'i' };
        }
        
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { artist: { $regex: search, $options: 'i' } },
                { album: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Execute query with pagination
        const music = await Music.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-__v');
        
        // Get total count for pagination
        const total = await Music.countDocuments(query);
        
        res.json({
            success: true,
            count: music.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: music
        });
    } catch (err) {
        console.error('Get music error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error getting music data'
        });
    }
});

// @route    GET api/music/:id
// @desc     Get single music track
// @access   Public
router.get('/:id', async (req, res) => {
    try {
        const music = await Music.findById(req.params.id).select('-__v');
        
        if (!music || !music.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Music not found'
            });
        }
        
        res.json({
            success: true,
            data: music
        });
    } catch (err) {
        console.error('Get single music error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Music not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error getting music data'
        });
    }
});

// @route    GET api/music/search/:trackName
// @desc     Get music by track name
// @access   Public
router.get('/search/:trackName', async (req, res) => {
    try {
        const trackName = req.params.trackName.replace(/-/g, ' '); // Convert URL-friendly name back
        
        const music = await Music.findOne({
            title: { $regex: trackName, $options: 'i' },
            isActive: true
        }).select('-__v');
        
        if (!music) {
            return res.status(404).json({
                success: false,
                message: 'Music track not found'
            });
        }
        
        res.json({
            success: true,
            data: music
        });
    } catch (err) {
        console.error('Get music by name error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error getting music data'
        });
    }
});

// @route    GET api/music/genres/all
// @desc     Get all available genres
// @access   Public
router.get('/genres/all', async (req, res) => {
    try {
        const genres = await Music.distinct('genre', { isActive: true });
        
        res.json({
            success: true,
            data: genres.sort()
        });
    } catch (err) {
        console.error('Get genres error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error getting genres'
        });
    }
});

module.exports = router;