// models/Coupon.js
const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    discountType: { type: String, enum: ['percent', 'amount'], required: true },
    discountValue: { type: Number, required: true },
    expiry: { type: Date },
    maxUses: { type: Number },
    currentUses: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
