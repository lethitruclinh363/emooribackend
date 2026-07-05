const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema({
  mood: {
    type: String,
    enum: ['sad','anxious','angry']
  },

  title: String,
  content: String,

  type: {
    type: String,
    enum: ['advice','music','activity','quote']
  }

}, { timestamps: true });

module.exports = mongoose.model('Recommendation', RecommendationSchema);