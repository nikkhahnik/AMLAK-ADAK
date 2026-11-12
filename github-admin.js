#!/usr/bin/env node
const GitHubAPI = require('./github-api');

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'nikkhahnik';
const REPO = 'AMLAK-ADAK';

if (!TOKEN) {
  console.error('❌ GITHUB_TOKEN environment variable not set');
  console.error('Usage: GITHUB_TOKEN=your_token node github-admin.js <command>');
  process.exit(1);
}

const github = new GitHubAPI(TOKEN, OWNER, REPO);
const cmd = process.argv[2];
const args = process.argv.slice(3);

(async () => {
  try {
    if (cmd === 'list') {
      const props = await github.listProperties();
      console.log(JSON.stringify(props, null, 2));
    }

    else if (cmd === 'add') {
      const code = args[0];
      if (!code) throw new Error('Code required');
      
      const result = await github.addProperty(code, {
        title_fa: args[1] || code,
        description: args[2] || '',
        area: args[3] || '0',
        bedrooms: args[4] || '0',
        city: args[5] || 'کرج'
      });
      console.log(result);
    }

    else if (cmd === 'edit') {
      const code = args[0];
      const field = args[1];
      const value = args.slice(2).join(' ');
      if (!code || !field) throw new Error('Code and field required');
      
      const result = await github.editProperty(code, field, value);
      console.log(result);
    }

    else if (cmd === 'delete') {
      const code = args[0];
      if (!code) throw new Error('Code required');
      
      const result = await github.deleteProperty(code);
      console.log(result);
    }

    else {
      console.log(`Usage:
  GITHUB_TOKEN=token node github-admin.js list
  GITHUB_TOKEN=token node github-admin.js add <code> <title> <description> <area> <beds> <city>
  GITHUB_TOKEN=token node github-admin.js edit <code> <field> <value>
  GITHUB_TOKEN=token node github-admin.js delete <code>
`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
