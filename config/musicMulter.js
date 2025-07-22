// config/musicMulter.js
const multer = require('multer');

const musicUpload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowedMime = ['audio/mpeg', 'audio/wav', 'application/zip'];
    if (allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3, WAV, or ZIP files are allowed'));
    }
  }
});

module.exports = musicUpload;
