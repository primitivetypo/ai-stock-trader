const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting middleware
const {
  apiLimiter,
  authLimiter,
  createUserRateLimiter
} = require('./src/middleware/rateLimiter');

// Apply general API rate limiting to all routes
app.use('/api/', apiLimiter);

// Apply user-specific rate limiting (after auth)
app.use('/api/', createUserRateLimiter());

// Apply strict rate limiting to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Import routes
const authRoutes = require('./src/api/auth');
const tradesRoutes = require('./src/api/trades');
const marketRoutes = require('./src/api/market');
const analyticsRoutes = require('./src/api/analytics');
const userRoutes = require('./src/api/user');
const experimentsRoutes = require('./src/api/experiments');
const strategiesRoutes = require('./src/api/strategies');
const aiAnalysisRoutes = require('./src/api/aiAnalysis');

// Import services
const AlpacaService = require('./src/services/alpacaService');
const VolumeDetectionEngine = require('./src/services/volumeDetectionEngine');
const PaperInvestService = require('./src/services/paperInvestService');
const VirtualPortfolioService = require('./src/services/virtualPortfolioService');
const TradingBotService = require('./src/services/tradingBotService');

// Initialize services
const alpacaService = new AlpacaService();
const virtualPortfolioService = new VirtualPortfolioService(alpacaService);
const volumeEngine = new VolumeDetectionEngine(alpacaService);
const paperInvestService = new PaperInvestService();
const tradingBotService = new TradingBotService(virtualPortfolioService, alpacaService, io);

// Make services available globally
app.locals.alpacaService = alpacaService;
app.locals.virtualPortfolioService = virtualPortfolioService;
app.locals.volumeEngine = volumeEngine;
app.locals.paperInvestService = paperInvestService;
app.locals.tradingBotService = tradingBotService;
app.locals.io = io;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/experiments', experimentsRoutes);
app.use('/api/strategies', strategiesRoutes);
app.use('/api/ai-analysis', aiAnalysisRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Subscribe to market data
  socket.on('subscribe', async (symbols) => {
    console.log('Subscribing to symbols:', symbols);
    try {
      await alpacaService.subscribeToSymbols(symbols, (data) => {
        socket.emit('marketData', data);
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Unsubscribe from market data
  socket.on('unsubscribe', async (symbols) => {
    console.log('Unsubscribing from symbols:', symbols);
    try {
      await alpacaService.unsubscribeFromSymbols(symbols);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start volume detection engine
volumeEngine.on('volumeAlert', (alert) => {
  console.log('Volume alert:', alert);
  io.emit('volumeAlert', alert);
});

volumeEngine.on('tradeExecuted', (trade) => {
  console.log('Trade executed:', trade);
  io.emit('tradeExecuted', trade);
});

// Listen to trading bot events
tradingBotService.on('experimentStarted', (experiment) => {
  console.log('Experiment started:', experiment.id);
  io.emit('experimentStarted', experiment);
});

tradingBotService.on('experimentStopped', (experiment) => {
  console.log('Experiment stopped:', experiment.id);
  io.emit('experimentStopped', experiment);
});

tradingBotService.on('botTrade', (data) => {
  console.log('Bot trade:', data);
  io.emit('botTrade', data);
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 4001;
// Use 0.0.0.0 for production (Replit), localhost for local development
const HOST = process.env.HOST || (process.env.REPL_ID ? '0.0.0.0' : 'localhost');

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);

  // Initialize services
  alpacaService.initialize().then(async () => {
    console.log('Alpaca service initialized');
    volumeEngine.start();
    console.log('Volume detection engine started');
    virtualPortfolioService.startOrderMonitoring();
    console.log('Virtual portfolio service started');

    // Auto-resume running experiments
    try {
      const pool = require('./src/db/database');
      const runningExperiments = await pool.query(
        "SELECT * FROM experiments WHERE status = 'running' ORDER BY created_at DESC"
      );

      if (runningExperiments.rows.length > 0) {
        console.log(`🔄 Found ${runningExperiments.rows.length} running experiment(s), resuming...`);
        for (const exp of runningExperiments.rows) {
          try {
            await tradingBotService.startExperiment(exp.id);
            console.log(`✅ Resumed experiment: ${exp.name || exp.id}`);
          } catch (err) {
            console.error(`❌ Failed to resume experiment ${exp.id}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('Failed to auto-resume experiments:', err);
    }
  }).catch(err => {
    console.error('Failed to initialize services:', err);
  });
});

module.exports = { app, server, io };
