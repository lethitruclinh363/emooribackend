const mongoose = require('mongoose');

const AppSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.model('AppSettings', AppSettingsSchema);
