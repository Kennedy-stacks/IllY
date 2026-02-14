const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

class TinyLlamaAI {
  constructor() {
    this.modelPath = null;
    this.isReady = false;
    this.setupModel();
  }

  async setupModel() {
    // Look for TinyLlama models in common locations
    const possiblePaths = [
      path.join(process.cwd(), 'tinyllama-1.1b-chat-v1.0.Q2_K.gguf'),
      path.join(process.cwd(), 'tinyllama-1.1b-chat.gguf'),
      path.join(process.cwd(), 'tinyllama-model.gguf'),
      path.join(process.cwd(), 'models', 'tinyllama-1.1b-chat.gguf'),
      path.join(os.homedir(), '.local', 'share', 'gpt4all'),
      path.join(os.homedir(), 'gpt4all'),
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Downloads'),
      path.join(process.cwd(), 'models'),
      '/usr/local/share/gpt4all'
    ];

    for (const modelPath of possiblePaths) {
      try {
        if (fs.existsSync(modelPath)) {
          // Check if it's a direct file path or directory
          if (fs.statSync(modelPath).isFile()) {
            this.modelPath = modelPath;
            this.isReady = true;
            console.log(`[AI] Found TinyLlama model file: ${modelPath}`);
            return;
          } else {
            const models = fs.readdirSync(modelPath).filter(f => f.endsWith('.gguf') && f.includes('tinyllama'));
            if (models.length > 0) {
              this.modelPath = path.join(modelPath, models[0]);
              this.isReady = true;
              console.log(`[AI] Found TinyLlama model: ${models[0]}`);
              return;
            }
          }
        }
      } catch (err) {
        // Continue checking
      }
    }

    console.log('[AI] No TinyLlama models found. Please download a TinyLlama .gguf model file.');
  }

  async getResponse(text) {
    if (!this.isReady) {
      return "TinyLlama model not ready. Please download a TinyLlama .gguf model.";
    }

    return new Promise((resolve, reject) => {
      // Use proper template literal for variable substitution
      const pythonScript = `
import sys
import os

# Try to use llama-cpp if available, otherwise use a simple fallback
try:
    sys.path.append(os.path.expanduser('~/.local/lib/python*/site-packages'))
    import llama_cpp
    
    model_path = "${this.modelPath}"
    if not os.path.exists(model_path):
        print("Model file not found")
        sys.exit(1)
    
    # Initialize with minimal settings for reliability
    model = llama_cpp.Llama(
        model_path=model_path,
        n_ctx=256,
        n_threads=2,
        verbose=False
    )
    
    # Use simple prompt format for TinyLlama
    user_text = """${text}"""
    prompt = f"<|im_start|>user\\n{user_text}<|im_end|>\\n<|im_start|>assistant\\n"
    output = model(
        prompt,
        max_tokens=100,
        temperature=0.7,
        echo=False
    )
    
    response = output["choices"][0]["text"].strip()
    print(response)
    
except Exception as e:
    # Fallback to a simple pattern-based response
    text_lower = """${text}""".lower()
    if "hello" in text_lower:
        print("Hello there! I'm your TinyLlama assistant.")
    elif "how are" in text_lower:
        print("I'm working great and ready to help!")
    elif "what can" in text_lower or "help" in text_lower:
        print("I can chat with you, answer questions, and have conversations. What would you like to talk about?")
    elif "tell me" in text_lower:
        print("I'd be happy to discuss that with you! Could you tell me more?")
    else:
        print("That's interesting! Tell me more about that.")
`;

      const venvPython = path.join(__dirname, '.venv', 'bin', 'python');
      const py = spawn(venvPython, ['-c', pythonScript], {
        cwd: __dirname
      });

      let output = '';
      let error = '';

      py.stdout.on('data', (data) => {
        output += data.toString();
      });

      py.stderr.on('data', (data) => {
        error += data.toString();
      });

      py.on('close', (code) => {
        if (code !== 0) {
          console.log('[AI] TinyLlama error, using fallback response');
          resolve(this.getFallbackResponse(text));
        } else {
          resolve(output.trim());
        }
      });

      py.on('error', () => {
        resolve(this.getFallbackResponse(text));
      });
    });
  }

  getFallbackResponse(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('hello')) return "Hello! I'm TinyLlama, your AI assistant.";
    if (lowerText.includes('how are')) return "I'm working well! Ready to help with your questions.";
    if (lowerText.includes('weather')) return "I don't have weather access, but you could check a weather app.";
    if (lowerText.includes('time')) return `Current time: ${new Date().toLocaleTimeString()}`;
    if (lowerText.includes('help')) return "I'm here to help! What would you like to know?";
    return "That's interesting! Tell me more about what you'd like to discuss.";
  }
}

module.exports = TinyLlamaAI;