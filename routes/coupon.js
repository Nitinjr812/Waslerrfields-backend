// routes/coupon.js
const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const { protect } = require('../middleware/auth'); // Tumhare auth middleware

// Create coupon (Admin only)
router.post('/api/coupons', protect, async (req, res) => {
  // Optional: admin role validation
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  try {
    const { code, discountType, discountValue, expiry, maxUses } = req.body;
    const coupon = new Coupon({ code, discountType, discountValue, expiry, maxUses });
    await coupon.save();
    res.json({ success: true, coupon });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
