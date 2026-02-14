// Configuration Management Script
let configData = {};

// Load configuration on page load
async function initConfig() {
  try {
    await loadConfig();
    populateFormFields();
  } catch (error) {
    console.error('Failed to load configuration:', error);
    showStatus('Failed to load configuration', 'error');
  }
}

// Load configuration from file
async function loadConfig() {
  try {
    // For browser-based config, use localStorage as fallback
    if (typeof Neutralino === 'undefined') {
      const storedConfig = localStorage.getItem('illyConfig');
      if (storedConfig) {
        configData = JSON.parse(storedConfig);
      } else {
        configData = getDefaultConfig();
        saveToLocalStorage();
      }
      return;
    }
    
    const configPath = './config.json';
    const configExists = await Neutralino.filesystem.exists(configPath);
    
    if (configExists) {
      const configDataStr = await Neutralino.filesystem.readFile(configPath);
      configData = JSON.parse(configDataStr);
    } else {
      // Create default configuration
      configData = getDefaultConfig();
      await saveConfigFile();
    }
  } catch (error) {
    configData = getDefaultConfig();
  }
}

// Get default configuration
function getDefaultConfig() {
  return {
    picovoice: {
      accessKey: ''
    },
    model: {
      path: 'tinyllama-1.1b-chat-v1.0.Q2_K.gguf',
      customPath: ''
    },
    tts: {
      engine: 'piper',
      model: 'en_US-amy-medium',
      customModelPath: ''
    },
    timeouts: {
      listen: 5,
      inactivity: 30
    }
  };
}

// Populate form fields with configuration data
function populateFormFields() {
  document.getElementById('picovoice-key').value = configData.picovoice?.accessKey || '';
  document.getElementById('model-path').value = configData.model?.path || 'tinyllama-1.1b-chat-v1.0.Q2_K.gguf';
  document.getElementById('tts-engine').value = configData.tts?.engine || 'piper';
  document.getElementById('tts-model').value = configData.tts?.model || 'en_US-amy-medium';
  document.getElementById('listen-timeout').value = configData.timeouts?.listen || 5;
  document.getElementById('inactivity-timeout').value = configData.timeouts?.inactivity || 30;
}

// Save configuration
async function saveConfig() {
  try {
    // Update configData from form fields
    configData.picovoice.accessKey = document.getElementById('picovoice-key').value.trim();
    configData.model.path = document.getElementById('model-path').value;
    configData.tts.engine = document.getElementById('tts-engine').value;
    configData.tts.model = document.getElementById('tts-model').value;
    configData.timeouts.listen = parseInt(document.getElementById('listen-timeout').value);
    configData.timeouts.inactivity = parseInt(document.getElementById('inactivity-timeout').value);

    await saveConfigFile();
    showStatus('Configuration saved successfully!', 'success');
    
    // Update environment variables
    await updateEnvironmentVariables();
  } catch (error) {
    console.error('Failed to save configuration:', error);
    showStatus('Failed to save configuration: ' + error.message, 'error');
  }
}

// Save configuration to file
async function saveConfigFile() {
  // For browser-based config, use localStorage as fallback
  if (typeof Neutralino === 'undefined') {
    saveToLocalStorage();
    return;
  }
  
  const configPath = './config.json';
  const configDataStr = JSON.stringify(configData, null, 2);
  await Neutralino.filesystem.writeFile(configPath, configDataStr);
}

// Save to localStorage
function saveToLocalStorage() {
  localStorage.setItem('illyConfig', JSON.stringify(configData));
}

// Update environment variables
async function updateEnvironmentVariables() {
  try {
    // Create .env file content
    let envContent = `PICOVOICE_ACCESS_KEY=${configData.picovoice.accessKey}\n`;
    
    if (configData.model.customPath) {
      envContent += `MODEL_PATH=${configData.model.customPath}\n`;
    }
    
    if (configData.tts.customModelPath) {
      envContent += `TTS_MODEL_PATH=${configData.tts.customModelPath}\n`;
    }
    
    // For browser-based config, send to server endpoint
    if (typeof Neutralino === 'undefined') {
      const response = await fetch('/save-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: configData,
          env: envContent
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save configuration files');
      }
      return;
    }
    
    await Neutralino.filesystem.writeFile('./.env', envContent);
  } catch (error) {
    console.error('Failed to update environment variables:', error);
  }
}

// Test configuration
async function testConfig() {
  showStatus('Testing configuration...', 'info');
  
  try {
    // Test API key format (basic validation)
    const apiKey = configData.picovoice.accessKey;
    if (!apiKey) {
      throw new Error('PicoVoice access key is required');
    }
    
    // Test if model file exists
    const modelPath = configData.model.path === 'custom' ? 
      configData.model.customPath : configData.model.path;
    
    if (modelPath && modelPath !== 'tinyllama-1.1b-chat-v1.0.Q2_K.gguf') {
      const modelExists = await Neutralino.filesystem.exists(modelPath);
      if (!modelExists) {
        throw new Error(`Model file not found: ${modelPath}`);
      }
    }
    
    showStatus('Configuration test passed!', 'success');
  } catch (error) {
    showStatus('Configuration test failed: ' + error.message, 'error');
  }
}

// Reset configuration to defaults
async function resetConfig() {
  if (confirm('Are you sure you want to reset all configuration to defaults?')) {
    configData = getDefaultConfig();
    populateFormFields();
    await saveConfigFile();
    showStatus('Configuration reset to defaults', 'success');
  }
}

// Toggle password visibility
function togglePasswordVisibility(fieldId) {
  const field = document.getElementById(fieldId);
  field.type = field.type === 'password' ? 'text' : 'password';
}

// Browse for file
async function browseFile(targetFieldId) {
  try {
    const entry = await Neutralino.os.showFolderDialog('Select Model File');
    if (targetFieldId === 'model-path') {
      configData.model.customPath = entry;
      // Add custom option if not present
      const select = document.getElementById(targetFieldId);
      const customOption = Array.from(select.options).find(opt => opt.value === 'custom');
      if (!customOption) {
        const option = new Option('Custom Model', 'custom');
        select.add(option);
      }
      select.value = 'custom';
    }
    showStatus('File selected: ' + entry, 'info');
  } catch (error) {
    if (error.code !== 'NS_ERROR_CANCELED') {
      showStatus('Failed to select file: ' + error.message, 'error');
    }
  }
}

// Show status message
function showStatus(message, type) {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.opacity = '1';
  
  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusEl.style.opacity = '0';
    }, 3000);
  }
}

// Handle window close
async function onClose() {
  // Cleanup if needed
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initConfig);

// Set up window close handler
Neutralino.init();
Neutralino.events.on('windowClose', onClose);