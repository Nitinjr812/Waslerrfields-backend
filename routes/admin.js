const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Music = require('../models/Music');
const { protect, authorize } = require('../middlewares/auth');

// @route    POST api/admin/music
// @desc     Add new music
// @access   Private/Admin
router.post(
    '/music',
    [
        protect,
        authorize('admin'),
        [
            check('title', 'Title is required').not().isEmpty(),
            check('artist', 'Artist is required').not().isEmpty(),
            check('genre', 'Genre is required').not().isEmpty(),
            check('duration', 'Duration is required').not().isEmpty(),
            check('price', 'Price is required').isNumeric().custom(val => val >= 0)
        ]
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        try {
            const music = new Music({
                ...req.body,
                title: req.body.title.trim(),
                artist: req.body.artist.trim(),
                album: req.body.album?.trim(),
                description: req.body.description?.trim()
            });

            await music.save();

            res.status(201).json({
                success: true,
                message: 'Music added successfully',
                data: music
            });
        } catch (err) {
            console.error('Add music error:', err);
            res.status(500).json({
                success: false,
                message: 'Server error adding music',
                error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
            });
        }
    }
);

// @route    GET api/admin/music
// @desc     Get all music (admin view)
// @access   Private/Admin
router.get('/music', protect, authorize('admin'), async (req, res) => {
    try {
        const music = await Music.find().sort({ createdAt: -1 });
        
        res.json({
            success: true,
            count: music.length,
            data: music
        });
    } catch (err) {
        console.error('Get admin music error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error getting music data'
        });
    }
});

// @route    PUT api/admin/music/:id
// @desc     Update music
// @access   Private/Admin
router.put('/music/:id', protect, authorize('admin'), async (req, res) => {
    try {
        let music = await Music.findById(req.params.id);

        if (!music) {
            return res.status(404).json({
                success: false,
                message: 'Music not found'
            });
        }

        music = await Music.findByIdAndUpdate(req.params.id, {
            ...req.body,
            title: req.body.title?.trim(),
            artist: req.body.artist?.trim(),
            album: req.body.album?.trim(),
            description: req.body.description?.trim()
        }, {
            new: true,
            runValidators: true
        });

        res.json({
            success: true,
            message: 'Music updated successfully',
            data: music
        });
    } catch (err) {
        console.error('Update music error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error updating music'
        });
    }
});

// @route    DELETE api/admin/music/:id
// @desc     Delete music
// @access   Private/Admin
router.delete('/music/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const music = await Music.findById(req.params.id);

        if (!music) {
            return res.status(404).json({
                success: false,
                message: 'Music not found'
            });
        }

        await Music.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Music deleted successfully'
        });
    } catch (err) {
        console.error('Delete music error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error deleting music'
        });
    }
});

module.exports = router;