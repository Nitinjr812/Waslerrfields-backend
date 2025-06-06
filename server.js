    const express = require('express');
    const mongoose = require('mongoose');
    const dotenv = require('dotenv');
    const cors = require('cors');
    const connectDB = require('./config/db');

    // Load env vars
    dotenv.config();

    // Connect to database
    connectDB();

    // Route files
    const auth = require('./routes/auth');
    const music = require('./routes/music');

    const app = express();

    // Body parser
    app.use(express.json());

    // Enable CORS
    app.use(cors());

    // Mount routers
    app.use('/api/auth', auth);
    app.use('/api/music', music);

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
            message: "Music API Server is running!"
        })
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err, promise) => {
        console.log(`Error: ${err.message}`);
        // Close server & exit process
        server.close(() => process.exit(1));
    });