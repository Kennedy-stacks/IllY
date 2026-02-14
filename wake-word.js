const { Porcupine } = require("@picovoice/porcupine-node");
const { PvRecorder } = require("@picovoice/pvrecorder-node");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const http = require("http");
const TinyLlamaAI = require("./gpt4all-ai");

const ACCESS_KEY = process.env.PICOVOICE_ACCESS_KEY;
const WAKE_WORD_PATH = path.join(__dirname, "Hey-Illy_en_linux_v4_0_0.ppn");
const VOSK_MODEL_PATH = path.join(__dirname, "vosk-model-en-us-0.22-lgraph");
const STT_SCRIPT_PATH = path.join(__dirname, "stt-vosk.py");
const NEU_BINARY_PATH = path.join(__dirname, "dist", "IllY", "IllY-linux_x64");

let neutralinoStarted = false;
let neutralinoProcess = null;
let neutralinoPort = null;
let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 30000; // 30 seconds
const ai = new TinyLlamaAI();

function startNeutralinoOnce() {
  // Reset the inactivity timer whenever we show the window
  resetInactivityTimer();
  
  if (neutralinoStarted && neutralinoProcess && !neutralinoProcess.killed) {
    // Window is already running, just bring it to front
    console.log("[NEU] Neutralino window already running");
    return;
  }
  
  try {
    neutralinoProcess = spawn(NEU_BINARY_PATH, [], {
      detached: true,
      stdio: "ignore",
    });
    neutralinoProcess.unref();
    neutralinoStarted = true;
    console.log("[NEU] Launched Neutralino window");
    
    // Start transcription server if not already running
    startTranscriptionServer();
    
    // Monitor the process
    neutralinoProcess.on('exit', () => {
      neutralinoStarted = false;
      neutralinoProcess = null;
      console.log("[NEU] Neutralino window closed");
    });
    
    // Try to find the port after a short delay
    setTimeout(() => {
      findNeutralinoPort();
    }, 2000);
  } catch (err) {
    console.error("[NEU] Failed to launch Neutralino:", err.message);
  }
}

function resetInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  
  inactivityTimer = setTimeout(() => {
    closeNeutralinoWindow();
  }, INACTIVITY_TIMEOUT);
}

function closeNeutralinoWindow() {
  if (neutralinoProcess && !neutralinoProcess.killed) {
    console.log("[NEU] Closing Neutralino window due to inactivity");
    neutralinoProcess.kill('SIGTERM');
    neutralinoStarted = false;
    neutralinoProcess = null;
  }
}

function findNeutralinoPort() {
  // Try common ports that Neutralino might use
  const commonPorts = [3000, 8000, 8080, 9000, 5000];
  
  for (const port of commonPorts) {
    try {
      const options = {
        hostname: 'localhost',
        port: port,
        path: '/__neutralino_globals__',
        method: 'GET',
        timeout: 1000
      };
      
      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          neutralinoPort = port;
          console.log(`[NEU] Found Neutralino on port ${port}`);
        }
      });
      
      req.on('error', () => {});
      req.on('timeout', () => req.destroy());
      req.end();
    } catch (err) {
      // Continue to next port
    }
  }
}

// Set up a simple HTTP server to handle transcription updates
let server = null;
let lastTranscription = '';
let lastTranscriptionTime = 0;
const appPort = 3456;

function startTranscriptionServer() {
  if (server) return;
  
  server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    if (req.method === 'GET' && req.url === '/transcription') {
      // Serve the latest transcription to the Neutralino window
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: lastTranscription, timestamp: lastTranscriptionTime }));
    } else if (req.method === 'POST' && req.url === '/transcription') {
      // Handle POST requests (though we'll mainly use GET)
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.text) {
            console.log("[NEU] Received transcription:", data.text);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No text provided' }));
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  
  server.listen(appPort, () => {
    console.log(`[NEU] Transcription server running on port ${appPort}`);
  });
}

function sendTranscriptionToNeutralino(text) {
  lastTranscription = text;
  lastTranscriptionTime = Date.now();
  console.log("[NEU] Transcription stored:", text);
}

/** How long to record after "Hey Illy" before transcribing (seconds). */
const LISTEN_SECONDS = 5;

/**
 * Run Vosk via Python subprocess on a raw PCM file (16 kHz, 16-bit mono).
 * Returns the transcript string.
 */
