const WebSocket = require('ws');
const { EventEmitter } = require('events');
const pool = require('../db/database');

/**
 * News Stream Service
 * Connects to Alpaca news WebSocket and distributes news to AI-enabled bots
 */
class NewsStreamService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.isSubscribed = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5 seconds
    this.streamUrl = process.env.ALPACA_NEWS_STREAM_URL || 'wss://stream.data.alpaca.markets/v1beta1/news';
    this.apiKey = process.env.ALPACA_API_KEY;
    this.apiSecret = process.env.ALPACA_SECRET_KEY;
    this.articlesProcessed = 0;
    this.lastArticleTime = null;
    this.statusId = null;
  }

  /**
   * Start the news stream
   */
  async start() {
    if (!this.apiKey || !this.apiSecret) {
      console.error('❌ Alpaca API credentials not configured');
      return false;
    }

    console.log('🔌 Starting news stream connection...');
    await this.updateStreamStatus('connecting');
    return this.connect();
  }

  /**
   * Stop the news stream
   */
  async stop() {
    console.log('🛑 Stopping news stream...');
    await this.updateStreamStatus('disconnected');

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.isAuthenticated = false;
    this.isSubscribed = false;
  }

  /**
   * Connect to Alpaca news WebSocket
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.streamUrl);

        this.ws.on('open', () => {
          console.log('✅ WebSocket connection opened');
          this.isConnected = true;
          this.reconnectAttempts = 0;
        });

        this.ws.on('message', async (data) => {
          try {
            const messages = JSON.parse(data);

            // Handle array of messages
            for (const message of messages) {
              await this.handleMessage(message);
            }
          } catch (error) {
            console.error('❌ Error parsing message:', error.message);
          }
        });

        this.ws.on('error', (error) => {
          console.error('❌ WebSocket error:', error.message);
          this.updateStreamStatus('error', error.message);
          reject(error);
        });

        this.ws.on('close', async (code, reason) => {
          console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
          this.isConnected = false;
          this.isAuthenticated = false;
          this.isSubscribed = false;

          await this.updateStreamStatus('disconnected');

          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(() => {
              this.connect();
            }, this.reconnectDelay);
          } else {
            console.error('❌ Max reconnection attempts reached');
          }
        });

        // Resolve when authenticated and subscribed
        this.once('subscribed', () => {
          resolve(true);
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          if (!this.isSubscribed) {
            reject(new Error('Connection timeout'));
          }
        }, 30000);

      } catch (error) {
        console.error('❌ Connection error:', error.message);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(message) {
    const messageType = message.T;

    switch (messageType) {
      case 'success':
        if (message.msg === 'connected') {
          console.log('✅ Connection successful, authenticating...');
          await this.authenticate();
        } else if (message.msg === 'authenticated') {
          console.log('✅ Authentication successful, subscribing...');
          this.isAuthenticated = true;
          await this.subscribe();
        }
        break;

      case 'subscription':
        console.log('✅ Subscribed to news stream');
        this.isSubscribed = true;
        await this.updateStreamStatus('connected');
        this.emit('subscribed');
        break;

      case 'n': // News article
        await this.handleNewsArticle(message);
        break;

      case 'error':
        console.error('❌ Stream error:', message.msg);
        await this.updateStreamStatus('error', message.msg);
        break;

      default:
        // Ignore other message types
        break;
    }
  }

  /**
   * Authenticate with Alpaca
   */
  async authenticate() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const authMessage = {
      action: 'auth',
      key: this.apiKey,
      secret: this.apiSecret
    };

    this.ws.send(JSON.stringify(authMessage));
  }

  /**
   * Subscribe to all news
   */
  async subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const subscribeMessage = {
      action: 'subscribe',
      news: ['*'] // Subscribe to all news
    };

    this.ws.send(JSON.stringify(subscribeMessage));
  }

  /**
   * Handle incoming news article
   */
  async handleNewsArticle(article) {
    this.articlesProcessed++;
    this.lastArticleTime = new Date();

    console.log(`📰 News received: ${article.headline}`);

    // Update stream status
    await this.updateStreamStatus('connected');

    // Emit news event for AI-enabled bots to process
    this.emit('news', {
      headline: article.headline,
      summary: article.summary,
      author: article.author,
      content: article.content,
      symbols: article.symbols || [],
      source: article.source,
      url: article.url,
      created_at: article.created_at
    });
  }

  /**
   * Update stream status in database
   */
  async updateStreamStatus(status, errorMessage = null) {
    try {
      if (!this.statusId) {
        // Create new status record
        const result = await pool.query(
          `INSERT INTO ai_news_stream_status
           (stream_name, status, connected_at, articles_processed, last_article_at, error_message)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            'alpaca-news',
            status,
            status === 'connected' ? new Date() : null,
            this.articlesProcessed,
            this.lastArticleTime,
            errorMessage
          ]
        );
        this.statusId = result.rows[0].id;
      } else {
        // Update existing status record
        await pool.query(
          `UPDATE ai_news_stream_status
           SET status = $1,
               disconnected_at = $2,
               articles_processed = $3,
               last_article_at = $4,
               error_message = $5,
               updated_at = NOW()
           WHERE id = $6`,
          [
            status,
            status === 'disconnected' || status === 'error' ? new Date() : null,
            this.articlesProcessed,
            this.lastArticleTime,
            errorMessage,
            this.statusId
          ]
        );
      }
    } catch (error) {
      console.error('❌ Failed to update stream status:', error.message);
    }
  }

  /**
   * Get stream status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      isSubscribed: this.isSubscribed,
      articlesProcessed: this.articlesProcessed,
      lastArticleTime: this.lastArticleTime,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Get stream statistics from database
   */
  async getStatistics() {
    try {
      const result = await pool.query(
        `SELECT
          stream_name,
          status,
          connected_at,
          disconnected_at,
          articles_processed,
          last_article_at,
          updated_at
         FROM ai_news_stream_status
         WHERE stream_name = 'alpaca-news'
         ORDER BY updated_at DESC
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('❌ Failed to get stream statistics:', error.message);
      return null;
    }
  }

  /**
   * Test connection with a simple ping
   */
  async testConnection() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    return this.isConnected && this.isAuthenticated && this.isSubscribed;
  }
}

// Export singleton instance
let newsStreamServiceInstance = null;

module.exports = {
  getNewsStreamService: () => {
    if (!newsStreamServiceInstance) {
      newsStreamServiceInstance = new NewsStreamService();
    }
    return newsStreamServiceInstance;
  },
  NewsStreamService
};
