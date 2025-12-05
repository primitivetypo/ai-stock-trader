const { getGeminiClient } = require('../utils/geminiClient');
const { getAIContextService } = require('./aiContextService');
const pool = require('../db/database');
const alpaca = require('../services/alpacaService');

/**
 * AI Trade Agent Service
 * Uses Gemini with function calling to analyze news and make trading decisions
 */
class AITradeAgentService {
  constructor() {
    this.gemini = getGeminiClient();
    this.contextService = getAIContextService();
    this.maxNewsPerHour = parseInt(process.env.AI_MAX_NEWS_PER_HOUR) || 50;
    this.maxNewsPerMinute = parseInt(process.env.AI_MAX_NEWS_PER_MINUTE) || 2; // Gemini free tier limit
    this.newsProcessedCount = 0;
    this.newsProcessedThisMinute = 0;
    this.lastResetTime = Date.now();
    this.lastMinuteResetTime = Date.now();
    this.processingQueue = [];
    this.isProcessing = false;
  }

  /**
   * Get system prompt for the trading agent
   */
  getTradeAgentPrompt() {
    return `
You are an expert AI trading agent that analyzes news articles and makes stock trading decisions.

Your objective: Analyze news in real-time and determine if a trading opportunity exists.

Workflow:
1. Get global market context to understand current conditions
2. Analyze the news article provided
3. Get available assets from the bot's watchlist
4. If trading opportunity identified:
   - Get asset's current price
   - Get asset's recent price history
   - Check previous trades for this symbol
   - Calculate appropriate position size, profit target, and stop loss
   - Make the trade
   - Save your reasoning

Important Guidelines:
- Only trade if you have HIGH CONFIDENCE (>70%) in the opportunity
- Trades last 24 hours maximum
- Consider: news impact, market context, price trends, previous trades
- Use tight stop losses (1-3% below entry for buys)
- Set realistic profit targets (2-5% above entry for buys)
- NEVER trade on stale news or rumors
- Avoid trading during high volatility without clear direction
- Quality over quantity - it's OK to skip most news articles

Decision Types:
- BUY: Positive news, bullish sentiment, upward momentum expected
- SELL: Negative news, bearish sentiment, downward pressure expected
- SKIP: Insufficient information, high uncertainty, or low conviction

Function Calling:
Use the provided functions to gather data and execute trades.
Call functions in logical order.
If a function returns an error, handle gracefully and move on.

After analysis, either make a trade OR simply stop (no need to respond with text).
`.trim();
  }

