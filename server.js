require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');

// Initialize app
const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'https://your-production-frontend.com'
];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Cloudinary Config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log('MongoDB Error:', err));

// Models
const User = require('./models/User');
const Music = require('./models/Music');

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

// Auth Middleware
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.header('x-auth-token')) {
        token = req.header('x-auth-token');
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }
};

// Routes

// Test Route
app.get('/api/test', (req, res) => {
    res.json({ message: "API Working!" });
});

// Auth Routes
app.post('/api/auth/register', [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6+ characters').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        user = new User({ name, email, password });
        await user.save();

        const payload = { user: { id: user._id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' });

        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.post('/api/auth/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        let user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const payload = { user: { id: user._id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' });

        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get('/api/auth/me',   async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Music Routes
app.post('/api/music',  upload.single('audio'), async (req, res) => {
    try {
        const { title, description, price } = req.body;
        const newMusic = new Music({
            title,
            description,
            price,
            audioUrl: req.file.path,
            cloudinaryId: req.file.filename,
            user: req.user.id
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

app.put('/api/music/:id',  upload.single('audio'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, price } = req.body;

        const music = await Music.findById(id);
        if (!music) {
            return res.status(404).json({ error: 'Music not found' });
        }

        // Check if user owns the music
        if (music.user.toString() !== req.user.id) {
            return res.status(401).json({ error: 'Not authorized' });
        }

        music.title = title || music.title;
        music.description = description || music.description;
        music.price = price || music.price;

        if (req.file) {
            await cloudinary.uploader.destroy(music.cloudinaryId);
            music.audioUrl = req.file.path;
            music.cloudinaryId = req.file.filename;
        }

        await music.save();
        res.json({ message: 'Music updated successfully', music });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/music/:id',   async (req, res) => {
    try {
        const { id } = req.params;
        const music = await Music.findById(id);

        if (!music) {
            return res.status(404).json({ error: 'Music not found' });
        }

        // Check if user owns the music
        if (music.user.toString() !== req.user.id) {
            return res.status(401).json({ error: 'Not authorized' });
        }

        await cloudinary.uploader.destroy(music.cloudinaryId);
        await music.remove();

        res.json({ message: 'Music deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get("/",(req,res)=>{
    res.json({
        status:true

    })
})

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});