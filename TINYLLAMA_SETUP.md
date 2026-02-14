# TinyLlama Setup Instructions

## Installing Dependencies

First, install the required Python packages:

```bash
pip install -r requirements.txt
```

## Downloading TinyLlama Model

Your project needs a TinyLlama model file in GGUF format. Here are the steps:

### Option 1: Download from Hugging Face (Recommended)

```bash
# Create a models directory if it doesn't exist
mkdir -p models

# Download TinyLlama 1.1B Chat model (GGUF format)
wget https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat.Q4_K_M.gguf -O models/tinyllama-1.1b-chat.gguf
```

### Option 2: Manual Download

1. Visit: https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF
2. Download any `.gguf` file (Q4_K_M is recommended for good balance of speed/quality)
3. Place the model file in one of these locations:
   - `tinyllama-1.1b-chat.gguf` (project root)
   - `models/tinyllama-1.1b-chat.gguf`
   - `~/.local/share/gpt4all/`

### Option 3: Use Existing Model

If you already have a TinyLlama GGUF model, just place it in one of the locations above.

## Testing the Integration

Once you have the model file, run:

```bash
npm start
```

Say "Hey Illy" and then ask a question. The system will:
1. Transcribe your speech using Vosk
2. Send the text to TinyLlama
3. Display and speak the response

## Model Settings

The integration uses these optimized settings for TinyLlama:
- Context window: 512 tokens
- CPU threads: 4 (adjust based on your system)
- Max response length: 150 tokens
- Temperature: 0.7 (balanced creativity)

## Troubleshooting

**Model not found error:**
- Ensure the `.gguf` file is in the correct location
- Check that the file includes "tinyllama" in the name

**Performance issues:**
- Try a smaller quantized model (Q3_K_M)
- Adjust `n_threads` in the Python script based on your CPU cores

**Memory errors:**
- TinyLlama 1.1B requires ~1GB RAM
- Close other applications if needed