const axios = require('axios');
const EventSource = require('eventsource');

class PaperInvestService {
  constructor() {
    this.apiKey = process.env.PAPERINVEST_API_KEY;
    this.baseURL = process.env.PAPERINVEST_BASE_URL;
    this.eventSource = null;
    this.trades = new Map();
  }

  async initialize() {
    if (!this.apiKey || !this.baseURL) {
      console.warn('PaperInvest API not configured, simulation disabled');
      return false;
    }

    try {
      // Test connection
      const response = await axios.get(`${this.baseURL}/status`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      console.log('PaperInvest service connected');
      this.setupSSE();
      return true;
    } catch (error) {
      console.error('Failed to initialize PaperInvest:', error.message);
      return false;
    }
  }

  setupSSE() {
    // Set up Server-Sent Events for real-time updates
    const sseUrl = `${this.baseURL}/stream`;

    this.eventSource = new EventSource(sseUrl, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleSSEMessage(data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      // Attempt reconnection
      setTimeout(() => this.setupSSE(), 5000);
    };

    console.log('PaperInvest SSE stream connected');
  }

  handleSSEMessage(data) {
    const { type, tradeId, ...details } = data;

    switch (type) {
      case 'fill':
        this.handleFill(tradeId, details);
        break;
      case 'partial_fill':
        this.handlePartialFill(tradeId, details);
        break;
      case 'queue_update':
        this.handleQueueUpdate(tradeId, details);
        break;
      case 'slippage':
        this.handleSlippage(tradeId, details);
        break;
      default:
        console.log('Unknown SSE message type:', type);
    }
  }

  async simulateOrder(order) {
    if (!this.apiKey || !this.baseURL) {
      // Fallback to basic simulation
      return this.basicSimulation(order);
    }

    try {
      const response = await axios.post(`${this.baseURL}/orders`, {
        symbol: order.symbol,
        quantity: order.qty,
        side: order.side,
        orderType: order.type,
        limitPrice: order.limit_price,
        stopPrice: order.stop_price
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      const tradeId = response.data.tradeId;
      this.trades.set(tradeId, {
        order,
        status: 'pending',
        simulationData: response.data
      });

      return {
        tradeId,
        status: 'simulating',
        estimatedFill: response.data.estimatedFill
      };
    } catch (error) {
      console.error('Failed to simulate order:', error);
      return this.basicSimulation(order);
    }
  }

  basicSimulation(order) {
    // Simple simulation without PaperInvest
    const slippage = this.calculateBasicSlippage(order);
    const fillPrice = order.type === 'market'
      ? order.estimatedPrice * (1 + slippage)
      : order.limit_price;

    return {
      tradeId: `local_${Date.now()}`,
      status: 'filled',
      fillPrice,
      fillQuantity: order.qty,
      slippage,
      timestamp: new Date()
    };
  }

  calculateBasicSlippage(order) {
    // Simple slippage model
    // Larger orders = more slippage
    const baseSlippage = 0.001; // 0.1%
    const sizeMultiplier = Math.log10(order.qty || 1) / 10;

    return order.side === 'buy'
      ? baseSlippage + sizeMultiplier
      : -(baseSlippage + sizeMultiplier);
  }

  handleFill(tradeId, details) {
    const trade = this.trades.get(tradeId);

    if (trade) {
      trade.status = 'filled';
      trade.fillData = details;

      console.log(`Trade ${tradeId} filled:`, details);

      // Emit event (would integrate with EventEmitter)
      if (this.onFill) {
        this.onFill(tradeId, details);
      }
    }
  }

  handlePartialFill(tradeId, details) {
    const trade = this.trades.get(tradeId);

    if (trade) {
      trade.status = 'partial';
      trade.partialFills = trade.partialFills || [];
      trade.partialFills.push(details);

      console.log(`Trade ${tradeId} partially filled:`, details);

      if (this.onPartialFill) {
        this.onPartialFill(tradeId, details);
      }
    }
  }

  handleQueueUpdate(tradeId, details) {
    const trade = this.trades.get(tradeId);

    if (trade) {
      trade.queuePosition = details.position;

      console.log(`Trade ${tradeId} queue position:`, details.position);

      if (this.onQueueUpdate) {
        this.onQueueUpdate(tradeId, details);
      }
    }
  }

  handleSlippage(tradeId, details) {
    const trade = this.trades.get(tradeId);

    if (trade) {
      trade.slippage = details.slippage;

      console.log(`Trade ${tradeId} slippage:`, details.slippage);

      if (this.onSlippage) {
        this.onSlippage(tradeId, details);
      }
    }
  }

  async getTradeStatus(tradeId) {
    const localTrade = this.trades.get(tradeId);

    if (localTrade) {
      return localTrade;
    }

    if (!this.apiKey || !this.baseURL) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseURL}/orders/${tradeId}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to get trade status:', error);
      return null;
    }
  }

  async getSimulationMetrics() {
    // PaperInvest API is optional - always use local metrics for now
    return this.getLocalMetrics();
  }

  getLocalMetrics() {
    const trades = Array.from(this.trades.values());

    return {
      totalTrades: trades.length,
      filledTrades: trades.filter(t => t.status === 'filled').length,
      partialTrades: trades.filter(t => t.status === 'partial').length,
      avgSlippage: trades.reduce((sum, t) => sum + (t.slippage || 0), 0) / trades.length || 0
    };
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      console.log('PaperInvest SSE stream disconnected');
    }
  }
}

module.exports = PaperInvestService;
