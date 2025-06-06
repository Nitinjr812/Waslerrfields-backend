const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Music = require('../models/Music');
const { adminProtect, authorize } = require('../middlewares/auth');

// Configure storage for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads/'));
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|mp3|wav|m4a/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb('Error: Only audio and image files are allowed!');
    }
  }
}).fields([
  { name: 'audioFile', maxCount: 1 },
  { name: 'albumCover', maxCount: 1 }
]);

// Helper function to delete files
const deleteFile = (filePath) => {
  if (filePath) {
    const fullPath = path.join(__dirname, '../public', filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
};

// @route    POST api/admin/music
// @desc     Add new music with file upload
// @access   Private/Admin
router.post(
  '/music',
  [
    adminProtect,
    authorize('admin'),
    (req, res, next) => {
      upload(req, res, function(err) {
        if (err) {
          return res.status(400).json({
            success: false,
            message: err
          });
        }
        next();
      });
    },
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
      // Clean up uploaded files if validation fails
      if (req.files) {
        if (req.files.audioFile) deleteFile(`/uploads/${req.files.audioFile[0].filename}`);
        if (req.files.albumCover) deleteFile(`/uploads/${req.files.albumCover[0].filename}`);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    try {
      const musicData = {
        ...req.body,
        title: req.body.title.trim(),
        artist: req.body.artist.trim(),
        album: req.body.album?.trim(),
        description: req.body.description?.trim()
      };

      // Add file paths if files were uploaded
      if (req.files) {
        if (req.files.audioFile) {
          musicData.audioFile = `/uploads/${req.files.audioFile[0].filename}`;
        }
        if (req.files.albumCover) {
          musicData.albumCover = `/uploads/${req.files.albumCover[0].filename}`;
        }
      }

      const music = new Music(musicData);
      await music.save();

      res.status(201).json({
        success: true,
        message: 'Music added successfully',
        data: music
      });
    } catch (err) {
      // Clean up uploaded files if error occurs
      if (req.files) {
        if (req.files.audioFile) deleteFile(`/uploads/${req.files.audioFile[0].filename}`);
        if (req.files.albumCover) deleteFile(`/uploads/${req.files.albumCover[0].filename}`);
      }
      
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
// @desc     Get all music (with pagination and filtering)
// @access   Private/Admin
router.get('/music', [adminProtect, authorize('admin')], async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filtering
    const filter = {};
    if (req.query.title) filter.title = { $regex: req.query.title, $options: 'i' };
    if (req.query.artist) filter.artist = { $regex: req.query.artist, $options: 'i' };
    if (req.query.genre) filter.genre = req.query.genre;

    const total = await Music.countDocuments(filter);
    const music = await Music.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      count: music.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: music
    });
  } catch (err) {
    console.error('Get music error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching music',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// @route    GET api/admin/music/:id
// @desc     Get single music by ID
// @access   Private/Admin
router.get('/music/:id', [adminProtect, authorize('admin')], async (req, res) => {
  try {
    const music = await Music.findById(req.params.id);
    
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
  } catch (err) {
    console.error('Get music by ID error:', err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Music not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error fetching music',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// @route    PUT api/admin/music/:id
// @desc     Update music
// @access   Private/Admin
router.put(
  '/music/:id',
  [
    adminProtect,
    authorize('admin'),
    (req, res, next) => {
      upload(req, res, function(err) {
        if (err) {
          return res.status(400).json({
            success: false,
            message: err
          });
        }
        next();
      });
    },
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
      // Clean up uploaded files if validation fails
      if (req.files) {
        if (req.files.audioFile) deleteFile(`/uploads/${req.files.audioFile[0].filename}`);
        if (req.files.albumCover) deleteFile(`/uploads/${req.files.albumCover[0].filename}`);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    try {
      let music = await Music.findById(req.params.id);
      
      if (!music) {
        // Clean up uploaded files if music not found
        if (req.files) {
          if (req.files.audioFile) deleteFile(`/uploads/${req.files.audioFile[0].filename}`);
          if (req.files.albumCover) deleteFile(`/uploads/${req.files.albumCover[0].filename}`);
        }
        
        return res.status(404).json({
          success: false,
          message: 'Music not found'
        });
      }

      const updateData = {
        ...req.body,
        title: req.body.title.trim(),
        artist: req.body.artist.trim(),
        album: req.body.album?.trim(),
        description: req.body.description?.trim()
      };

      // Handle file updates
      if (req.files) {
        // Delete old files if new ones are uploaded
        if (req.files.audioFile) {
          deleteFile(music.audioFile);
          updateData.audioFile = `/uploads/${req.files.audioFile[0].filename}`;
        }
        if (req.files.albumCover) {
          deleteFile(music.albumCover);
          updateData.albumCover = `/uploads/${req.files.albumCover[0].filename}`;
        }
      }

      music = await Music.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        message: 'Music updated successfully',
        data: music
      });
    } catch (err) {
      // Clean up uploaded files if error occurs
      if (req.files) {
        if (req.files.audioFile) deleteFile(`/uploads/${req.files.audioFile[0].filename}`);
        if (req.files.albumCover) deleteFile(`/uploads/${req.files.albumCover[0].filename}`);
      }
      
      console.error('Update music error:', err);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({
          success: false,
          message: 'Music not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Server error updating music',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
      });
    }
  }
);

// @route    DELETE api/admin/music/:id
// @desc     Delete music
// @access   Private/Admin
router.delete('/music/:id', [adminProtect, authorize('admin')], async (req, res) => {
  try {
    const music = await Music.findById(req.params.id);
    
    if (!music) {
      return res.status(404).json({
        success: false,
        message: 'Music not found'
      });
    }

    // Delete associated files
    deleteFile(music.audioFile);
    deleteFile(music.albumCover);

    await music.remove();

    res.json({
      success: true,
      message: 'Music deleted successfully',
      data: {}
    });
  } catch (err) {
    console.error('Delete music error:', err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Music not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error deleting music',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

module.exports = router;