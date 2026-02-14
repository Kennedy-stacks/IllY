// Modern Configuration Management JavaScript
class ConfigurationManager {
    constructor() {
        this.config = {
            picovoice: { accessKey: '' },
            model: { path: '', customPath: '' },
            tts: { engine: 'piper', model: 'en_US-amy-medium' },
            timeouts: { listen: 5, inactivity: 30 }
        };
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.setupEventListeners();
        this.populateForm();
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('config-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveConfig();
        });

        // Range inputs
        const listenTimeout = document.getElementById('listen-timeout');
        const inactivityTimeout = document.getElementById('inactivity-timeout');
        
        listenTimeout.addEventListener('input', (e) => {
            document.getElementById('listen-timeout-value').textContent = e.target.value;
        });

        inactivityTimeout.addEventListener('input', (e) => {
            document.getElementById('inactivity-timeout-value').textContent = e.target.value;
        });

        // Model selection change
        document.getElementById('model-path').addEventListener('change', (e) => {
            if (e.target.value !== 'custom') {
                document.getElementById('model-info').style.display = 'none';
            }
        });

        // File input change
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files[0]);
        });

        // TTS File input change
        document.getElementById('tts-file-input').addEventListener('change', (e) => {
            this.handleTTSFileSelection(e.target.files[0]);
        });

        // TTS model selection change
        document.getElementById('tts-model').addEventListener('change', (e) => {
            if (e.target.value !== 'custom') {
                document.getElementById('tts-model-info').style.display = 'none';
            }
        });
    }

    async loadConfig() {
        try {
            this.showLoading('Loading configuration...');
            const response = await fetch('/api/config');
            
            if (response.ok) {
                const data = await response.json();
                this.config = { ...this.config, ...data };
            } else {
                console.warn('No existing configuration found, using defaults');
            }
        } catch (error) {
            console.warn('Failed to load configuration:', error);
        } finally {
            this.hideLoading();
        }
    }

    populateForm() {
        // PicoVoice
        document.getElementById('picovoice-key').value = this.config.picovoice.accessKey || '';

        // AI Model
        const modelSelect = document.getElementById('model-path');
        if (this.config.model.customPath) {
            // Add custom option if it doesn't exist
            let customOption = Array.from(modelSelect.options).find(opt => opt.value === 'custom');
            if (!customOption) {
                customOption = new Option('Custom Model', 'custom');
                modelSelect.add(customOption);
            }
            modelSelect.value = 'custom';
            this.showCustomModelInfo(this.config.model.customPath);
        } else {
            modelSelect.value = 'custom'; // Always require custom model
        }

        // TTS
        document.getElementById('tts-engine').value = this.config.tts.engine || 'piper';
        
        const ttsModelSelect = document.getElementById('tts-model');
        if (this.config.tts.customModelPath) {
            // Add custom option if it doesn't exist
            let customOption = Array.from(ttsModelSelect.options).find(opt => opt.value === 'custom');
            if (!customOption) {
                customOption = new Option('Custom TTS Model', 'custom');
                ttsModelSelect.add(customOption);
            }
            ttsModelSelect.value = 'custom';
            this.showCustomTTSModelInfo(this.config.tts.customModelPath);
        } else {
            ttsModelSelect.value = 'custom'; // Always require custom model
        }

        // Timeouts
        const listenTimeout = document.getElementById('listen-timeout');
        const inactivityTimeout = document.getElementById('inactivity-timeout');
        
        listenTimeout.value = this.config.timeouts.listen || 5;
        document.getElementById('listen-timeout-value').textContent = listenTimeout.value;
        
        inactivityTimeout.value = this.config.timeouts.inactivity || 30;
        document.getElementById('inactivity-timeout-value').textContent = inactivityTimeout.value;
    }

    async saveConfig() {
        try {
            this.showLoading('Saving configuration...');

            // Collect form data
            this.config.picovoice.accessKey = document.getElementById('picovoice-key').value.trim();
            
            const modelPath = document.getElementById('model-path').value;
            if (modelPath === 'custom') {
                // Keep existing custom path
                this.config.model.path = 'custom';
            } else {
                this.config.model.path = modelPath;
                this.config.model.customPath = '';
            }

            this.config.tts.engine = document.getElementById('tts-engine').value;
            
            const ttsModelPath = document.getElementById('tts-model').value;
            if (ttsModelPath === 'custom') {
                // Keep existing custom TTS path
                this.config.tts.model = 'custom';
            } else {
                this.config.tts.model = ttsModelPath;
                this.config.tts.customModelPath = '';
            }
            this.config.timeouts.listen = parseInt(document.getElementById('listen-timeout').value);
            this.config.timeouts.inactivity = parseInt(document.getElementById('inactivity-timeout').value);

            // Validate configuration
            if (!this.config.picovoice.accessKey) {
                throw new Error('PicoVoice access key is required');
            }

            if (!this.config.model.path) {
                throw new Error('Model selection is required');
            }

            // Send to server
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.config)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save configuration');
            }

            this.showStatus('Configuration saved successfully!', 'success');
        } catch (error) {
            this.showStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async testConfig() {
        try {
            this.showLoading('Testing configuration...');

            // Test PicoVoice API key format
            const apiKey = this.config.picovoice.accessKey || document.getElementById('picovoice-key').value.trim();
            if (!apiKey) {
                throw new Error('PicoVoice access key is required');
            }

            // Test AI model availability
            const modelPath = this.config.model.path;
            if (!modelPath) {
                throw new Error('AI model file is required');
            }

            // Test TTS model availability
            const ttsModelPath = this.config.tts.model;
            if (!ttsModelPath) {
                throw new Error('TTS model file is required');
            }

            // Test by calling server endpoint
            const response = await fetch('/api/test-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    picovoiceAccessKey: apiKey,
                    modelPath: modelPath === 'custom' ? this.config.model.customPath : modelPath,
                    ttsModelPath: ttsModelPath === 'custom' ? this.config.tts.customModelPath : ttsModelPath
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Configuration test failed');
            }

            const result = await response.json();
            this.showStatus('Configuration test passed! All components are working.', 'success');
        } catch (error) {
            this.showStatus(`Test failed: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async resetConfig() {
        if (!confirm('Are you sure you want to reset all configuration to defaults? This cannot be undone.')) {
            return;
        }

        try {
            this.showLoading('Resetting configuration...');
            
            const response = await fetch('/api/config', {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to reset configuration');
            }

            // Reset local config to defaults
            this.config = {
                picovoice: { accessKey: '' },
                model: { path: 'custom', customPath: '' },
                tts: { engine: 'piper', model: 'custom', customModelPath: '' },
                timeouts: { listen: 5, inactivity: 30 }
            };

            this.populateForm();
            document.getElementById('model-info').style.display = 'none';
            document.getElementById('tts-model-info').style.display = 'none';
            
            this.showStatus('Configuration reset to defaults', 'success');
        } catch (error) {
            this.showStatus(`Reset failed: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    browseFiles() {
        document.getElementById('file-input').click();
    }

    browseTTSFiles() {
        document.getElementById('tts-file-input').click();
    }

    handleFileSelection(file) {
        if (!file) return;

        if (!file.name.endsWith('.gguf')) {
            this.showStatus('Please select a GGUF AI model file', 'error');
            return;
        }

        // Update UI
        const modelSelect = document.getElementById('model-path');
        
        // Add custom option if it doesn't exist
        let customOption = Array.from(modelSelect.options).find(opt => opt.value === 'custom');
        if (!customOption) {
            customOption = new Option('Custom Model', 'custom');
            modelSelect.add(customOption);
        }
        
        modelSelect.value = 'custom';
        this.config.model.customPath = file.name;
        this.showCustomModelInfo(file.name);
        
        this.showStatus(`Selected AI model: ${file.name}`, 'info');
    }

    handleTTSFileSelection(file) {
        if (!file) return;

        if (!file.name.endsWith('.onnx')) {
            this.showStatus('Please select an ONNX TTS model file', 'error');
            return;
        }

        // Update UI
        const ttsModelSelect = document.getElementById('tts-model');
        
        // Add custom option if it doesn't exist
        let customOption = Array.from(ttsModelSelect.options).find(opt => opt.value === 'custom');
        if (!customOption) {
            customOption = new Option('Custom TTS Model', 'custom');
            ttsModelSelect.add(customOption);
        }
        
        ttsModelSelect.value = 'custom';
        this.config.tts.customModelPath = file.name;
        this.showCustomTTSModelInfo(file.name);
        
        this.showStatus(`Selected TTS model: ${file.name}`, 'info');
    }

    showCustomModelInfo(filename) {
        const modelInfo = document.getElementById('model-info');
        const selectedFile = document.getElementById('selected-file');
        
        selectedFile.textContent = filename;
        modelInfo.style.display = 'block';
    }

    showCustomTTSModelInfo(filename) {
        const ttsModelInfo = document.getElementById('tts-model-info');
        const selectedTTSFile = document.getElementById('selected-tts-file');
        
        selectedTTSFile.textContent = filename;
        ttsModelInfo.style.display = 'block';
    }

    togglePassword(fieldId) {
        const field = document.getElementById(fieldId);
        const icon = field.nextElementSibling.querySelector('.icon');
        
        if (field.type === 'password') {
            field.type = 'text';
            icon.textContent = '🙈';
        } else {
            field.type = 'password';
            icon.textContent = '👁️';
        }
    }

    showStatus(message, type = 'info') {
        const statusContainer = document.getElementById('status-container');
        const statusMessage = document.getElementById('status-message');
        
        // Remove any existing classes
        statusMessage.className = 'status-message';
        
        // Set message and type
        statusMessage.textContent = message;
        statusMessage.classList.add(type, 'show');
        
        // Auto-hide after 5 seconds for success/info
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                statusMessage.classList.remove('show');
            }, 5000);
        }
        
        // Auto-hide after 10 seconds for warning/error
        if (type === 'warning' || type === 'error') {
            setTimeout(() => {
                statusMessage.classList.remove('show');
            }, 10000);
        }
    }

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = overlay.querySelector('p');
        text.textContent = message;
        overlay.style.display = 'flex';
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = 'none';
    }
}

// Global functions for inline event handlers
window.togglePassword = function(fieldId) {
    window.configManager.togglePassword(fieldId);
};

window.browseFiles = function() {
    window.configManager.browseFiles();
};

window.browseTTSFiles = function() {
    window.configManager.browseTTSFiles();
};

window.testConfig = function() {
    window.configManager.testConfig();
};

window.resetConfig = function() {
    window.configManager.resetConfig();
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.configManager = new ConfigurationManager();
});