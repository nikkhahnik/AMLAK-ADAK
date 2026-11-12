const https = require('https');

// GitHub API wrapper for managing properties.json
class GitHubAPI {
  constructor(token, owner, repo) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.baseUrl = 'api.github.com';
  }

  async request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path: path,
        method: method,
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'AMLAK-ADAK-Admin'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async getFile(path) {
    const res = await this.request('GET', `/repos/${this.owner}/${this.repo}/contents/${path}`);
    return {
      content: Buffer.from(res.content, 'base64').toString('utf8'),
      sha: res.sha
    };
  }

  async updateFile(path, content, message, sha) {
    const body = {
      message: message,
      content: Buffer.from(content).toString('base64'),
      sha: sha,
      branch: 'main'
    };

    return this.request('PUT', `/repos/${this.owner}/${this.repo}/contents/${path}`, body);
  }

  async listProperties() {
    const { content } = await this.getFile('properties.json');
    return JSON.parse(content);
  }

  async saveProperties(properties, message) {
    const { sha } = await this.getFile('properties.json');
    const content = JSON.stringify(properties, null, 2);
    return this.updateFile('properties.json', content, message, sha);
  }

  async addProperty(code, data) {
    const props = await this.listProperties();
    if (props.find(p => p.slug === code)) {
      throw new Error(`Property ${code} already exists`);
    }

    props.push({
      slug: code,
      title: data.title_fa || code,
      summary: data.description || '',
      category: null,
      area_m2: parseInt(data.area) || 0,
      bedrooms: parseInt(data.bedrooms) || 0,
      city: data.city || 'کرج',
      public_area: null,
      cover: data.cover || '',
      gallery: data.gallery || [],
      is_published: true,
      seo_title: (data.title_fa || code) + ' | املاک آداک',
      seo_description: data.description || ''
    });

    await this.saveProperties(props, `Add property: ${code}`);
    return `✅ Property ${code} added`;
  }

  async editProperty(code, field, value) {
    const props = await this.listProperties();
    const idx = props.findIndex(p => p.slug === code);
    if (idx === -1) throw new Error(`Property ${code} not found`);

    props[idx][field] = isNaN(value) ? value : parseInt(value);
    await this.saveProperties(props, `Edit ${code}: ${field} = ${value}`);
    return `✅ Property ${code} updated`;
  }

  async deleteProperty(code) {
    const props = await this.listProperties();
    const idx = props.findIndex(p => p.slug === code);
    if (idx === -1) throw new Error(`Property ${code} not found`);

    props.splice(idx, 1);
    await this.saveProperties(props, `Delete property: ${code}`);
    return `✅ Property ${code} deleted`;
  }
}

module.exports = GitHubAPI;
