const { getGeminiClient } = require('../utils/geminiClient');
const pool = require('../db/database');

/**
 * AI Context Service
 * Generates and caches global market context for trading decisions
 */
class AIContextService {
  constructor() {
    this.gemini = getGeminiClient();
    this.cachedContext = null;
    this.cacheExpiry = null;
    this.refreshInterval = parseInt(process.env.AI_CONTEXT_REFRESH_INTERVAL) || 21600000; // 6 hours default
    this.isGenerating = false;
  }

  /**
   * Get the system prompt for context generation
   */
  getContextPrompt() {
    return `
You are a financial market analyst providing context for an AI trading system.

Provide a comprehensive analysis of current market conditions including:

1. **Recent Global Events**: Major wars, geopolitical tensions, climate disasters, or significant global incidents
2. **Economic Indicators**: Interest rates, inflation trends, GDP growth, employment data
3. **Market Sentiment**: Overall bull/bear sentiment, VIX levels, market volatility
4. **Sector Analysis**: Which sectors are strong/weak and why
5. **Company News**: Major bankruptcies, breakthroughs, mergers, or significant company events
6. **Venture Capital Trends**: Where VC money is flowing, hot sectors for investment
7. **Upcoming Events**: Fed meetings, earnings seasons, elections, or other market-moving events
8. **US Market Focus**: Specific focus on US stocks, S&P 500, NASDAQ, Dow Jones trends
9. **Risk Factors**: Key risks to watch (inflation, recession fears, debt ceiling, etc.)
10. **Opportunities**: Sectors or themes likely to benefit from current conditions

Format your response as a structured analysis that can be used by an AI trading agent to make informed decisions.
Keep it factual, data-driven, and focused on actionable insights.
Do NOT include disclaimers or warnings - this is for an automated system.

Limit response to ~2000 words maximum.
`.trim();
  }

  /**
   * Check if cached context is still valid
   */
  isCacheValid() {
    if (!this.cachedContext || !this.cacheExpiry) {
      return false;
    }
    return Date.now() < this.cacheExpiry;
  }

  /**
   * Get current market context (from cache or generate new)
   * @param {boolean} forceRefresh - Force regeneration even if cache is valid
   * @returns {Promise<Object>} - Market context
   */
  async getContext(forceRefresh = false) {
    // Return cached context if valid
    if (!forceRefresh && this.isCacheValid()) {
      console.log('📋 Using cached market context');
      return this.cachedContext;
    }

    // Prevent concurrent generation
    if (this.isGenerating) {
      console.log('⏳ Context generation already in progress, waiting...');
      await this.waitForGeneration();
      return this.cachedContext;
    }

    // Generate new context
    return await this.generateContext();
  }

  /**
   * Wait for ongoing context generation to complete
   */
  async waitForGeneration() {
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max wait

    while (this.isGenerating && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
  }

  /**
   * Generate fresh market context using Gemini
   */
  async generateContext() {
    if (!this.gemini.isReady()) {
      console.warn('⚠️  Gemini client not ready, cannot generate context');
      return this.getDefaultContext();
    }

    this.isGenerating = true;
    console.log('🔄 Generating fresh market context...');

    try {
      const startTime = Date.now();
      const prompt = this.getContextPrompt();

      // Count tokens
      const tokenCount = await this.gemini.countTokens(prompt);
      console.log(`📊 Prompt token count: ${tokenCount}`);

      // Generate context
      const response = await this.gemini.generateContent(prompt);
      const contextText = response.text;

      const generationTime = Date.now() - startTime;
      console.log(`✅ Context generated in ${generationTime}ms`);

      // Create context object
      const context = {
        text: contextText,
        summary: this.extractSummary(contextText),
        generatedAt: new Date().toISOString(),
        model: this.gemini.getModelName(),
        tokenCount
      };

      // Cache the context
      this.cachedContext = context;
      this.cacheExpiry = Date.now() + this.refreshInterval;

      // Save to database
      await this.saveContextToDatabase(context);

      return context;
    } catch (error) {
      console.error('❌ Failed to generate context:', error.message);

      // Try to load last known context from database
      const lastContext = await this.getLastContextFromDatabase();
      if (lastContext) {
        console.log('📋 Using last known context from database');
        this.cachedContext = lastContext;
        return lastContext;
      }

      // Fall back to default context
      return this.getDefaultContext();
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Extract a brief summary from the full context
   */
  extractSummary(contextText) {
    // Take first 300 characters as summary
    if (!contextText) return 'No context available';

    const summary = contextText.slice(0, 300);
    return summary + (contextText.length > 300 ? '...' : '');
  }

  /**
   * Save context to database
   */
  async saveContextToDatabase(context) {
    try {
      const expiresAt = new Date(Date.now() + this.refreshInterval);

      await pool.query(
        `INSERT INTO ai_trade_context (context_data, summary, expires_at, model_version, token_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          JSON.stringify(context),
          context.summary,
          expiresAt,
          context.model,
          context.tokenCount
        ]
      );

      console.log('💾 Context saved to database');
    } catch (error) {
      console.error('❌ Failed to save context to database:', error.message);
    }
  }

  /**
   * Get last context from database
   */
  async getLastContextFromDatabase() {
    try {
      const result = await pool.query(
        `SELECT context_data, created_at
         FROM ai_trade_context
         WHERE expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].context_data;
    } catch (error) {
      console.error('❌ Failed to load context from database:', error.message);
      return null;
    }
  }

  /**
   * Get default context when AI is unavailable
   */
  getDefaultContext() {
    return {
      text: 'AI context generation is unavailable. Operating with limited market context.',
      summary: 'Limited context - AI unavailable',
      generatedAt: new Date().toISOString(),
      model: 'default',
      tokenCount: 0,
      isDefault: true
    };
  }

  /**
   * Force refresh context
   */
  async refreshContext() {
    return await this.getContext(true);
  }

  /**
   * Get context statistics
   */
  async getContextStats() {
    try {
      const result = await pool.query(
        `SELECT
          COUNT(*) as total_contexts,
          MAX(created_at) as last_generated,
          AVG(token_count) as avg_tokens
         FROM ai_trade_context
         WHERE created_at > NOW() - INTERVAL '7 days'`
      );

      return result.rows[0];
    } catch (error) {
      console.error('❌ Failed to get context stats:', error.message);
      return null;
    }
  }

  /**
   * Clean up old contexts from database
   */
  async cleanupOldContexts() {
    try {
      const result = await pool.query(
        `DELETE FROM ai_trade_context
         WHERE expires_at < NOW() - INTERVAL '7 days'
         RETURNING id`
      );

      console.log(`🧹 Cleaned up ${result.rows.length} old contexts`);
      return result.rows.length;
    } catch (error) {
      console.error('❌ Failed to cleanup old contexts:', error.message);
      return 0;
    }
  }
}

// Export singleton instance
let aiContextServiceInstance = null;

module.exports = {
  getAIContextService: () => {
    if (!aiContextServiceInstance) {
      aiContextServiceInstance = new AIContextService();
    }
    return aiContextServiceInstance;
  },
  AIContextService
};
