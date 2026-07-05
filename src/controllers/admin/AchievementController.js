const Achievement = require('../../model/Achievement');

exports.getAchievements = async (req, res) => {
  try {
    const achievements = await Achievement.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json(achievements);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.createAchievement = async (req, res) => {
  try {
    const { name, description, condition, xpReward, icon, type, isActive } = req.body;
    
    if (!name || !condition) {
      return res.status(400).json({ error: 'Name and condition are required' });
    }
    
    const achievement = await Achievement.create({
      name,
      description: description || '',
      condition,
      xpReward: xpReward || 0,
      icon: icon || '🏆',
      type: type || 'free',
      isActive: isActive !== false
    });
    
    return res.status(201).json(achievement);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.updateAchievement = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const achievement = await Achievement.findByIdAndUpdate(id, updates, { new: true });
    
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    
    return res.status(200).json(achievement);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.deleteAchievement = async (req, res) => {
  try {
    const { id } = req.params;
    
    const achievement = await Achievement.findByIdAndDelete(id);
    
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    
    return res.status(200).json({ message: 'Achievement deleted' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.toggleAchievement = async (req, res) => {
  try {
    const { id } = req.params;
    
    const achievement = await Achievement.findById(id);
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    
    achievement.isActive = !achievement.isActive;
    await achievement.save();
    
    return res.status(200).json(achievement);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
