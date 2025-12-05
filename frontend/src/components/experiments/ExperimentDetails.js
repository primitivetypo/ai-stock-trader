'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Share2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import AIAnalysisLog from './AIAnalysisLog';

export default function ExperimentDetails({ experimentId, onBack }) {
  const [experiment, setExperiment] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [allTrades, setAllTrades] = useState([]);
  const [tradeFilter, setTradeFilter] = useState({ botId: 'all', symbol: 'all' });
  const [tradePage, setTradePage] = useState(1);
  const TRADES_PER_PAGE = 50;
  const [shareFormData, setShareFormData] = useState({
    title: '',
    description: '',
    riskLevel: 'Moderate',
    category: 'Technical',
    tags: '',
    botId: null
  });

  useEffect(() => {
    if (experimentId) {
      fetchExperimentDetails();
      const interval = setInterval(fetchExperimentDetails, 10000); // Refresh every 10s
      return () => clearInterval(interval);
    }
  }, [experimentId]);

  // WebSocket listener for real-time trade updates
  useEffect(() => {
    if (!experimentId) return;

    const socket = connectSocket();

    const handleNewTrade = (data) => {
      // Only process trades for current experiment
      if (data.experimentId === experimentId) {
        console.log('📥 New trade received:', data.trade);

        // Add new trade to the list
        setAllTrades(prevTrades => {
          // Check if trade already exists (avoid duplicates)
          const exists = prevTrades.some(t =>
            t.bot_id === data.trade.bot_id &&
            t.symbol === data.trade.symbol &&
            Math.abs(new Date(t.time) - new Date(data.trade.time)) < 1000
          );

          if (exists) return prevTrades;

          return [data.trade, ...prevTrades];
        });

        // Show toast notification
        toast.success(
          `${data.trade.bot_strategy}: ${data.trade.side.toUpperCase()} ${data.trade.qty} ${data.trade.symbol} @ $${data.trade.price.toFixed(2)}`,
          { duration: 3000 }
        );
      }
    };

    socket.on('newTrade', handleNewTrade);

    return () => {
      socket.off('newTrade', handleNewTrade);
      disconnectSocket();
    };
  }, [experimentId]);

  const fetchExperimentDetails = async () => {
    try {
      const [expResponse, resultsResponse, tradesResponse] = await Promise.all([
        api.get(`/api/experiments/${experimentId}`),
        api.get(`/api/experiments/${experimentId}/results`),
        api.get(`/api/experiments/${experimentId}/trades`)
      ]);

      setExperiment(expResponse.data);
      setResults(resultsResponse.data);

      // Use trades from dedicated endpoint
      setAllTrades(tradesResponse.data.trades || []);
    } catch (error) {
      console.error('Failed to fetch experiment details:', error);
      toast.error('Failed to load experiment details');
    } finally {
      setLoading(false);
    }
  };

  const handleShareStrategy = (botId, strategy) => {
    setShareFormData({
      ...shareFormData,
      botId,
      title: `${strategy} Strategy`,
      description: `Successful ${strategy} strategy from experiment ${experiment.name || experiment.id}`
    });
    setShowShareModal(true);
  };

  const submitShareStrategy = async (e) => {
    e.preventDefault();

    if (!shareFormData.botId) {
      toast.error('Please select a bot to share');
      return;
    }

    try {
      const response = await api.post('/api/strategies/share', {
        experimentId,
        botId: shareFormData.botId,
        title: shareFormData.title,
        description: shareFormData.description,
        riskLevel: shareFormData.riskLevel,
        category: shareFormData.category,
        tags: shareFormData.tags.split(',').map(t => t.trim()).filter(t => t)
      });

      toast.success('Strategy shared successfully!');
      setShowShareModal(false);
      setShareFormData({
        title: '',
        description: '',
        riskLevel: 'Moderate',
        category: 'Technical',
        tags: '',
        botId: null
      });
    } catch (error) {
      console.error('Failed to share strategy:', error);
      toast.error(error.response?.data?.error || 'Failed to share strategy');
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-6">
        <p className="text-slate-600">Loading experiment details...</p>
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="glass-card p-6">
        <p className="text-rose-600 font-semibold">Experiment not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{experiment.name || experiment.id}</h2>
            <div className="text-sm text-slate-600 space-y-1 font-medium">
              <p>Status: <span className="text-slate-900">{experiment.status}</span></p>
              <p>Bots: {experiment.botCount}</p>
              <p>Started: {new Date(experiment.startTime).toLocaleString()}</p>
              {experiment.endTime && (
                <p>Ended: {new Date(experiment.endTime).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Comparison */}
      {results && results.results.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Performance Comparison</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-2 text-slate-600 font-semibold">Rank</th>
                  <th className="text-left py-3 px-2 text-slate-600 font-semibold">Strategy</th>
                  <th className="text-right py-3 px-2 text-slate-600 font-semibold">Final Equity</th>
                  <th className="text-right py-3 px-2 text-slate-600 font-semibold">Profit/Loss</th>
                  <th className="text-right py-3 px-2 text-slate-600 font-semibold">Return %</th>
                  <th className="text-right py-3 px-2 text-slate-600 font-semibold">Trades</th>
                  <th className="text-right py-3 px-2 text-slate-600 font-semibold">Win Rate</th>
                  <th className="text-center py-3 px-2 text-slate-600 font-semibold">Share</th>
                </tr>
              </thead>
              <tbody>
                {results.results.map((result, index) => (
                  <tr
                    key={result.botId}
                    className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-yellow-900' :
                        index === 1 ? 'bg-slate-400 text-slate-900' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-slate-900 font-semibold cursor-pointer" onClick={() => setSelectedBot(result.botId)}>
                      {result.strategy}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-900 font-medium">
                      ${result.finalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-2 text-right font-bold ${
                      result.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {result.totalProfit >= 0 ? '+' : ''}${result.totalProfit.toFixed(2)}
                    </td>
                    <td className={`py-3 px-2 text-right font-bold ${
                      result.returnPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {result.returnPercent >= 0 ? '+' : ''}{result.returnPercent.toFixed(2)}%
                    </td>
                    <td className="py-3 px-2 text-right text-slate-900 font-medium">{result.totalTrades}</td>
                    <td className="py-3 px-2 text-right text-slate-900 font-medium">
                      {result.winRate.toFixed(1)}%
                      <span className="text-slate-500 ml-1">({result.winningTrades}W/{result.losingTrades}L)</span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      {result.totalProfit > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareStrategy(result.botId, result.strategy);
                          }}
                          className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                          title="Share this strategy"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bot Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {experiment.botsDetails?.map((bot) => (
          <div
            key={bot.id}
            className="glass-card p-5 hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer border border-transparent"
            onClick={() => setSelectedBot(bot.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-slate-900 font-bold">{bot.strategy}</h4>
                <p className="text-xs text-slate-500">{bot.id}</p>
              </div>
              <span className={`badge ${
                bot.status === 'running' ? 'badge-success' : 'badge-info'
              }`}>
                {bot.status}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Equity:</span>
                <span className="text-slate-900 font-bold">
                  ${bot.metrics.currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">P&L:</span>
                <span className={`font-bold ${
                  bot.metrics.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {bot.metrics.totalProfit >= 0 ? '+' : ''}${bot.metrics.totalProfit.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 font-medium">Trades:</span>
                <span className="text-slate-900 font-semibold">
                  {bot.metrics.totalTrades} ({bot.metrics.winningTrades}W / {bot.metrics.losingTrades}L)
                </span>
              </div>
            </div>

            {/* Recent Trades */}
            {bot.trades && bot.trades.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-600 font-semibold mb-2">Recent Trades:</p>
                <div className="space-y-1">
                  {bot.trades.slice(-3).reverse().map((trade, idx) => (
                    <div key={idx} className="text-xs flex justify-between">
                      <span className={`font-semibold ${trade.side === 'buy' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {trade.side.toUpperCase()} {trade.qty} {trade.symbol}
                      </span>
                      <span className="text-slate-600 font-medium">${trade.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Comprehensive Trade Log */}
      {allTrades.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900">Trade Activity Log</h3>
            <div className="text-sm text-slate-600 font-medium">
              Total: {allTrades.length} trades
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-xs text-slate-600 font-semibold mb-1">Filter by Bot</label>
              <select
                value={tradeFilter.botId}
                onChange={(e) => { setTradeFilter({ ...tradeFilter, botId: e.target.value }); setTradePage(1); }}
                className="input-primary text-sm"
              >
                <option value="all">All Bots</option>
                {experiment.botsDetails?.map(bot => (
                  <option key={bot.id} value={bot.id}>{bot.strategy}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-600 font-semibold mb-1">Filter by Symbol</label>
              <select
                value={tradeFilter.symbol}
                onChange={(e) => { setTradeFilter({ ...tradeFilter, symbol: e.target.value }); setTradePage(1); }}
                className="input-primary text-sm"
              >
                <option value="all">All Symbols</option>
                {Array.from(new Set(allTrades.map(t => t.symbol))).sort().map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Trade Log Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-2 text-slate-600 font-semibold">Time</th>
                  <th className="text-left py-3 px-2 text-slate-600 font-semibold">Bot/Strategy</th>
                  <th className="text-left py-3 px-2 text-slate-600 font-semibold">Symbol</th>
                  <th className="text-center py-3 px-2 text-slate-600 font-semibold">Side</th>
                  <th className="text-right py-3 px-2 text-slate-600 font-semibold">Qty</th>
                  <th className="text-right py-3 px-2 text-slate-600 font-semibold">Price</th>
                  <th className="text-right py-3 px-2 text-slate-600 font-semibold">Value</th>
                  <th className="text-left py-3 px-2 text-slate-600 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredTrades = allTrades.filter(trade =>
                    (tradeFilter.botId === 'all' || (trade.bot_id || trade.botId) === tradeFilter.botId) &&
                    (tradeFilter.symbol === 'all' || trade.symbol === tradeFilter.symbol)
                  );
                  const startIdx = (tradePage - 1) * TRADES_PER_PAGE;
                  const paginatedTrades = filteredTrades.slice(startIdx, startIdx + TRADES_PER_PAGE);

                  return paginatedTrades.map((trade, index) => {
                    const price = parseFloat(trade.price) || 0;
                    const qty = parseFloat(trade.qty) || 0;
                    const tradeValue = qty * price;
                    const tradeDate = new Date(trade.time);

                    return (
                      <tr
                        key={`${trade.botId}-${trade.time}-${index}`}
                        className="border-b border-slate-100 hover:bg-blue-50/20 transition-colors"
                      >
                        <td className="py-3 px-2 text-slate-700 font-medium">
                          <div>{tradeDate.toLocaleDateString()}</div>
                          <div className="text-xs text-slate-500">{tradeDate.toLocaleTimeString()}</div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-slate-900 font-semibold">{trade.bot_strategy || trade.botStrategy}</div>
                          <div className="text-xs text-slate-500">{(trade.bot_id || trade.botId || '').slice(-8)}</div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-slate-900 font-bold">{trade.symbol}</span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${
                            trade.side === 'buy'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {trade.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-slate-900 font-semibold">
                          {qty}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-900 font-bold">
                          ${price.toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-700 font-medium">
                          ${tradeValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-2 text-slate-600 text-xs">
                          {trade.reason || 'Strategy signal'}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>

            {/* No trades message when filtered */}
            {allTrades.filter(trade =>
              (tradeFilter.botId === 'all' || (trade.bot_id || trade.botId) === tradeFilter.botId) &&
              (tradeFilter.symbol === 'all' || trade.symbol === tradeFilter.symbol)
            ).length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No trades match the current filters
              </div>
            )}

            {/* Pagination Controls */}
            {(() => {
              const filteredTrades = allTrades.filter(trade =>
                (tradeFilter.botId === 'all' || (trade.bot_id || trade.botId) === tradeFilter.botId) &&
                (tradeFilter.symbol === 'all' || trade.symbol === tradeFilter.symbol)
              );
              const totalPages = Math.ceil(filteredTrades.length / TRADES_PER_PAGE);
              const startIdx = (tradePage - 1) * TRADES_PER_PAGE + 1;
              const endIdx = Math.min(tradePage * TRADES_PER_PAGE, filteredTrades.length);

              if (totalPages <= 1) return null;

              return (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                  <div className="text-sm text-slate-600">
                    Showing {startIdx}-{endIdx} of {filteredTrades.length} trades
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTradePage(p => Math.max(1, p - 1))}
                      disabled={tradePage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (tradePage <= 3) {
                          pageNum = i + 1;
                        } else if (tradePage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = tradePage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setTradePage(pageNum)}
                            className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                              tradePage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setTradePage(p => Math.min(totalPages, p + 1))}
                      disabled={tradePage === totalPages}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* AI Analysis Log */}
      <AIAnalysisLog experimentId={experimentId} />

      {/* Share Strategy Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-900">Share Strategy</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <form onSubmit={submitShareStrategy} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Strategy Title *
                </label>
                <input
                  type="text"
                  value={shareFormData.title}
                  onChange={(e) => setShareFormData({ ...shareFormData, title: e.target.value })}
                  className="input-primary"
                  placeholder="e.g., High-Performance Momentum Strategy"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={shareFormData.description}
                  onChange={(e) => setShareFormData({ ...shareFormData, description: e.target.value })}
                  className="input-primary min-h-[120px]"
                  placeholder="Describe how your strategy works, what makes it successful..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Risk Level *
                  </label>
                  <select
                    value={shareFormData.riskLevel}
                    onChange={(e) => setShareFormData({ ...shareFormData, riskLevel: e.target.value })}
                    className="input-primary"
                    required
                  >
                    <option value="Conservative">Conservative</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Aggressive">Aggressive</option>
                    <option value="Very Aggressive">Very Aggressive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={shareFormData.category}
                    onChange={(e) => setShareFormData({ ...shareFormData, category: e.target.value })}
                    className="input-primary"
                    required
                  >
                    <option value="Technical">Technical</option>
                    <option value="Technology">Technology</option>
                    <option value="Dividend">Dividend</option>
                    <option value="AI-Powered">AI-Powered</option>
                    <option value="Diversified">Diversified</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={shareFormData.tags}
                  onChange={(e) => setShareFormData({ ...shareFormData, tags: e.target.value })}
                  className="input-primary"
                  placeholder="e.g., momentum, short-term, high-frequency"
                />
                <p className="text-xs text-slate-500 mt-1">Helps others find your strategy</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share Strategy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
