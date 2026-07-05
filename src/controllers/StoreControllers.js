const StorePackage = require('../model/StorePackage');

function normalizeBenefits(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((x) => String(x).trim()).filter(Boolean);
  }
  return String(input)
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

exports.getStorePackages = async (req, res) => {
  try {
    const items = await StorePackage.find({ isActive: true }).sort({ amount: -1, createdAt: -1 }).lean();
    return res.json(items);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

exports.getStorePackagesAdmin = async (req, res) => {
  try {
    const items = await StorePackage.find({}).sort({ createdAt: -1 }).lean();
    return res.json(items);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

exports.createStorePackage = async (req, res) => {
  try {
    const { name, level, amount, durationDays, benefits, isActive } = req.body || {};

    if (!name || !level) {
      return res.status(400).json({ message: 'name and level are required' });
    }

    const parsedAmount = Number(amount);
    const parsedDurationDays = Number(durationDays);

    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ message: 'amount must be a non-negative number' });
    }

    if (!Number.isFinite(parsedDurationDays) || parsedDurationDays < 1) {
      return res.status(400).json({ message: 'durationDays must be >= 1' });
    }

    const doc = await StorePackage.create({
      name: String(name).trim(),
      level: String(level).trim(),
      amount: parsedAmount,
      durationDays: parsedDurationDays,
      benefits: normalizeBenefits(benefits),
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    return res.status(201).json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

exports.updateStorePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, level, amount, durationDays, benefits, isActive } = req.body || {};

    const update = {};

    if (typeof name === 'string') update.name = name.trim();
    if (typeof level === 'string') update.level = level.trim();
    if (typeof isActive === 'boolean') update.isActive = isActive;

    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
        return res.status(400).json({ message: 'amount must be a non-negative number' });
      }
      update.amount = parsedAmount;
    }

    if (durationDays !== undefined) {
      const parsedDurationDays = Number(durationDays);
      if (!Number.isFinite(parsedDurationDays) || parsedDurationDays < 1) {
        return res.status(400).json({ message: 'durationDays must be >= 1' });
      }
      update.durationDays = parsedDurationDays;
    }

    if (benefits !== undefined) {
      update.benefits = normalizeBenefits(benefits);
    }

    const doc = await StorePackage.findByIdAndUpdate(id, update, { new: true });
    if (!doc) {
      return res.status(404).json({ message: 'Store package not found' });
    }

    return res.json(doc);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

exports.deleteStorePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await StorePackage.findByIdAndDelete(id);
    if (!doc) {
      return res.status(404).json({ message: 'Store package not found' });
    }
    return res.json({ message: 'Deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

