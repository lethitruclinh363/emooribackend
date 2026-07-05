const Theme = require('../../model/Theme');

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePreviewColors(previewColors, primaryColor, secondaryColor) {
  if (Array.isArray(previewColors) && previewColors.length > 0) {
    return previewColors.map((c) => String(c).trim()).filter(Boolean);
  }
  const p = String(primaryColor || '').trim();
  const s = String(secondaryColor || '').trim();
  return [p, s].filter(Boolean);
}

exports.getThemes = async (req, res) => {
  try {
    const themes = await Theme.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json(themes);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.createTheme = async (req, res) => {
  try {
    const { name, slug, type, primaryColor, secondaryColor, gradient, preview, previewColors, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const computedSlug = slugify(slug || name);
    if (!computedSlug) {
      return res.status(400).json({ error: 'Slug is invalid' });
    }

    const exists = await Theme.findOne({ $or: [{ name }, { slug: computedSlug }] }).lean();
    if (exists) {
      return res.status(409).json({ error: 'Theme already exists' });
    }
    
    const theme = await Theme.create({
      name,
      slug: computedSlug,
      type: type || 'free',
      primaryColor: primaryColor || '#0ea5e9',
      secondaryColor: secondaryColor || '#06b6d4',
      gradient: gradient || 'from-sky-400 to-cyan-500',
      preview: preview || '🎨',
      previewColors: normalizePreviewColors(previewColors, primaryColor || '#0ea5e9', secondaryColor || '#06b6d4'),
      isActive: isActive !== false
    });
    
    return res.status(201).json(theme);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Theme already exists' });
    }
    return res.status(500).json({ error: error.message });
  }
};

exports.updateTheme = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.name !== undefined || updates.slug !== undefined) {
      const computedSlug = slugify(updates.slug || updates.name);
      if (!computedSlug) {
        return res.status(400).json({ error: 'Slug is invalid' });
      }
      updates.slug = computedSlug;

      const exists = await Theme.findOne({ slug: computedSlug, _id: { $ne: id } }).lean();
      if (exists) {
        return res.status(409).json({ error: 'Slug already exists' });
      }
    }

    if (updates.previewColors !== undefined || updates.primaryColor !== undefined || updates.secondaryColor !== undefined) {
      const current = await Theme.findById(id).lean();
      if (!current) {
        return res.status(404).json({ error: 'Theme not found' });
      }
      updates.previewColors = normalizePreviewColors(
        updates.previewColors,
        updates.primaryColor ?? current.primaryColor,
        updates.secondaryColor ?? current.secondaryColor
      );
    }

    const theme = await Theme.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    
    return res.status(200).json(theme);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Theme already exists' });
    }
    return res.status(500).json({ error: error.message });
  }
};

exports.deleteTheme = async (req, res) => {
  try {
    const { id } = req.params;
    
    const theme = await Theme.findByIdAndDelete(id);
    
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    
    return res.status(200).json({ message: 'Theme deleted' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.toggleTheme = async (req, res) => {
  try {
    const { id } = req.params;
    
    const current = await Theme.findById(id).lean();
    if (!current) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    
    const theme = await Theme.findByIdAndUpdate(
      id,
      { $set: { isActive: !current.isActive } },
      { new: true }
    );
    return res.status(200).json(theme);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
