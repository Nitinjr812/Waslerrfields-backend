const mongoose = require('mongoose');

const MusicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a music title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  artist: {
    type: String,
    required: [true, 'Please add an artist name'],
    trim: true,
    maxlength: [100, 'Artist name cannot be more than 100 characters']
  },
  album: {
    type: String,
    trim: true,
    maxlength: [100, 'Album name cannot be more than 100 characters']
  },
  genre: {
    type: String,
    required: [true, 'Please add a genre'],
    enum: ['Pop', 'Rock', 'Hip Hop', 'Jazz', 'Classical', 'Electronic', 'R&B', 'Country', 'Reggae', 'Folk', 'Blues', 'Other']
  },
  duration: {
    type: String, // Format: "3:45"
    required: [true, 'Please add duration']
  },
  releaseYear: {
    type: Number,
    min: [1900, 'Release year must be after 1900'],
    max: [new Date().getFullYear(), 'Release year cannot be in the future']
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
    min: [0, 'Price cannot be negative']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  albumCover: {
    type: String, // URL to album cover image
    default: 'default-album-cover.jpg'
  },
  audioFile: {
    type: String, // URL to audio file (for preview)
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add indexes for better search performance
MusicSchema.index({ title: 'text', artist: 'text', album: 'text' });
MusicSchema.index({ genre: 1 });
MusicSchema.index({ artist: 1 });
MusicSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Music', MusicSchema);