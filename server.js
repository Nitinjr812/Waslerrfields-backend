const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Route files
const auth = require('./routes/auth');
const admin = require('./routes/admin'); // Add this line
const music = require('./routes/music'); // Add this line

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Set static folder (for album covers if you're uploading files)
app.use(express.static(path.join(__dirname, 'public')));

// Mount routers
app.use('/api/auth', auth);
app.use('/api/admin', admin); // Add this line
app.use('/api/music', music); // Add this line

const PORT = process.env.PORT || 5000;

const server = app.listen(
    PORT,
    console.log(
        `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
    )
);

app.get("/", (req, res) => {
    res.json({
        status: true,
        message: "Music E-commerce API is running"
    })
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});