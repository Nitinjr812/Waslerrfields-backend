const mongoose = require('mongoose');

const AudioItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  audioUrl: {
    type: String,
    required: [true, 'Audio file is required']
  },
  audioPublicId: {
    type: String,
    required: [true, 'Audio public ID is required'] // Cloudinary public ID for deletion
  },
  duration: {
    type: Number, // Audio duration in seconds
    required: false
  },
  fileSize: {
    type: Number, // File size in bytes
    required: false
  },
  mimeType: {
    type: String,
    required: false
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
AudioItemSchema.index({ title: 1 });
AudioItemSchema.index({ createdBy: 1 });
AudioItemSchema.index({ isActive: 1 });

// Virtual for formatted price
AudioItemSchema.virtual('formattedPrice').get(function() {
  return `₹${this.price.toFixed(2)}`;
});

// Ensure virtual fields are serialized
AudioItemSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('AudioItem', AudioItemSchema);