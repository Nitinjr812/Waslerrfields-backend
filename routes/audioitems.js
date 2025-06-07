const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator'); 
const { protect, authorize } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/audio/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Check if file is audio
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
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// @route    GET api/audio-items
// @desc     Get all audio items (with pagination and filtering)
// @access   Private (Admin only)
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    // Get total count for pagination
    const total = await AudioItem.countDocuments(filter);
    
    // Get items with pagination
    const audioItems = await AudioItem.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: audioItems.length,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      data: audioItems
    });
  } catch (err) {
    console.error('Get audio items error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error getting audio items'
    });
  }
});

// @route    GET api/audio-items/:id
// @desc     Get single audio item
// @access   Private (Admin only)
router.get('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const audioItem = await AudioItem.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!audioItem) {
      return res.status(404).json({
        success: false,
        message: 'Audio item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: audioItem
    });
  } catch (err) {
    console.error('Get audio item error:', err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Audio item not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error getting audio item'
    });
  }
});

// @route    POST api/audio-items
// @desc     Create new audio item
// @access   Private (Admin only)
router.post(
  '/',
  protect,
  authorize('admin'),
  upload.single('audio'),
  [
    check('title', 'Title is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty(),
    check('price', 'Price must be a valid number').isNumeric().custom((value) => {
      if (value < 0) {
        throw new Error('Price cannot be negative');
      }
      return true;
    })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      // Check if audio file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Audio file is required'
        });
      }

      const { title, description, price } = req.body;

      // Create audio item
      const audioItem = new AudioItem({
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        audioUrl: `/uploads/audio/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        createdBy: req.user.id
      });

      await audioItem.save();

      // Populate creator info for response
      await audioItem.populate('createdBy', 'name email');

      res.status(201).json({
        success: true,
        message: 'Audio item created successfully',
        data: audioItem
      });
    } catch (err) {
      console.error('Create audio item error:', err);
      res.status(500).json({
        success: false,
        message: 'Server error creating audio item'
      });
    }
  }
);

// @route    PUT api/audio-items/:id
// @desc     Update audio item
// @access   Private (Admin only)
router.put(
  '/:id',
  protect,
  authorize('admin'),
  upload.single('audio'),
  [
    check('title', 'Title is required').optional().not().isEmpty(),
    check('description', 'Description is required').optional().not().isEmpty(),
    check('price', 'Price must be a valid number').optional().isNumeric().custom((value) => {
      if (value < 0) {
        throw new Error('Price cannot be negative');
      }
      return true;
    })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      let audioItem = await AudioItem.findById(req.params.id);

      if (!audioItem) {
        return res.status(404).json({
          success: false,
          message: 'Audio item not found'
        });
      }

      // Update fields
      const updateData = {};
      if (req.body.title) updateData.title = req.body.title.trim();
      if (req.body.description) updateData.description = req.body.description.trim();
      if (req.body.price) updateData.price = parseFloat(req.body.price);
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive === 'true';

      // If new audio file is uploaded
      if (req.file) {
        updateData.audioUrl = `/uploads/audio/${req.file.filename}`;
        updateData.fileSize = req.file.size;
        updateData.mimeType = req.file.mimetype;
      }

      audioItem = await AudioItem.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).populate('createdBy', 'name email');

      res.status(200).json({
        success: true,
        message: 'Audio item updated successfully',
        data: audioItem
      });
    } catch (err) {
      console.error('Update audio item error:', err);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({
          success: false,
          message: 'Audio item not found'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Server error updating audio item'
      });
    }
  }
);

// @route    DELETE api/audio-items/:id
// @desc     Delete audio item
// @access   Private (Admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const audioItem = await AudioItem.findById(req.params.id);

    if (!audioItem) {
      return res.status(404).json({
        success: false,
        message: 'Audio item not found'
      });
    }

    await AudioItem.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Audio item deleted successfully',
      data: {}
    });
  } catch (err) {
    console.error('Delete audio item error:', err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Audio item not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error deleting audio item'
    });
  }
});

// @route    PATCH api/audio-items/:id/toggle-status
// @desc     Toggle audio item active status
// @access   Private (Admin only)
router.patch('/:id/toggle-status', protect, authorize('admin'), async (req, res) => {
  try {
    const audioItem = await AudioItem.findById(req.params.id);

    if (!audioItem) {
      return res.status(404).json({
        success: false,
        message: 'Audio item not found'
      });
    }

    audioItem.isActive = !audioItem.isActive;
    await audioItem.save();

    res.status(200).json({
      success: true,
      message: `Audio item ${audioItem.isActive ? 'activated' : 'deactivated'} successfully`,
      data: audioItem
    });
  } catch (err) {
    console.error('Toggle status error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error toggling status'
    });
  }
});

module.exports = router;