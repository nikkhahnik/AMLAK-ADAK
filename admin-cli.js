#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROPERTIES_FILE = path.join(__dirname, 'properties.json');

function loadProperties() {
  const data = fs.readFileSync(PROPERTIES_FILE, 'utf8');
  return JSON.parse(data);
}

function saveProperties(properties, commitMsg) {
  fs.writeFileSync(PROPERTIES_FILE, JSON.stringify(properties, null, 2));
  
  try {
    execSync('git add properties.json', { cwd: __dirname, stdio: 'pipe' });
    execSync(`git commit -m "${commitMsg}"`, { cwd: __dirname, stdio: 'pipe' });
    execSync('git push', { cwd: __dirname, stdio: 'pipe' });
    console.log('✅ ' + commitMsg);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

const cmd = process.argv[2];
const args = process.argv.slice(3);

try {
  const props = loadProperties();

  if (cmd === 'list') {
    console.log(JSON.stringify(props, null, 2));
  }

  else if (cmd === 'add') {
    const code = args[0];
    if (!code) throw new Error('Code required');
    if (props.find(p => p.code === code)) throw new Error(`Property ${code} already exists`);
    
    props.push({
      code,
      title_fa: args[1] || '',
      city: 'کرج',
      district: args[2] || '',
      area: args[3] || '',
      bedrooms: parseInt(args[4]) || 0,
      description: args[5] || '',
      phone: args[6] || '',
      images: []
    });
    
    saveProperties(props, `Add property: ${code}`);
  }

  else if (cmd === 'edit') {
    const code = args[0];
    const field = args[1];
    const value = args.slice(2).join(' ');
    
    const idx = props.findIndex(p => p.code === code);
    if (idx === -1) throw new Error(`Property ${code} not found`);
    
    if (field === 'bedrooms' || field === 'area') {
      props[idx][field] = isNaN(value) ? value : parseInt(value);
    } else {
      props[idx][field] = value;
    }
    
    saveProperties(props, `Edit ${code}: ${field}`);
  }

  else if (cmd === 'delete') {
    const code = args[0];
    const idx = props.findIndex(p => p.code === code);
    if (idx === -1) throw new Error(`Property ${code} not found`);
    
    props.splice(idx, 1);
    saveProperties(props, `Delete property: ${code}`);
  }

  else if (cmd === 'get') {
    const code = args[0];
    const prop = props.find(p => p.code === code);
    if (!prop) throw new Error(`Property ${code} not found`);
    console.log(JSON.stringify(prop, null, 2));
  }

  else {
    console.log(`Usage:
  node admin-cli.js list                          - List all properties
  node admin-cli.js get <code>                    - Get property details
  node admin-cli.js add <code> <title> <district> <area> <beds> <description> <phone>
  node admin-cli.js edit <code> <field> <value>  - Edit property field
  node admin-cli.js delete <code>                 - Delete property
`);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
