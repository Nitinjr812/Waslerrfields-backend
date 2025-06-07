const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');

// Initialize GridFS
let gfs;
mongoose.connection.once('open', () => {
  gfs = Grid(mongoose.connection.db, mongoose.mongo);
  gfs.collection('uploads'); // Collection name
});

// Create storage engine
const storage = new GridFsStorage({
  url: process.env.MONGO_URI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      const filename = `music-${Date.now()}${path.extname(file.originalname)}`;
      const fileInfo = {
        filename: filename,
        bucketName: 'uploads' // Same as collection name
      };
      resolve(fileInfo);
    });
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Upload route
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No audio file uploaded' 
      });
    }

    const { title, description, price } = req.body;

    // Create music record in database
    const music = new Music({
      title: title.trim(),
      description: description.trim(),
      price: parseFloat(price),
      audioFileId: req.file.id, // GridFS file ID
      fileName: req.file.originalname,
      fileSize: req.file.size
    });

    await music.save();

    res.status(201).json({
      success: true,
      message: 'Music uploaded successfully',
      data: {
        id: music._id,
        title: music.title,
        fileId: music.audioFileId
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// File retrieval route
router.get('/file/:id', (req, res) => {
  gfs.files.findOne({ _id: mongoose.Types.ObjectId(req.params.id) }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Check if audio
    if (file.contentType.startsWith('audio/')) {
      const readstream = gfs.createReadStream(file._id);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        success: false,
        message: 'Not an audio file'
      });
    }
  });
});