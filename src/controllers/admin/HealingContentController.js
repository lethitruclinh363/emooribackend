const HealingContent = require('../../model/HealingContent');

exports.getHealingContent = async (req, res) => {
  try {
    const contents = await HealingContent.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json(contents);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.createHealingContent = async (req, res) => {
  try {
    const { title, category, content, emotion, type, isActive } = req.body;
    
    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category are required' });
    }
    
    const healingContent = await HealingContent.create({
      title,
      category,
      content: content || '',
      emotion: emotion || 'neutral',
      type: type || 'free',
      isActive: isActive !== false
    });
    
    return res.status(201).json(healingContent);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.updateHealingContent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const healingContent = await HealingContent.findByIdAndUpdate(id, updates, { new: true });
    
    if (!healingContent) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    return res.status(200).json(healingContent);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.deleteHealingContent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const healingContent = await HealingContent.findByIdAndDelete(id);
    
    if (!healingContent) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    return res.status(200).json({ message: 'Content deleted' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.toggleHealingContent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const healingContent = await HealingContent.findById(id);
    if (!healingContent) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    healingContent.isActive = !healingContent.isActive;
    await healingContent.save();
    
    return res.status(200).json(healingContent);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
