// server.js - Fixed for Vercel deployment with proper CORS
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Route files
const auth = require('./routes/auth');
const music = require('./routes/music');

const app = express();

// CORS configuration - This is the key fix
const corsOptions = {
    origin: [
        'http://localhost:5173/admindash',
        'http://localhost:3000',
        'https://your-frontend-domain.vercel.app', // Replace with your actual frontend URL
        'https://your-frontend-domain.netlify.app'  // Add other frontend domains as needed
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    credentials: true,
    optionsSuccessStatus: 200
};

// Apply CORS middleware BEFORE other middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File upload middleware - Configure for Vercel
app.use(fileUpload({
    createParentPath: true,
    limits: { 
        fileSize: 10 * 1024 * 1024 // 10MB max file size
    },
    abortOnLimit: true,
    responseOnLimit: "File size limit has been reached",
    useTempFiles: false, // Important for Vercel - use memory instead of temp files
    tempFileDir: undefined
}));

// Test route
app.get("/", (req, res) => {
    res.json({
        status: true,
        message: "Server is running",
        timestamp: new Date().toISOString()
    });
});

// Add a test CORS route
app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "CORS is working",
        origin: req.headers.origin
    });
});

// Mount routers
app.use('/api/auth', auth);
app.use('/api/music', music);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

const PORT = process.env.PORT || 5000;

// For Vercel, we need to export the app
if (process.env.NODE_ENV !== 'production') {
    const server = app.listen(PORT, () => {
        console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err, promise) => {
        console.log(`Error: ${err.message}`);
        server.close(() => process.exit(1));
    });
}

module.exports = app;