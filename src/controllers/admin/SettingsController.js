const AppSettings = require('../../model/AppSettings');
const StorePackage = require('../../model/StorePackage');
const Subscription = require('../../model/Subscription');

const DEFAULT_SETTINGS = {
  appName: 'EMOORI',
  logo: '',
  brandColor: '#0ea5e9',
  maintenanceMode: false,
  premiumMonthlyPrice: 49000,
  premiumPlusYearlyPrice: 399000,
  xpPerCheckIn: 10,
  xpPerJournal: 20,
  xpPerBreathing: 15,
  streakBonusMultiplier: 5
};

exports.getSettings = async (req, res) => {
  try {
    const settingsDoc = await AppSettings.findOne({ key: 'app_settings' }).lean();
    
    if (!settingsDoc) {
      // Create default settings if not exists
      const newSettings = await AppSettings.create({
        key: 'app_settings',
        value: DEFAULT_SETTINGS
      });
      return res.status(200).json(DEFAULT_SETTINGS);
    }
    
    return res.status(200).json(settingsDoc.value || DEFAULT_SETTINGS);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body;
    
    const mergedValue = { ...DEFAULT_SETTINGS, ...updates };
    
    const settings = await AppSettings.findOneAndUpdate(
      { key: 'app_settings' },
      { value: mergedValue },
      { new: true, upsert: true }
    );
    
    return res.status(200).json(settings.value);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.getPremiumPackages = async (req, res) => {
  try {
    const packages = await StorePackage.find().sort({ amount: 1 }).lean();
    
    // Get subscriber counts for each package
    const packagesWithStats = await Promise.all(packages.map(async (pkg) => {
      const subscribers = await Subscription.countDocuments({ 
        plan: pkg.level.toLowerCase().includes('plus') ? 'premium_plus' : 'premium',
        status: 'active'
      });
      
      return {
        _id: pkg._id,
        name: pkg.name,
        price: pkg.amount,
        duration: `${pkg.durationDays} days`,
        subscribers,
        revenue: pkg.amount * subscribers,
        features: pkg.benefits || [],
        status: pkg.isActive ? 'active' : 'inactive'
      };
    }));
    
    return res.status(200).json(packagesWithStats);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.createPremiumPackage = async (req, res) => {
  try {
    const { name, price, duration, benefits, status } = req.body;
    
    if (!name || !duration) {
      return res.status(400).json({ error: 'Name and duration are required' });
    }
    
    const durationDays = parseInt(duration);
    
    const pkg = await StorePackage.create({
      name,
      level: name.toLowerCase().includes('plus') ? 'Premium Plus' : 'Premium',
      amount: parseInt(price) || 0,
      durationDays,
      benefits: benefits || [],
      isActive: status !== 'inactive'
    });
    
    return res.status(201).json(pkg);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.updatePremiumPackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, duration, benefits, status } = req.body;
    
    const update = {};
    if (name) update.name = name;
    if (price !== undefined) update.amount = parseInt(price);
    if (duration) update.durationDays = parseInt(duration);
    if (benefits) update.benefits = benefits;
    if (status) update.isActive = status !== 'inactive';
    
    const pkg = await StorePackage.findByIdAndUpdate(id, update, { new: true });
    
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    return res.status(200).json(pkg);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.deletePremiumPackage = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pkg = await StorePackage.findByIdAndDelete(id);
    
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    return res.status(200).json({ message: 'Package deleted' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.togglePremiumPackage = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pkg = await StorePackage.findById(id);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    pkg.isActive = !pkg.isActive;
    await pkg.save();
    
    return res.status(200).json(pkg);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
