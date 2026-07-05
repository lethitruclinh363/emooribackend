const Mascot = require('../../model/Mascot');

exports.getMascots = async (req, res) => {
  try {
    const mascots = await Mascot.find().sort({ requiredLevel: 1 }).lean();
    return res.status(200).json(mascots);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.createMascot = async (req, res) => {
  try {
    const { name, description, level, requiredLevel, animation, skin, image, type, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const mascot = await Mascot.create({
      name,
      description: description || '',
      level: level || 'Baby',
      requiredLevel: requiredLevel || 1,
      animation: animation || 'Idle',
      skin: skin || 'default',
      image: image || '🐹',
      type: type || 'free',
      isActive: isActive !== false
    });
    
    return res.status(201).json(mascot);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.updateMascot = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const mascot = await Mascot.findByIdAndUpdate(id, updates, { new: true });
    
    if (!mascot) {
      return res.status(404).json({ error: 'Mascot not found' });
    }
    
    return res.status(200).json(mascot);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.deleteMascot = async (req, res) => {
  try {
    const { id } = req.params;
    
    const mascot = await Mascot.findByIdAndDelete(id);
    
    if (!mascot) {
      return res.status(404).json({ error: 'Mascot not found' });
    }
    
    return res.status(200).json({ message: 'Mascot deleted' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.toggleMascot = async (req, res) => {
  try {
    const { id } = req.params;
    
    const mascot = await Mascot.findById(id);
    if (!mascot) {
      return res.status(404).json({ error: 'Mascot not found' });
    }
    
    mascot.isActive = !mascot.isActive;
    await mascot.save();
    
    return res.status(200).json(mascot);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
