const Journal = require('../model/Journal');

// CREATE
exports.createJournal = async (req, res) => {
  try {
    const { title, text, mood, isPrivate } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }

    const journal = new Journal({
      userId: req.user.userId,
      title,
      text,
      mood,
      isPrivate
    });

    await journal.save();

    res.status(201).json({
      message: 'Journal created',
      data: journal
    });

  } catch (err) {
    res.status(500).json({ message: 'Create failed' });
  }
};



// GET MY JOURNALS
exports.getMyJournals = async (req, res) => {
  try {
    const journals = await Journal.find({ userId: req.user.userId })
      .sort({ createdAt: -1 });

    res.json(journals);

  } catch (err) {
    res.status(500).json({ message: 'Get failed' });
  }
};



// GET PUBLIC JOURNALS (feed)
exports.getPublicJournals = async (req, res) => {
  try {
    const journals = await Journal.find({ isPrivate: false })
      .populate('userId', 'email')
      .sort({ createdAt: -1 });

    res.json(journals);

  } catch (err) {
    res.status(500).json({ message: 'Get public failed' });
  }
};



// UPDATE
exports.updateJournal = async (req, res) => {
  try {
    const { id } = req.params;

    const journal = await Journal.findById(id);

    if (!journal) {
      return res.status(404).json({ message: 'Not found' });
    }

    if (journal.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    Object.assign(journal, req.body);

    await journal.save();

    res.json({
      message: 'Updated',
      data: journal
    });

  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
};



// DELETE
exports.deleteJournal = async (req, res) => {
  try {
    const { id } = req.params;

    const journal = await Journal.findById(id);

    if (!journal) {
      return res.status(404).json({ message: 'Not found' });
    }

    if (journal.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await Journal.findByIdAndDelete(id);

    res.json({ message: 'Deleted' });

  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
};