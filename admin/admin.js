let properties = [];
let currentEditCode = null;

async function loadProperties() {
  try {
    const res = await fetch('../properties.json');
    properties = await res.json();
    displayProperties();
  } catch (error) {
    console.error('Error loading properties:', error);
  }
}

function displayProperties() {
  const list = document.getElementById('properties-list');
  list.innerHTML = '';
  
  properties.forEach(prop => {
    const item = document.createElement('div');
    item.className = 'property-item';
    item.innerHTML = `
      <h3>${prop.title_fa} (${prop.code})</h3>
      <p><strong>آدرس:</strong> ${prop.city || 'نامشخص'} - ${prop.district || 'نامشخص'}</p>
      <p><strong>متراژ:</strong> ${prop.area || '-'} | <strong>اتاق:</strong> ${prop.bedrooms || '-'}</p>
      <p><strong>توضیح:</strong> ${prop.description ? prop.description.substring(0, 100) + '...' : '-'}</p>
      <div class="actions">
        <button class="btn btn-secondary" onclick="editProperty('${prop.code}')">✏️ ویرایش</button>
        <button class="btn btn-danger" onclick="deleteProperty('${prop.code}')">🗑️ حذف</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function editProperty(code) {
  const prop = properties.find(p => p.code === code);
  if (!prop) return;
  
  currentEditCode = code;
  document.getElementById('edit-code').value = prop.code;
  document.getElementById('edit-title-fa').value = prop.title_fa || '';
  document.getElementById('edit-city').value = prop.city || '';
  document.getElementById('edit-district').value = prop.district || '';
  document.getElementById('edit-area').value = prop.area || '';
  document.getElementById('edit-bedrooms').value = prop.bedrooms || '';
  document.getElementById('edit-description').value = prop.description || '';
  
  document.getElementById('edit-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('edit-modal').classList.remove('active');
  currentEditCode = null;
}

function saveProperty(event) {
  event.preventDefault();
  
  const idx = properties.findIndex(p => p.code === currentEditCode);
  if (idx === -1) return;
  
  properties[idx].title_fa = document.getElementById('edit-title-fa').value;
  properties[idx].city = document.getElementById('edit-city').value;
  properties[idx].district = document.getElementById('edit-district').value;
  properties[idx].area = document.getElementById('edit-area').value;
  properties[idx].bedrooms = parseInt(document.getElementById('edit-bedrooms').value) || 0;
  properties[idx].description = document.getElementById('edit-description').value;
  
  saveToServer();
  closeModal();
  displayProperties();
  showMessage('✅ ملک ویرایش شد', 'success');
}

function deleteProperty(code) {
  if (!confirm('آیا از حذف این ملک اطمینان دارید؟')) return;
  
  properties = properties.filter(p => p.code !== code);
  saveToServer();
  displayProperties();
  showMessage('✅ ملک حذف شد', 'success');
}

function addProperty(event) {
  event.preventDefault();
  
  const code = document.getElementById('code').value;
  if (properties.find(p => p.code === code)) {
    showMessage('❌ این کد قبلاً وجود دارد', 'error');
    return;
  }
  
  const newProp = {
    code: code,
    title_fa: document.getElementById('title-fa').value,
    city: document.getElementById('city').value,
    district: document.getElementById('district').value,
    area: document.getElementById('area').value,
    bedrooms: parseInt(document.getElementById('bedrooms').value) || 0,
    description: document.getElementById('description').value,
    phone: document.getElementById('phone').value,
    images: []
  };
  
  properties.push(newProp);
  saveToServer();
  document.getElementById('new-property-form').reset();
  showMessage('✅ ملک جدید اضافه شد', 'success');
  switchTab('properties');
  displayProperties();
}

async function saveToServer() {
  try {
    const res = await fetch('../api/save-properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(properties)
    });
    
    if (res.ok) {
      console.log('Properties saved');
    }
  } catch (error) {
    console.error('Error saving:', error);
    // Fallback: try to save as JSON locally via download
    const dataStr = JSON.stringify(properties, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'properties.json';
    // Note: User needs to manually upload this back
    console.log('Could not save to server. Please contact admin.');
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tab).classList.add('active');
  event.target.classList.add('active');
}

function showMessage(msg, type) {
  const msgEl = document.getElementById('message');
  msgEl.className = type;
  msgEl.textContent = msg;
  setTimeout(() => msgEl.textContent = '', 3000);
}

// Load on startup
loadProperties();
