const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dozvqr0vm',
    api_key: process.env.CLOUDINARY_API_KEY || '527578319683918',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'QGukNmPAwh-pLHfswyGy8pwKw7A'
});

// Audio Upload Setup
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'music_uploads',
        resource_type: 'auto',
        allowed_formats: ['mp3', 'wav']
    }
});

const upload = multer({ storage });

// Music Model
const Music = mongoose.model('Music', new mongoose.Schema({
    title: String,
    description: String,
    price: Number,
    audioUrl: String,
    cloudinaryId: String,
    createdAt: { type: Date, default: Date.now }
}));

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Route files
const auth = require('./routes/auth');

// Mount routers
app.use('/api/auth', auth);

// Music Routes
app.get('/api/test', (req, res) => {
    res.json({ message: "API Working!" });
});

app.post('/api/music', upload.single('audio'), async (req, res) => {
    try {
        const { title, description, price } = req.body;
        const newMusic = new Music({
            title,
            description,
            price,
            audioUrl: req.file.path,
            cloudinaryId: req.file.filename
        });
        await newMusic.save();
        res.status(201).json(newMusic);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/music', async (req, res) => {
    try {
        const music = await Music.find();
        res.json(music);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Music
app.put('/api/music/:id', upload.single('audio'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, price } = req.body;

        const music = await Music.findById(id);
        if (!music) {
            return res.status(404).json({ error: 'Music not found' });
        }

        // Update fields
        music.title = title || music.title;
        music.description = description || music.description;
        music.price = price || music.price;

        // If new audio is uploaded
        if (req.file) {
            // Delete old audio from Cloudinary (optional)
            await cloudinary.uploader.destroy(music.cloudinaryId);

            // Update with new audio
            music.audioUrl = req.file.path;
            music.cloudinaryId = req.file.filename;
        }

        await music.save();
        res.json({ message: 'Music updated successfully', music });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Music
app.delete('/api/music/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const music = await Music.findByIdAndDelete(id);

        if (!music) {
            return res.status(404).json({ error: 'Music not found' });
        }

        await cloudinary.uploader.destroy(music.cloudinaryId);

        res.json({ message: 'Music deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Root route
app.get("/", (req, res) => {
    res.json({
        status: true
    })
});

const PORT = process.env.PORT || 5000;

const server = app.listen(
    PORT,
    console.log(
        `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
    )
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});