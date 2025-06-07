const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middlewares/auth');

// @route    POST api/auth/register
// @desc     Register user
// @access   Public
router.post(
    '/register',
    [
        check('name', 'Name is required').not().isEmpty(),
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Please enter a password with 6+ characters').isLength({ min: 6 })
    ],
    async (req, res, next) => {
        console.log('Registration request received:', req.body);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { name, email, password } = req.body;

        try {
            // Check if user already exists
            let user = await User.findOne({ email });
            console.log('Existing user check:', user ? 'User exists' : 'User does not exist');

            if (user) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists',
                    errors: [{ msg: 'User already exists' }]
                });
            }

            // Create user instance (don't hash password here - let the pre-save middleware handle it)
            user = new User({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                password
            });

            console.log('User created in memory:', { name: user.name, email: user.email });

            // Save user (this will trigger the pre-save middleware to hash the password)
            await user.save();
            console.log('User saved to database successfully:', user._id);

            // Create JWT payload
            const payload = {
                user: {
                    id: user._id
                }
            };

            // Generate JWT token
            const token = jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: '5d' }
            );

            console.log('JWT token generated successfully');

            // Send response
            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });

        } catch (err) {
            console.error('Registration error:', err);

            // Handle duplicate key error
            if (err.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists',
                    errors: [{ msg: 'User already exists' }]
                });
            }

            // Handle validation errors
            if (err.name === 'ValidationError') {
                const errors = Object.values(err.errors).map(val => ({ msg: val.message }));
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors
                });
            }

            res.status(500).json({
                success: false,
                message: 'Server error during registration',
                error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
            });
        }
    }
);

// @route    POST api/auth/login
// @desc     Authenticate user
// @access   Public
// TEMPORARY ROUTE - REMOVE AFTER CREATING TEST USER
// @route    POST api/auth/create-test-admin
// @desc     Create test admin user (one-time)
// @access   Public
router.post('/create-test-admin', async (req, res) => {
  try {
    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'waslerr@example.com' });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Test user already exists'
      });
    }

    // Create test admin user
    const user = new User({
      name: 'waslerr',
      email: 'waslerr@example.com',
      password: '123456',
      role: 'admin'
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Test admin user created',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Error creating test user'
    });
  }
});
router.post(
    '/login',
    [
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Password is required').exists()
    ],
    async (req, res, next) => {
        console.log('Login request received:', { email: req.body.email });

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Login validation errors:', errors.array());
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        try {
            // Find user and include password field
            let user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
            console.log('User found:', user ? 'Yes' : 'No');

            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid credentials',
                    errors: [{ msg: 'Invalid credentials' }]
                });
            }

            // Check password using the model method
            const isMatch = await user.matchPassword(password);
            console.log('Password match:', isMatch ? 'Yes' : 'No');

            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid credentials',
                    errors: [{ msg: 'Invalid credentials' }]
                });
            }

            // Create JWT payload
            const payload = {
                user: {
                    id: user._id
                }
            };

            // Generate JWT token
            const token = jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: '5d' }
            );

            console.log('Login successful for user:', user._id);

            // Send response
            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });

        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({
                success: false,
                message: 'Server error during login',
                error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
            });
        }
    }
);

// @route    GET api/auth/me
// @desc     Get current user
// @access   Private
router.get('/me', protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error getting user data'
        });
    }
});

module.exports = router;