// Add this to your main app.js or server.js file

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express(); 

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
const audioDir = path.join(uploadsDir, 'audio');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for audio files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/audio-items', require('./routes/audioItems'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

module.exports = app;