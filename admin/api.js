// Direct API for Claude to manage properties
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROPERTIES_FILE = path.join(__dirname, '../properties.json');

function loadProperties() {
  const data = fs.readFileSync(PROPERTIES_FILE, 'utf8');
  return JSON.parse(data);
}

function saveProperties(properties) {
  fs.writeFileSync(PROPERTIES_FILE, JSON.stringify(properties, null, 2));
  
  // Auto-commit and push
  try {
    execSync('git add properties.json', { cwd: path.join(__dirname, '..') });
    execSync(`git commit -m "Update: Modify properties via admin panel"`, { cwd: path.join(__dirname, '..') });
    execSync('git push', { cwd: path.join(__dirname, '..') });
  } catch (error) {
    console.log('Auto-commit note:', error.message);
  }
}

// Commands for Claude to use
const commands = {
  // Get all properties
  list() {
    return loadProperties();
  },

  // Add new property
  add(code, data) {
    const props = loadProperties();
    if (props.find(p => p.code === code)) {
      throw new Error(`Property ${code} already exists`);
    }
    props.push({
      code,
      title_fa: data.title_fa,
      title_en: data.title_en || '',
      city: data.city || 'کرج',
      district: data.district || '',
      area: data.area || '',
      bedrooms: data.bedrooms || 0,
      description: data.description || '',
      phone: data.phone || '',
      images: data.images || []
    });
    saveProperties(props);
    return `Property ${code} added`;
  },

  // Edit property
  edit(code, data) {
    const props = loadProperties();
    const idx = props.findIndex(p => p.code === code);
    if (idx === -1) {
      throw new Error(`Property ${code} not found`);
    }
    Object.assign(props[idx], data);
    saveProperties(props);
    return `Property ${code} updated`;
  },

  // Delete property
  delete(code) {
    const props = loadProperties();
    const idx = props.findIndex(p => p.code === code);
    if (idx === -1) {
      throw new Error(`Property ${code} not found`);
    }
    props.splice(idx, 1);
    saveProperties(props);
    return `Property ${code} deleted`;
  },

  // Get property by code
  get(code) {
    const props = loadProperties();
    const prop = props.find(p => p.code === code);
    if (!prop) {
      throw new Error(`Property ${code} not found`);
    }
    return prop;
  }
};

module.exports = commands;
