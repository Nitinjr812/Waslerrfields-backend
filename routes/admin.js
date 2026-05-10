const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');

// ─────────────────────────────────────────────
// POST /api/admin/seed
// Ek baar chalao — initial username/password set karo
// Body: { username, password, setupKey }
// ─────────────────────────────────────────────
router.post('/seed', async (req, res) => {
  try {
    const { username, password, setupKey } = req.body;

    if (setupKey !== process.env.SETUP_KEY) {
      return res.status(403).json({ message: 'Invalid setup key' });
    }

    const existing = await Admin.findOne({ username });
    if (existing) {
      return res.status(409).json({ message: 'Admin already exists' });
    }

    const admin = new Admin({ username, password });
    await admin.save();

    res.status(201).json({ message: 'Admin created successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/admin/login
// Body: { username, password }
// ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.status(200).json({
      message: 'Login successful',
      username: admin.username,
      sessionVersion: admin.sessionVersion, // 👈 version bhejo
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/admin/change-password
// Body: { username, currentPassword, newPassword }
// ─────────────────────────────────────────────
router.post('/change-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;

    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'All fields required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    admin.password = newPassword;
    admin.sessionVersion = (admin.sessionVersion || 1) + 1; // 👈 version increment
    await admin.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/admin/verify
// Body: { username, sessionVersion }
// Check karo ki session abhi valid hai ya nahi
// ─────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  try {
    const { username, sessionVersion } = req.body;

    if (!username || sessionVersion === undefined) {
      return res.status(400).json({ valid: false });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(404).json({ valid: false });
    }

    const valid = admin.sessionVersion === Number(sessionVersion);
    res.status(200).json({ valid });
  } catch (err) {
    res.status(500).json({ valid: false });
  }
});

module.exports = router;