// models/Music.js
const mongoose = require('mongoose');

const MusicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  image: {
    type: String,
    required: [true, 'Please add an image URL']
  },
  price: {
    type: Number,
    required: [true, 'Please add a price'],
    min: [0, 'Price cannot be negative']
  },
  audioFile: {
    type: String,
    required: [true, 'Please add an audio file URL']
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add indexes for better performance
MusicSchema.index({ title: 1 });
MusicSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Music', MusicSchema);