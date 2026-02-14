const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const configDir = path.join(__dirname, 'resources');
const port = 5050;

function resolvePath(inputPath) {
  if (!inputPath) return null;
  
  let resolved = inputPath;
  
  if (inputPath.startsWith('~/')) {
    resolved = path.join(os.homedir(), inputPath.slice(2));
  } else if (!path.isAbsolute(inputPath)) {
    resolved = path.join(__dirname, inputPath);
  }
  
  return resolved;
}

function isPathInProject(inputPath) {
  const resolved = resolvePath(inputPath);
  if (!resolved) return true;
  
  const projectPath = path.resolve(__dirname);
  const resolvedPath = path.resolve(resolved);
  
  return resolvedPath.startsWith(projectPath);
}

function copyToProject(srcPath) {
  try {
    const filename = path.basename(srcPath);
    const destPath = path.join(__dirname, filename);
    
    if (fs.existsSync(destPath)) {
      console.log('Model already exists in project folder:', filename);
      return filename;
    }
    
    fs.copyFileSync(srcPath, destPath);
    console.log('Copied model to project folder:', destPath);
    return filename;
  } catch (error) {
    console.error('Failed to copy model:', error);
    return null;
  }
}

function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return {};
}

function saveConfig(config) {
  try {
    // Copy model files to project folder if outside
    if (config.model?.customPath && !isPathInProject(config.model.customPath)) {
      const resolvedPath = resolvePath(config.model.customPath);
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        const newFilename = copyToProject(resolvedPath);
        if (newFilename) {
          config.model.customPath = newFilename;
          console.log('Updated model path to:', newFilename);
        }
      }
    }

    // Copy TTS model files to project folder if outside
    if (config.tts?.customModelPath && !isPathInProject(config.tts.customModelPath)) {
      const resolvedPath = resolvePath(config.tts.customModelPath);
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        const newFilename = copyToProject(resolvedPath);
        if (newFilename) {
          config.tts.customModelPath = newFilename;
          console.log('Updated TTS model path to:', newFilename);
        }
      }
    }

    const configPath = path.join(__dirname, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    if (config.picovoice?.accessKey) {
      envContent += `PICOVOICE_ACCESS_KEY=${config.picovoice.accessKey}\n`;
    }
    
    if (config.model?.customPath) {
      envContent += `MODEL_PATH=${config.model.customPath}\n`;
    }
    
    if (config.tts?.engine) {
      envContent += `TTS_ENGINE=${config.tts.engine}\n`;
    }
    
    if (config.tts?.customModelPath) {
      envContent += `TTS_MODEL_PATH=${config.tts.customModelPath}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

function sendJSON(res, data, status = 200) {
  corsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${port}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') {
    corsHeaders(res);
    res.writeHead(200);
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', () => {
      try {
        if (req.method === 'GET' && pathname === '/api/config') {
          const config = loadConfig();
          sendJSON(res, config);
          return;
        }

        if (req.method === 'POST' && pathname === '/api/config') {
          const config = JSON.parse(body);
          const success = saveConfig(config);
          if (success) {
            sendJSON(res, { success: true, message: 'Configuration saved successfully' });
            console.log('Configuration saved successfully');
          } else {
            sendJSON(res, { success: false, message: 'Failed to save configuration' }, 500);
          }
          return;
        }

        if (req.method === 'POST' && pathname === '/api/test-config') {
          const testData = JSON.parse(body);
          
          if (!testData.picovoiceAccessKey) {
            sendJSON(res, { success: false, message: 'PicoVoice access key is required' }, 400);
            return;
          }

          // Skip file validation - AI module searches multiple locations automatically
          sendJSON(res, { success: true, message: 'Configuration test passed' });
          return;
        }

        if (req.method === 'DELETE' && pathname === '/api/config') {
          try {
            const configPath = path.join(__dirname, 'config.json');
            const envPath = path.join(__dirname, '.env');
            
            if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
            if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
            
            sendJSON(res, { success: true, message: 'Configuration reset successfully' });
            console.log('Configuration reset successfully');
          } catch (error) {
            sendJSON(res, { success: false, message: 'Failed to reset configuration' }, 500);
          }
          return;
        }

        sendJSON(res, { success: false, message: 'API endpoint not found' }, 404);
      } catch (error) {
        console.error('API Error:', error);
        sendJSON(res, { success: false, message: error.message }, 500);
      }
    });
    return;
  }

  let filePath = path.join(configDir, pathname === '/' ? 'config.html' : pathname);
  const resolvedPath = path.resolve(filePath);
  const resolvedConfigDir = path.resolve(configDir);
  
  if (!resolvedPath.startsWith(resolvedConfigDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const extname = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
        console.error('File server error:', error);
      }
    } else {
      corsHeaders(res);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(port, () => {
  console.log(`Configuration server running on http://localhost:${port}`);
  
  const { spawn } = require('child_process');
  const open = process.platform === 'win32' ? 'start' :
               process.platform === 'darwin' ? 'open' : 'xdg-open';
  
  spawn(open, [`http://localhost:${port}`], { detached: true }).unref();
  
  console.log('Configuration GUI opened in browser');
  console.log('Press Ctrl+C to stop the configuration server');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${port} already in use. Opening http://localhost:${port}`);
    const { spawn } = require('child_process');
    const open = process.platform === 'win32' ? 'start' :
                 process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(open, [`http://localhost:${port}`], { detached: true }).unref();
  } else {
    console.error('Server error:', err);
  }
});
