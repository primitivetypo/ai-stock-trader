const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Gemini AI Client Wrapper
 * Provides a singleton instance for interacting with Google's Gemini AI
 */
class GeminiClient {
  constructor() {
    this.client = null;
    this.model = null;
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

    if (!this.apiKey || this.apiKey === 'your_google_genai_api_key_here') {
      console.warn('⚠️  Gemini API key not configured. AI trading features will be disabled.');
      console.warn('   Add GEMINI_API_KEY to your .env file to enable AI features.');
      return;
    }

    this.initialize();
  }

  /**
   * Initialize the Gemini client
   */
  initialize() {
    try {
      this.client = new GoogleGenerativeAI(this.apiKey);
      this.model = this.client.getGenerativeModel({ model: this.modelName });
      console.log(`✅ Gemini AI client initialized with model: ${this.modelName}`);
    } catch (error) {
      console.error('❌ Failed to initialize Gemini client:', error.message);
      this.client = null;
      this.model = null;
    }
  }

  /**
   * Check if the client is ready
   */
  isReady() {
    return this.client !== null && this.model !== null;
  }

  /**
   * Generate content using Gemini
   * @param {string} prompt - The prompt to send to Gemini
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Response from Gemini
   */
  async generateContent(prompt, options = {}) {
    if (!this.isReady()) {
      throw new Error('Gemini client is not initialized. Check your API key configuration.');
    }

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...options
      });

      const response = await result.response;
      return {
        text: response.text(),
        raw: response
      };
    } catch (error) {
      console.error('❌ Gemini API error:', error.message);
      throw error;
    }
  }

  /**
   * Generate content with function calling support
   * @param {string} prompt - The prompt to send
   * @param {Array} tools - Function declarations for tool calling
   * @param {Object} config - Generation config
   * @returns {Promise<Object>} - Response from Gemini
   */
  async generateContentWithTools(prompt, tools = [], config = {}) {
    if (!this.isReady()) {
      throw new Error('Gemini client is not initialized. Check your API key configuration.');
    }

    try {
      const generationConfig = {
        ...config,
        temperature: config.temperature || 0.7,
        topP: config.topP || 0.95,
        maxOutputTokens: config.maxOutputTokens || 8192,
      };

      const modelWithTools = this.client.getGenerativeModel({
        model: this.modelName,
        tools: tools.length > 0 ? tools : undefined,
        generationConfig
      });

      const result = await modelWithTools.generateContent(prompt);
      const response = await result.response;

      // Check if response has function calls
      const functionCalls = [];
      if (response.functionCalls) {
        response.functionCalls().forEach(fc => {
          functionCalls.push({
            name: fc.name,
            args: fc.args
          });
        });
      }

      return {
        text: response.text ? response.text() : null,
        functionCalls,
        raw: response
      };
    } catch (error) {
      console.error('❌ Gemini function calling error:', error.message);
      throw error;
    }
  }

  /**
   * Start a chat session
   * @param {Object} options - Chat options including history
   * @returns {Object} - Chat session
   */
  startChat(options = {}) {
    if (!this.isReady()) {
      throw new Error('Gemini client is not initialized. Check your API key configuration.');
    }

    return this.model.startChat(options);
  }

  /**
   * Count tokens in a prompt
   * @param {string} prompt - The prompt to count tokens for
   * @returns {Promise<number>} - Token count
   */
  async countTokens(prompt) {
    if (!this.isReady()) {
      throw new Error('Gemini client is not initialized. Check your API key configuration.');
    }

    try {
      const result = await this.model.countTokens(prompt);
      return result.totalTokens;
    } catch (error) {
      console.error('❌ Token counting error:', error.message);
      throw error;
    }
  }

  /**
   * Get the current model name
   */
  getModelName() {
    return this.modelName;
  }
}

// Export singleton instance
let geminiClientInstance = null;

module.exports = {
  getGeminiClient: () => {
    if (!geminiClientInstance) {
      geminiClientInstance = new GeminiClient();
    }
    return geminiClientInstance;
  },
  GeminiClient
};
