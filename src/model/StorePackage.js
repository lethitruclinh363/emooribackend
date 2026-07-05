const mongoose = require('mongoose');

const storePackageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    durationDays: { type: Number, required: true, min: 1 },
    benefits: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StorePackage', storePackageSchema);

