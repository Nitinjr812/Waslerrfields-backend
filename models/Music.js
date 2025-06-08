const mongoose = require('mongoose');

const MusicSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a title']
    },
    description: {
        type: String
    },
    price: {
        type: Number,
        required: [true, 'Please add a price']
    },
    audioUrl: {
        type: String,
        required: true
    },
    cloudinaryId: {
        type: String,
        required: true
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt:   {
        type: Date,
        default: Date.now
    }
});
 
module.exports = mongoose.model('Music', MusicSchema);