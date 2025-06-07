// routes/music.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Create Music model
const mongoose = require('mongoose');

const musicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  audioUrl: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const Music = mongoose.model('Music', musicSchema);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/music/';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'music-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only audio files
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// @route    POST api/music/upload
// @desc     Upload music file
// @access   Public (you can add admin auth later)
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    console.log('Music upload request received:', req.body);
    console.log('File info:', req.file);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file uploaded'
      });
    }

    const { title, description, price } = req.body;

    // Validate required fields
    if (!title || !description || !price) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and price are required'
      });
    }

    // Create music record in database
    const music = new Music({
      title: title.trim(),
      description: description.trim(),
      price: parseFloat(price),
      audioUrl: `/uploads/music/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });

    await music.save();
    console.log('Music saved to database:', music._id);

    res.status(201).json({
      success: true,
      message: 'Music uploaded successfully',
      data: {
        id: music._id,
        title: music.title,
        description: music.description,
        price: music.price,
        audioUrl: music.audioUrl,
        fileName: music.fileName,
        uploadDate: music.uploadDate
      }
    });

  } catch (error) {
    console.error('Music upload error:', error);
    
    // Handle multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 50MB'
      });
    }

    if (error.message === 'Only audio files are allowed!') {
      return res.status(400).json({
        success: false,
        message: 'Only audio files are allowed'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during upload',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route    GET api/music
// @desc     Get all music
// @access   Public
router.get('/', async (req, res) => {
  try {
    const music = await Music.find({ isActive: true })
      .sort({ uploadDate: -1 })
      .select('-__v');

    res.json({
      success: true,
      count: music.length,
      data: music
    });
  } catch (error) {
    console.error('Get music error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting music'
    });
  }
});

// @route    GET api/music/:id
// @desc     Get single music by ID
// @access   Public
router.get('/:id', async (req, res) => {
  try {
    const music = await Music.findById(req.params.id).select('-__v');

    if (!music) {
      return res.status(404).json({
        success: false,
        message: 'Music not found'
      });
    }

    res.json({
      success: true,
      data: music
    });
  } catch (error) {
    console.error('Get single music error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting music'
    });
  }
});

// @route    DELETE api/music/:id
// @desc     Delete music (soft delete)
// @access   Private (Admin only)
router.delete('/:id', async (req, res) => {
  try {
    const music = await Music.findById(req.params.id);

    if (!music) {
      return res.status(404).json({
        success: false,
        message: 'Music not found'
      });
    }

    // Soft delete - just mark as inactive
    music.isActive = false;
    await music.save();

    res.json({
      success: true,
      message: 'Music deleted successfully'
    });
  } catch (error) {
    console.error('Delete music error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting music'
    });
  }
});

module.exports = router;