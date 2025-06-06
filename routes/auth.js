// routes/music.js
const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Music = require('../models/Music');
const { protect, authorize } = require('../middlewares/auth');

// @route    GET api/music
// @desc     Get all music tracks
// @access   Public
router.get('/', async (req, res) => {
  try {
    const music = await Music.find().populate('createdBy', 'name email').sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: music.length,
      data: music
    });
  } catch (err) {
    console.error('Get music error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error getting music tracks'
    });
  }
});

// @route    GET api/music/:id
// @desc     Get single music track
// @access   Public
router.get('/:id', async (req, res) => {
  try {
    const music = await Music.findById(req.params.id).populate('createdBy', 'name email');
    
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
    console.error('Get music by ID error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error getting music track'
    });
  }
});

// @route    POST api/music
// @desc     Create new music track
// @access   Private (Admin only)
router.post(
  '/',
  [
    protect,
    authorize('admin'),
    [
      check('title', 'Title is required').not().isEmpty(),
      check('description', 'Description is required').not().isEmpty(),
      check('image', 'Image URL is required').not().isEmpty(),
      check('price', 'Price is required and must be a number').isNumeric(),
      check('audioFile', 'Audio file URL is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    console.log('Create music request received:', req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, description, image, price, audioFile } = req.body;

    try {
      const music = new Music({
        title: title.trim(),
        description: description.trim(),
        image,
        price: parseFloat(price),
        audioFile,
        createdBy: req.user.id
      });

      await music.save();
      console.log('Music track created successfully:', music._id);

      // Populate the createdBy field before sending response
      await music.populate('createdBy', 'name email');

      res.status(201).json({
        success: true,
        message: 'Music track created successfully',
        data: music
      });

    } catch (err) {
      console.error('Create music error:', err);
      
      if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(val => ({ msg: val.message }));
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error creating music track',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
      });
    }
  }
);

// @route    PUT api/music/:id
// @desc     Update music track
// @access   Private (Admin only)
router.put(
  '/:id',
  [
    protect,
    authorize('admin'),
    [
      check('title', 'Title is required').optional().not().isEmpty(),
      check('description', 'Description is required').optional().not().isEmpty(),
      check('image', 'Image URL is required').optional().not().isEmpty(),
      check('price', 'Price must be a number').optional().isNumeric(),
      check('audioFile', 'Audio file URL is required').optional().not().isEmpty()
    ]
  ],
  async (req, res) => {
    console.log('Update music request received:', req.params.id, req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    try {
      let music = await Music.findById(req.params.id);

      if (!music) {
        return res.status(404).json({
          success: false,
          message: 'Music track not found'
        });
      }

      // Update fields
      const { title, description, image, price, audioFile } = req.body;
      
      if (title) music.title = title.trim();
      if (description) music.description = description.trim();
      if (image) music.image = image;
      if (price) music.price = parseFloat(price);
      if (audioFile) music.audioFile = audioFile;

      await music.save();
      await music.populate('createdBy', 'name email');

      console.log('Music track updated successfully:', music._id);

      res.status(200).json({
        success: true,
        message: 'Music track updated successfully',
        data: music
      });

    } catch (err) {
      console.error('Update music error:', err);
      res.status(500).json({
        success: false,
        message: 'Server error updating music track'
      });
    }
  }
);

// @route    DELETE api/music/:id
// @desc     Delete music track
// @access   Private (Admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const music = await Music.findById(req.params.id);

    if (!music) {
      return res.status(404).json({
        success: false,
        message: 'Music track not found'
      });
    }

    await Music.findByIdAndDelete(req.params.id);
    console.log('Music track deleted successfully:', req.params.id);

    res.status(200).json({
      success: true,
      message: 'Music track deleted successfully'
    });

  } catch (err) {
    console.error('Delete music error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error deleting music track'
    });
  }
});

module.exports = router;