  /**
   * Define function declarations for Gemini function calling
   */
  getFunctionDeclarations() {
    return [
      {
        name: 'get_global_context',
        description: 'Get current global market context including geopolitical events, sector trends, and market sentiment',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_watchlist',
        description: 'Get the list of symbols available for trading in this bot',
        parameters: {
          type: 'object',
          properties: {
            botId: {
              type: 'string',
              description: 'Bot ID'
            }
          },
          required: ['botId']
        }
      },
      {
        name: 'get_asset_price',
        description: 'Get current market price for a symbol',
        parameters: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Stock symbol (e.g., AAPL, TSLA)'
            }
          },
          required: ['symbol']
        }
      },
      {
        name: 'get_asset_history',
        description: 'Get recent price history (last 7 days) for a symbol',
        parameters: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Stock symbol'
            }
          },
          required: ['symbol']
        }
      },
      {
        name: 'get_previous_trades',
        description: 'Get previous trades made by this bot for a specific symbol',
        parameters: {
          type: 'object',
          properties: {
            botId: {
              type: 'string',
              description: 'Bot ID'
            },
            symbol: {
              type: 'string',
              description: 'Stock symbol'
            }
          },
          required: ['botId', 'symbol']
        }
      },
      {
        name: 'make_trade',
        description: 'Execute a trade (buy or sell). Trade will auto-close after 24 hours.',
        parameters: {
          type: 'object',
          properties: {
            botId: {
              type: 'string',
              description: 'Bot ID'
            },
            symbol: {
              type: 'string',
              description: 'Stock symbol to trade'
            },
            side: {
              type: 'string',
              description: 'Trade side: BUY or SELL',
              enum: ['BUY', 'SELL']
            },
            qty: {
              type: 'integer',
              description: 'Number of shares'
            },
            profitTarget: {
              type: 'number',
              description: 'Price to take profit (higher than current for BUY, lower for SELL)'
            },
            stopLoss: {
              type: 'number',
              description: 'Price to stop loss (lower than current for BUY, higher for SELL)'
            }
          },
          required: ['botId', 'symbol', 'side', 'qty', 'profitTarget', 'stopLoss']
        }
      },
      {
        name: 'save_reasoning',
        description: 'Save trading decision reasoning and analysis',
        parameters: {
          type: 'object',
          properties: {
            botId: {
              type: 'string',
              description: 'Bot ID'
            },
            newsArticleId: {
              type: 'integer',
              description: 'News article ID that triggered analysis'
            },
            symbol: {
              type: 'string',
              description: 'Symbol analyzed'
            },
            decision: {
              type: 'string',
              description: 'Decision made: BUY, SELL, or SKIP',
              enum: ['BUY', 'SELL', 'SKIP']
            },
            reasoning: {
              type: 'string',
              description: 'Brief explanation of the decision (max 500 characters)'
            },
            confidence: {
              type: 'number',
              description: 'Confidence score 0-100'
            }
          },
          required: ['botId', 'newsArticleId', 'symbol', 'decision', 'reasoning', 'confidence']
        }
      }
    ];
  }

  /**
   * Process news article for a bot
   * @param {string} botId - Bot ID
   * @param {Object} newsArticle - News article object
   * @param {Function} tradeExecutor - Function to execute trades
   */
  async processNewsForBot(botId, newsArticle, tradeExecutor) {
    // Rate limiting
    if (!this.checkRateLimit()) {
      console.log('⏸️  Rate limit reached, skipping news article');
      return null;
    }

    if (!this.gemini.isReady()) {
      console.warn('⚠️  Gemini not ready, skipping news article');
      return null;
    }

    console.log(`🔍 Processing news for bot ${botId}: "${newsArticle.headline}"`);

    const startTime = Date.now();
    const allFunctionCalls = [];
    let finalResponse = null;
    let tradeDetails = null;

    try {
      // Save news article to database
      const savedArticle = await this.saveNewsArticle(newsArticle);
      const articleId = savedArticle.id;

      // Store trade executor for use in makeTrade
      this.currentTradeExecutor = tradeExecutor;
      this.currentArticleId = articleId;
      this.currentBotId = botId;
      this.currentTradeDetails = null;

      // Create context for the agent
      const agentContext = this.createAgentContext(botId, newsArticle, articleId);
      const systemPrompt = this.getTradeAgentPrompt();

      // Create a Gemini model instance with system instruction and function calling
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const modelName = this.gemini.getModelName();

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }]
        },
        tools: [{
          functionDeclarations: this.getFunctionDeclarations()
        }]
      });

      // Start chat session
      const chat = model.startChat({
        history: []
      });

      // Send the news article
      let result = await chat.sendMessage(agentContext);
      let response = await result.response;

      // Handle function calls iteratively
      let iterations = 0;
      const maxIterations = 20;

      while (iterations < maxIterations) {
        const functionCalls = response.functionCalls?.();

        if (!functionCalls || functionCalls.length === 0) {
          // No more function calls, agent is done
          console.log('✅ Agent completed analysis');
          finalResponse = response.text?.() || '';
          break;
        }

        // Execute ALL function calls and collect responses
        const functionResponses = [];
        for (const functionCall of functionCalls) {
          console.log(`🛠️  Calling function: ${functionCall.name}`);
          const functionResponse = await this.executeFunction(
            functionCall.name,
            functionCall.args,
            botId,
            articleId
          );

          // Log the function call
          allFunctionCalls.push({
            name: functionCall.name,
            args: functionCall.args,
            response: functionResponse
          });

          functionResponses.push({
            functionResponse: {
              name: functionCall.name,
              response: functionResponse
            }
          });
        }

        // Send ALL function responses back to agent at once
        result = await chat.sendMessage(functionResponses);
        response = await result.response;
        iterations++;
      }

      const processingTime = Date.now() - startTime;
      tradeDetails = this.currentTradeDetails;

      // Save to AI analysis log
      await this.saveAnalysisLog({
        botId,
        experimentId: botId.split('-bot-')[0],
        newsArticleId: articleId,
        prompt: `System: ${systemPrompt}\n\nUser: ${agentContext}`,
        newsHeadline: newsArticle.headline,
        newsSummary: newsArticle.summary,
        symbols: newsArticle.symbols,
        modelUsed: modelName,
        functionCalls: allFunctionCalls,
        aiResponse: finalResponse,
        decision: this.lastReasoning?.decision || 'SKIP',
        reasoning: this.lastReasoning?.reasoning || '',
        confidenceScore: this.lastReasoning?.confidence || 0,
        sentiment: this.lastReasoning?.decision === 'BUY' ? 'bullish' : this.lastReasoning?.decision === 'SELL' ? 'bearish' : 'neutral',
        tradeExecuted: !!tradeDetails,
        tradeSymbol: tradeDetails?.symbol,
        tradeSide: tradeDetails?.side,
        tradeQty: tradeDetails?.qty,
        tradePrice: tradeDetails?.price,
        processingTimeMs: processingTime
      });

      // Clean up
      this.currentTradeExecutor = null;
      this.currentArticleId = null;
      this.currentBotId = null;
      this.currentTradeDetails = null;

      // Rate limit counter already incremented in checkRateLimit()
      return { success: true, articleId };

    } catch (error) {
      console.error('❌ Error processing news:', error.message);

      // Still try to save the log even on error
      const processingTime = Date.now() - startTime;
      try {
        await this.saveAnalysisLog({
          botId,
          experimentId: botId.split('-bot-')[0],
          prompt: `Error processing: ${newsArticle.headline}`,
          newsHeadline: newsArticle.headline,
          newsSummary: newsArticle.summary,
          symbols: newsArticle.symbols,
          modelUsed: this.gemini.getModelName(),
          functionCalls: allFunctionCalls,
          aiResponse: `Error: ${error.message}`,
          decision: 'ERROR',
          reasoning: error.message,
          confidenceScore: 0,
          sentiment: 'neutral',
          tradeExecuted: false,
          processingTimeMs: processingTime
        });
      } catch (logError) {
        console.error('Failed to save error log:', logError.message);
      }

      // Clean up on error
      this.currentTradeExecutor = null;
      this.currentArticleId = null;
      this.currentBotId = null;
      this.currentTradeDetails = null;
      return { success: false, error: error.message };
    }
  }

  /**
   * Save analysis log to database
   */
  async saveAnalysisLog(data) {
    try {
      await pool.query(
        `INSERT INTO ai_analysis_log
         (bot_id, experiment_id, news_article_id, prompt, news_headline, news_summary,
          symbols, model_used, function_calls, ai_response, decision, reasoning,
          confidence_score, sentiment, trade_executed, trade_symbol, trade_side,
          trade_qty, trade_price, processing_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          data.botId,
          data.experimentId,
          data.newsArticleId,
          data.prompt,
          data.newsHeadline,
          data.newsSummary,
          data.symbols || [],
          data.modelUsed,
          JSON.stringify(data.functionCalls || []),
          data.aiResponse,
          data.decision,
          data.reasoning,
          data.confidenceScore,
          data.sentiment,
          data.tradeExecuted,
          data.tradeSymbol,
          data.tradeSide,
          data.tradeQty,
          data.tradePrice,
          data.processingTimeMs
        ]
      );
      console.log(`📝 AI Analysis logged for ${data.botId}`);
    } catch (error) {
      console.error('Failed to save analysis log:', error.message);
    }
  }

  /**
   * Create agent context from news article
   */
  createAgentContext(botId, newsArticle, articleId) {
    return `
New Article Received:
- Headline: ${newsArticle.headline}
- Summary: ${newsArticle.summary || 'N/A'}
- Symbols Mentioned: ${newsArticle.symbols?.join(', ') || 'None'}
- Source: ${newsArticle.source || 'Unknown'}
- Published: ${newsArticle.created_at || new Date().toISOString()}

Bot ID: ${botId}
Article ID: ${articleId}

Analyze this news and determine if a trading opportunity exists.
`.trim();
  }

  /**
   * Execute function called by the AI agent
   */
  async executeFunction(functionName, args, botId, articleId) {
    try {
      switch (functionName) {
        case 'get_global_context':
          return await this.getGlobalContext();

        case 'get_watchlist':
          return await this.getWatchlist(botId);

        case 'get_asset_price':
          return await this.getAssetPrice(args.symbol);

        case 'get_asset_history':
          return await this.getAssetHistory(args.symbol);

        case 'get_previous_trades':
          return await this.getPreviousTrades(botId, args.symbol);

        case 'make_trade':
          return await this.makeTrade(botId, args, articleId);

        case 'save_reasoning':
          return await this.saveReasoning(botId, articleId, args);

        default:
          return { error: `Unknown function: ${functionName}` };
      }
    } catch (error) {
      console.error(`❌ Function ${functionName} error:`, error.message);
      return { error: error.message };
    }
  }

  /**
   * Get global market context
   */
  async getGlobalContext() {
    const context = await this.contextService.getContext();
    return {
      summary: context.summary,
      generatedAt: context.generatedAt
    };
  }

  /**
   * Get bot watchlist
   */
  async getWatchlist(botId) {
    const result = await pool.query(
      'SELECT watchlist FROM bots WHERE id = $1',
      [botId]
    );

    if (result.rows.length === 0) {
      return { error: 'Bot not found' };
    }

    return { watchlist: result.rows[0].watchlist || [] };
  }

  /**
   * Get current asset price
   */
  async getAssetPrice(symbol) {
    try {
      const quote = await alpaca.getLatestQuote(symbol);
      return {
        symbol,
        price: quote.ap, // ask price
        bid: quote.bp,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { error: `Failed to get price for ${symbol}` };
    }
  }

  /**
   * Get asset price history
   */
  async getAssetHistory(symbol) {
    try {
      const bars = await alpaca.getBars(symbol, {
        timeframe: '1Day',
        limit: 7
      });

      return {
        symbol,
        bars: bars.map(bar => ({
          time: bar.t,
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v
        }))
      };
    } catch (error) {
      return { error: `Failed to get history for ${symbol}` };
    }
  }

  /**
   * Get previous trades for symbol
   */
  async getPreviousTrades(botId, symbol) {
    const result = await pool.query(
      `SELECT bt.*, atr.reasoning, atr.confidence
       FROM bot_trades bt
       LEFT JOIN ai_trade_reasoning atr ON bt.ai_reasoning_id = atr.id
       WHERE bt.bot_id = $1 AND bt.symbol = $2
       ORDER BY bt.time DESC
       LIMIT 5`,
      [botId, symbol]
    );

    return {
      symbol,
      trades: result.rows.map(trade => ({
        side: trade.side,
        qty: trade.qty,
        price: trade.price,
        time: trade.time,
        reasoning: trade.reasoning
      }))
    };
  }

  /**
   * Make a trade
   */
  async makeTrade(botId, tradeParams, articleId) {
    // Ensure we have a trade executor
    if (!this.currentTradeExecutor) {
      console.error('❌ No trade executor available');
      return {
        success: false,
        error: 'Trade executor not available'
      };
    }

    console.log(`📊 Making trade for bot ${botId}:`, tradeParams);

    try {
      // First save the reasoning
      let reasoningId = null;
      if (this.lastReasoning) {
        const reasoningResult = await this.saveReasoning(botId, articleId, this.lastReasoning);
        reasoningId = reasoningResult.reasoningId;
      }

      // Execute trade through the trading bot service
      const result = await this.currentTradeExecutor(tradeParams, this.currentArticleId, reasoningId);

      // Store trade details for logging
      if (result.success) {
        this.currentTradeDetails = {
          symbol: tradeParams.symbol,
          side: tradeParams.side,
          qty: tradeParams.qty,
          price: result.price || tradeParams.profitTarget
        };
      }

      return result;
    } catch (error) {
      console.error('❌ Trade execution failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Save AI reasoning
   */
  async saveReasoning(botId, articleId, reasoning) {
    try {
      // Store reasoning for potential trade execution
      this.lastReasoning = reasoning;

      const result = await pool.query(
        `INSERT INTO ai_trade_reasoning
         (news_article_id, reasoning, sentiment, confidence_score, symbols_analyzed, decision)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          articleId,
          reasoning.reasoning,
          reasoning.decision === 'BUY' ? 'bullish' : reasoning.decision === 'SELL' ? 'bearish' : 'neutral',
          reasoning.confidence,
          [reasoning.symbol],
          reasoning.decision
        ]
      );

      console.log(`💾 Saved reasoning (ID: ${result.rows[0].id})`);
      return { success: true, reasoningId: result.rows[0].id };
    } catch (error) {
      return { error: `Failed to save reasoning: ${error.message}` };
    }
  }

  /**
   * Save news article to database
   */
  async saveNewsArticle(article) {
    const result = await pool.query(
      `INSERT INTO ai_news_articles
       (headline, summary, symbols, source, url, published_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        article.headline,
        article.summary,
        article.symbols || [],
        article.source,
        article.url,
        article.created_at || new Date()
      ]
    );

    return { id: result.rows[0].id };
  }

  /**
   * Check rate limiting (both per-minute and per-hour)
   * ATOMIC: increments counter immediately if allowed to prevent race conditions
   */
  checkRateLimit() {
    const now = Date.now();

    // Reset hourly counter
    const hourElapsed = now - this.lastResetTime > 3600000; // 1 hour
    if (hourElapsed) {
      this.newsProcessedCount = 0;
      this.lastResetTime = now;
    }

    // Reset minute counter
    const minuteElapsed = now - this.lastMinuteResetTime > 60000; // 1 minute
    if (minuteElapsed) {
      this.newsProcessedThisMinute = 0;
      this.lastMinuteResetTime = now;
    }

    // Check both limits
    const underHourlyLimit = this.newsProcessedCount < this.maxNewsPerHour;
    const underMinuteLimit = this.newsProcessedThisMinute < this.maxNewsPerMinute;

    // If allowed, IMMEDIATELY increment to prevent parallel requests from all passing
    if (underHourlyLimit && underMinuteLimit) {
      this.newsProcessedCount++;
      this.newsProcessedThisMinute++;
      console.log(`📊 Rate limit: ${this.newsProcessedThisMinute}/${this.maxNewsPerMinute} this minute`);
      return true;
    }

    return false;
  }

  /**
   * Increment rate limit counters after successful processing
   */
  incrementRateLimitCounters() {
    this.newsProcessedCount++;
    this.newsProcessedThisMinute++;
  }

  /**
   * Increment news processed count (both hourly and per-minute)
   */
  incrementNewsCount() {
    this.newsProcessedCount++;
    this.newsProcessedThisMinute++;
  }
}

// Export singleton instance
let aiTradeAgentServiceInstance = null;

module.exports = {
  getAITradeAgentService: () => {
    if (!aiTradeAgentServiceInstance) {
      aiTradeAgentServiceInstance = new AITradeAgentService();
    }
    return aiTradeAgentServiceInstance;
  },
  AITradeAgentService
};