function transcribeWithVosk(pcmPath, onPartial) {
  return new Promise((resolve, reject) => {
    const py = spawn("python3", [STT_SCRIPT_PATH, VOSK_MODEL_PATH, pcmPath], {
      cwd: __dirname,
    });

    let finalText = "";

    py.stdout.on("data", (d) => {
      const lines = d.toString().split(/\r?\n/).filter(Boolean);

      for (const line of lines) {
        console.log("[STT]", line);

        if (line.startsWith("PARTIAL ")) {
          const txt = line.slice("PARTIAL ".length);
          if (onPartial) onPartial(txt);
        } else if (line.startsWith("FINAL ")) {
          const txt = line.slice("FINAL ".length);
          finalText = txt;
          if (onPartial) onPartial(txt);
        }
      }
    });

    let stderr = "";
    py.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    py.on("error", (err) => reject(err));

    py.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `stt-vosk.py exited ${code}`));
        return;
      }
      resolve(finalText.trim());
    });
  });
}

async function main() {
  let porcupine = null;
  let recorder = null;

  try {
    porcupine = new Porcupine(ACCESS_KEY, [WAKE_WORD_PATH], [0.5]);
    const frameLength = porcupine.frameLength;

    recorder = new PvRecorder(frameLength);
    console.log(`Using device: ${recorder.getSelectedDevice()}`);
    console.log(`Listening for "Hey Illy"... then say something (${LISTEN_SECONDS}s). (Ctrl+C to exit)\n`);

    recorder.start();

    while (true) {
      const pcm = await recorder.read();
      const index = porcupine.process(pcm);

      if (index !== -1) {
        startNeutralinoOnce();
        console.log("Hey Illy! Listening...");
        const chunks = [];
        const deadline = Date.now() + LISTEN_SECONDS * 1000;

        while (Date.now() < deadline) {
          const frame = await recorder.read();
          chunks.push(Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength));
        }

        const pcmPath = path.join(os.tmpdir(), `illy-stt-${Date.now()}.pcm`);
        fs.writeFileSync(pcmPath, Buffer.concat(chunks));
        try {
          const text = await transcribeWithVosk(pcmPath, (partial) => {
            console.log(">>", partial);
            sendTranscriptionToNeutralino(partial);
            resetInactivityTimer(); // Reset timer on any speech activity
          });
          if (text) {
            console.log("You said:", text);
            sendTranscriptionToNeutralino(text);
            resetInactivityTimer(); // Reset timer on final transcription
            
            // Get AI response
            setTimeout(async () => {
              try {
                const aiResponse = await ai.getResponse(text);
                console.log("AI Response:", aiResponse);
                sendTranscriptionToNeutralino(aiResponse);
                // Speak the response using Piper TTS
                const { spawn } = require('child_process');
                const piper = spawn('/home/illy/Documents/CODE/IllY/IllY/.venv/bin/piper', ['--model', '/home/illy/Documents/CODE/IllY/IllY/en_US-amy-medium.onnx', '--output_file', '/tmp/response.wav'], {
                  stdio: ['pipe', 'ignore', 'ignore']
                });
                piper.stdin.write(aiResponse);
                piper.stdin.end();
                
                piper.on('close', () => {
                  // Play the generated audio
                  spawn('aplay', ['/tmp/response.wav'], { stdio: 'ignore' }).unref();
                });
              } catch (error) {
                console.error("AI Error:", error);
                sendTranscriptionToNeutralino("Sorry, I had trouble processing that.");
                
                // Speak error message using Piper TTS
                const { spawn } = require('child_process');
                const errorMessage = "Sorry, I had trouble processing that.";
                const piperError = spawn('/home/illy/Documents/CODE/IllY/IllY/.venv/bin/piper', ['--model', '/home/illy/Documents/CODE/IllY/IllY/en_US-amy-medium.onnx', '--output_file', '/tmp/error.wav'], {
                  stdio: ['pipe', 'ignore', 'ignore']
                });
                piperError.stdin.write(errorMessage);
                piperError.stdin.end();
                
                piperError.on('close', () => {
                  spawn('aplay', ['/tmp/error.wav'], { stdio: 'ignore' }).unref();
                });
              }
            }, 1000);
          } else {
            console.log("(no speech detected)");
          }
        } finally {
          try { fs.unlinkSync(pcmPath); } catch (_) {}
        }
        console.log("");
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    if (recorder) {
      recorder.stop();
      recorder.release();
    }
    if (porcupine) {
      porcupine.release();
    }
  }
}

process.on("SIGINT", () => {
  console.log("\nStopping...");
  process.exit(0);
});

main();
