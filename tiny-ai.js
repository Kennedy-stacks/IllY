class TinyAI {
  constructor() {
    this.responses = [
      "I hear you!",
      "Interesting! Tell me more.",
      "That sounds great!",
      "How can I help with that?",
      "Got it! What else?",
      "Sure thing!",
      "I understand!",
      "That makes sense!",
      "Cool! What's on your mind?",
      "Absolutely!"
    ];
  }

  getResponse(text) {
    // Simple keyword-based responses
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('hello') || lowerText.includes('hi')) {
      return "Hello there! How can I help you today?";
    }
    if (lowerText.includes('how are you')) {
      return "I'm doing great, thanks for asking!";
    }
    if (lowerText.includes('thank')) {
      return "You're welcome!";
    }
    if (lowerText.includes('bye') || lowerText.includes('goodbye')) {
      return "Goodbye! Have a great day!";
    }
    if (lowerText.includes('weather')) {
      return "I can't check weather yet, but you could check a weather app!";
    }
    if (lowerText.includes('time')) {
      return `The current time is ${new Date().toLocaleTimeString()}`;
    }
    if (lowerText.includes('help')) {
      return "I'm here to help! Just tell me what you need.";
    }
    if (lowerText.includes('joke')) {
      return "Why don't scientists trust atoms? Because they make up everything!";
    }
    if (lowerText.includes('name')) {
      return "I'm IllY, your voice assistant!";
    }
    
    // Default random responses
    return this.responses[Math.floor(Math.random() * this.responses.length)];
  }
}

module.exports = TinyAI;