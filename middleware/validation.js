const validator = require('validator');

// Registration validation middleware
const validateRegistration = (req, res, next) => {
    const { name, email, password } = req.body;
    const errors = [];

    // Name validation
    if (!name || typeof name !== 'string') {
        errors.push('Name is required');
    } else if (name.trim().length < 2) {
        errors.push('Name must be at least 2 characters long');
    } else if (name.trim().length > 50) {
        errors.push('Name cannot exceed 50 characters');
    }

    // Email validation
    if (!email || typeof email !== 'string') {
        errors.push('Email is required');
    } else if (!validator.isEmail(email)) {
        errors.push('Please provide a valid email address');
    }

    // Password validation
    if (!password || typeof password !== 'string') {
        errors.push('Password is required');
    } else if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    } else if (password.length > 128) {
        errors.push('Password cannot exceed 128 characters');
    }

    // Check for common weak passwords
    const commonPasswords = ['123456', 'password', '123456789', 'qwerty', 'abc123'];
    if (password && commonPasswords.includes(password.toLowerCase())) {
        errors.push('Password is too common. Please choose a stronger password');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    next();
};

// Login validation middleware
const validateLogin = (req, res, next) => {
    const { email, password } = req.body;
    const errors = [];

    // Email validation
    if (!email || typeof email !== 'string') {
        errors.push('Email is required');
    } else if (!validator.isEmail(email)) {
        errors.push('Please provide a valid email address');
    }

    // Password validation
    if (!password || typeof password !== 'string') {
        errors.push('Password is required');
    } else if (password.length === 0) {
        errors.push('Password cannot be empty');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    next();
};

// Profile update validation
const validateProfileUpdate = (req, res, next) => {
    const { name } = req.body;
    const errors = [];

    if (name !== undefined) {
        if (!name || typeof name !== 'string') {
            errors.push('Name is required');
        } else if (name.trim().length < 2) {
            errors.push('Name must be at least 2 characters long');
        } else if (name.trim().length > 50) {
            errors.push('Name cannot exceed 50 characters');
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    next();
};

// Password change validation
const validatePasswordChange = (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    const errors = [];

    if (!currentPassword || typeof currentPassword !== 'string') {
        errors.push('Current password is required');
    }

    if (!newPassword || typeof newPassword !== 'string') {
        errors.push('New password is required');
    } else if (newPassword.length < 6) {
        errors.push('New password must be at least 6 characters long');
    } else if (newPassword.length > 128) {
        errors.push('New password cannot exceed 128 characters');
    }

    // Check if new password is different from current
    if (currentPassword && newPassword && currentPassword === newPassword) {
        errors.push('New password must be different from current password');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    next();
};

module.exports = {
    validateRegistration,
    validateLogin,
    validateProfileUpdate,
    validatePasswordChange
};