const mongoose = require('mongoose');

const MascotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  level: { 
    type: String, 
    enum: ['Baby', 'Teen', 'Adult', 'Legend'], 
    default: 'Baby' 
  },
  requiredLevel: { type: Number, default: 1 },
  animation: { 
    type: String, 
    enum: ['Idle', 'Blink', 'Bounce', 'Happy', 'Sad', 'Sleeping', 'Floating', 'LevelUp'],
    default: 'Idle' 
  },
  skin: { type: String, default: 'default' },
  image: { type: String, default: '🐹' },
  type: { 
    type: String, 
    enum: ['free', 'premium'], 
    default: 'free' 
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Mascot', MascotSchema);
