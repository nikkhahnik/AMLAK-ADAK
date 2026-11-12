const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const properties = JSON.parse(event.body);
    
    // Save to properties.json in the repo
    const filePath = path.join(__dirname, '../../properties.json');
    fs.writeFileSync(filePath, JSON.stringify(properties, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Properties saved' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
