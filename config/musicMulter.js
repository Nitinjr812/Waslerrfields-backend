const multer = require("multer");
const musicUpload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["audio/mpeg", "audio/wav", "application/zip"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only MP3, WAV, ZIP allowed"));
  }
});
module.exports = musicUpload;
