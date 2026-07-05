const Mood = require('../model/Checkin');

// CREATE
exports.createCheckin = async (req, res) => {
  try {
    const { mood, intensity, note } = req.body;

    if (!mood) {
      return res.status(400).json({ message: 'Mood is required' });
    }

    const newMood = new Mood({
      userId: req.user.userId,
      mood,
      intensity,
      note
    });

    await newMood.save();

    res.status(201).json({
      message: 'Check-in successful',
      data: newMood
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Create check-in failed' });
  }
};


// GET
exports.getMyCheckins = async (req, res) => {
  try {
    const moods = await Mood.find({ userId: req.user.userId })
      .sort({ createdAt: -1 });

    res.json(moods);

  } catch (err) {
    res.status(500).json({ message: 'Get check-ins failed' });
  }
};


// DELETE
exports.deleteCheckin = async (req, res) => {
  try {
    const { id } = req.params;

    const mood = await Mood.findById(id);

    if (!mood) {
      return res.status(404).json({ message: 'Not found' });
    }

    if (mood.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await Mood.findByIdAndDelete(id);

    res.json({ message: 'Deleted successfully' });

  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
};