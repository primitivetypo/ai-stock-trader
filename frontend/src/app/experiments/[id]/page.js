'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AIAnalysisLog from '@/components/experiments/AIAnalysisLog';
import {
  ArrowLeft,
  Play,
  Square,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Target,
  Activity,
  ChevronLeft,
  ChevronRight,
  Brain,
  BarChart3,
  List
} from 'lucide-react';

export default function ExperimentDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const experimentId = params.id;

  const [experiment, setExperiment] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allTrades, setAllTrades] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Pagination for trades
  const [tradePage, setTradePage] = useState(1);
  const [tradeFilter, setTradeFilter] = useState({ botId: 'all', symbol: 'all' });
  const TRADES_PER_PAGE = 50;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    if (experimentId) {
      fetchExperimentDetails();
      const interval = setInterval(fetchExperimentDetails, 10000);
      return () => clearInterval(interval);
    }
  }, [experimentId, router]);

  // WebSocket listener for real-time trade updates
  useEffect(() => {
    if (!experimentId) return;

    const socket = connectSocket();

    const handleNewTrade = (data) => {
      if (data.experimentId === experimentId) {
        setAllTrades(prevTrades => {
          const exists = prevTrades.some(t =>
            t.bot_id === data.trade.bot_id &&
            t.symbol === data.trade.symbol &&
            Math.abs(new Date(t.time) - new Date(data.trade.time)) < 1000
          );
          if (exists) return prevTrades;
          return [data.trade, ...prevTrades];
        });

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
      setAllTrades(tradesResponse.data.trades || []);
    } catch (error) {
      console.error('Failed to fetch experiment details:', error);
      toast.error('Failed to load experiment details');
    } finally {
      setLoading(false);
    }
  };

  const startExperiment = async () => {
    try {
      await api.post(`/api/experiments/${experimentId}/start`);
      toast.success('Experiment started!');
      fetchExperimentDetails();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start experiment');
    }
  };

  const stopExperiment = async () => {
    try {
      await api.post(`/api/experiments/${experimentId}/stop`);
      toast.success('Experiment stopped!');
      fetchExperimentDetails();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to stop experiment');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Get filtered and paginated trades
  const getFilteredTrades = () => {
    return allTrades.filter(trade =>
      (tradeFilter.botId === 'all' || (trade.bot_id || trade.botId) === tradeFilter.botId) &&
      (tradeFilter.symbol === 'all' || trade.symbol === tradeFilter.symbol)
    );
  };

  const getPaginatedTrades = () => {
    const filtered = getFilteredTrades();
    const startIdx = (tradePage - 1) * TRADES_PER_PAGE;
    return filtered.slice(startIdx, startIdx + TRADES_PER_PAGE);
  };

  const totalPages = Math.ceil(getFilteredTrades().length / TRADES_PER_PAGE);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-body text-content-secondary">Loading experiment...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!experiment) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-danger font-semibold mb-4">Experiment not found</p>
          <button onClick={() => router.push('/experiments')} className="btn-primary">
            Back to Experiments
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const totalProfit = results?.results?.reduce((sum, r) => sum + (r.totalProfit || 0), 0) || 0;
  const totalTrades = results?.results?.reduce((sum, r) => sum + (r.totalTrades || 0), 0) || 0;
  const avgWinRate = results?.results?.length > 0
    ? results.results.reduce((sum, r) => sum + (r.winRate || 0), 0) / results.results.length
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/experiments')}
              className="btn-icon hover:bg-surface-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-content-primary">
                {experiment.name || 'Experiment'}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`badge ${
                  experiment.status === 'running' ? 'badge-success' :
                  experiment.status === 'stopped' ? 'badge-danger' : 'badge-brand'
                }`}>
                  {experiment.status === 'running' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse mr-1.5" />
                  )}
                  {experiment.status}
                </span>
                <span className="text-caption text-content-tertiary">
                  {experiment.botCount} bots
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {experiment.status === 'created' && (
              <button onClick={startExperiment} className="btn-success">
                <Play className="w-4 h-4" />
                Start Experiment
              </button>
            )}
            {experiment.status === 'running' && (
              <button onClick={stopExperiment} className="btn-danger">
                <Square className="w-4 h-4" />
                Stop Experiment
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-elevated p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${totalProfit >= 0 ? 'bg-success-light' : 'bg-danger-light'}`}>
                {totalProfit >= 0 ? (
                  <TrendingUp className={`w-5 h-5 text-success`} />
                ) : (
                  <TrendingDown className={`w-5 h-5 text-danger`} />
                )}
              </div>
              <div>
                <p className="text-caption text-content-tertiary">Total P&L</p>
                <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)}
                </p>
              </div>
            </div>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-50">
                <Activity className="w-5 h-5 text-brand-500" />
              </div>
              <div>
                <p className="text-caption text-content-tertiary">Total Trades</p>
                <p className="text-xl font-bold text-content-primary">{totalTrades}</p>
              </div>
            </div>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning-light">
                <Target className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-caption text-content-tertiary">Avg Win Rate</p>
                <p className="text-xl font-bold text-content-primary">{avgWinRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
          <div className="card-elevated p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-surface-100">
                <Clock className="w-5 h-5 text-content-secondary" />
              </div>
              <div>
                <p className="text-caption text-content-tertiary">Started</p>
                <p className="text-body font-semibold text-content-primary">
                  {new Date(experiment.startTime).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={activeTab === 'overview' ? 'tab-active' : 'tab'}
          >
            <BarChart3 className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={activeTab === 'trades' ? 'tab-active' : 'tab'}
          >
            <List className="w-4 h-4" />
            Trade Log ({allTrades.length})
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={activeTab === 'ai' ? 'tab-active' : 'tab'}
          >
            <Brain className="w-4 h-4" />
            AI Analysis
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Performance Table */}
            {results && results.results.length > 0 && (
              <div className="card-elevated p-6">
                <h3 className="text-lg font-bold text-content-primary mb-4">Bot Performance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-200">
                        <th className="text-left py-3 px-2 text-content-tertiary font-semibold">Rank</th>
                        <th className="text-left py-3 px-2 text-content-tertiary font-semibold">Strategy</th>
                        <th className="text-right py-3 px-2 text-content-tertiary font-semibold">Final Equity</th>
                        <th className="text-right py-3 px-2 text-content-tertiary font-semibold">P&L</th>
                        <th className="text-right py-3 px-2 text-content-tertiary font-semibold">Return %</th>
                        <th className="text-right py-3 px-2 text-content-tertiary font-semibold">Trades</th>
                        <th className="text-right py-3 px-2 text-content-tertiary font-semibold">Win Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.results.map((result, index) => (
                        <tr key={result.botId} className="border-b border-surface-100 hover:bg-surface-50">
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              index === 0 ? 'bg-yellow-100 text-yellow-700' :
                              index === 1 ? 'bg-slate-200 text-slate-700' :
                              index === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-surface-100 text-content-tertiary'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-2 font-semibold text-content-primary">{result.strategy}</td>
                          <td className="py-3 px-2 text-right font-medium text-content-primary">
                            {formatCurrency(result.finalEquity)}
                          </td>
                          <td className={`py-3 px-2 text-right font-bold ${result.totalProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {result.totalProfit >= 0 ? '+' : ''}{formatCurrency(result.totalProfit)}
                          </td>
                          <td className={`py-3 px-2 text-right font-bold ${result.returnPercent >= 0 ? 'text-success' : 'text-danger'}`}>
                            {result.returnPercent >= 0 ? '+' : ''}{result.returnPercent.toFixed(2)}%
                          </td>
                          <td className="py-3 px-2 text-right text-content-primary">{result.totalTrades}</td>
                          <td className="py-3 px-2 text-right">
                            <span className="font-medium text-content-primary">{result.winRate.toFixed(1)}%</span>
                            <span className="text-content-tertiary ml-1">({result.winningTrades}W/{result.losingTrades}L)</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bot Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {experiment.botsDetails?.map((bot) => {
                const botProfit = bot.metrics?.totalProfit || 0;
                const isProfit = botProfit >= 0;

                return (
                  <div key={bot.id} className="card-elevated p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-content-primary">{bot.strategy}</h4>
                        <p className="text-caption text-content-tertiary">{bot.id.slice(-8)}</p>
                      </div>
                      <span className={`badge ${bot.status === 'running' ? 'badge-success' : 'badge-info'}`}>
                        {bot.status}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-content-secondary">Equity:</span>
                        <span className="font-bold text-content-primary">
                          {formatCurrency(bot.metrics?.currentEquity || 100000)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-content-secondary">P&L:</span>
                        <span className={`font-bold ${isProfit ? 'text-success' : 'text-danger'}`}>
                          {isProfit ? '+' : ''}{formatCurrency(botProfit)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-content-secondary">Trades:</span>
                        <span className="font-semibold text-content-primary">
                          {bot.metrics?.totalTrades || 0} ({bot.metrics?.winningTrades || 0}W / {bot.metrics?.losingTrades || 0}L)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'trades' && (
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-content-primary">Trade Activity Log</h3>
              <span className="text-caption text-content-tertiary">{allTrades.length} total trades</span>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-xs text-content-tertiary font-semibold mb-1">Filter by Bot</label>
                <select
                  value={tradeFilter.botId}
                  onChange={(e) => { setTradeFilter({ ...tradeFilter, botId: e.target.value }); setTradePage(1); }}
                  className="input text-sm"
                >
                  <option value="all">All Bots</option>
                  {experiment.botsDetails?.map(bot => (
                    <option key={bot.id} value={bot.id}>{bot.strategy}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-content-tertiary font-semibold mb-1">Filter by Symbol</label>
                <select
                  value={tradeFilter.symbol}
                  onChange={(e) => { setTradeFilter({ ...tradeFilter, symbol: e.target.value }); setTradePage(1); }}
                  className="input text-sm"
                >
                  <option value="all">All Symbols</option>
                  {Array.from(new Set(allTrades.map(t => t.symbol))).sort().map(symbol => (
                    <option key={symbol} value={symbol}>{symbol}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Trade Table */}
            {allTrades.length === 0 ? (
              <div className="text-center py-12 text-content-secondary">
                No trades yet. The bots will execute trades based on their strategies.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-surface-200">
                        <th className="text-left py-3 px-2 text-content-tertiary font-semibold">Time</th>
                        <th className="text-left py-3 px-2 text-content-tertiary font-semibold">Bot/Strategy</th>
                        <th className="text-left py-3 px-2 text-content-tertiary font-semibold">Symbol</th>
                        <th className="text-center py-3 px-2 text-content-tertiary font-semibold">Side</th>
                        <th className="text-right py-3 px-2 text-content-tertiary font-semibold">Qty</th>
                        <th className="text-right py-3 px-2 text-content-tertiary font-semibold">Price</th>
                        <th className="text-right py-3 px-2 text-content-tertiary font-semibold">Value</th>
                        <th className="text-left py-3 px-2 text-content-tertiary font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPaginatedTrades().map((trade, index) => {
                        const price = parseFloat(trade.price) || 0;
                        const qty = parseFloat(trade.qty) || 0;
                        const tradeValue = qty * price;
                        const tradeDate = new Date(trade.time);

                        return (
                          <tr key={`${trade.botId}-${trade.time}-${index}`} className="border-b border-surface-100 hover:bg-surface-50">
                            <td className="py-3 px-2 text-content-secondary">
                              <div>{tradeDate.toLocaleDateString()}</div>
                              <div className="text-xs text-content-tertiary">{tradeDate.toLocaleTimeString()}</div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="font-semibold text-content-primary">{trade.bot_strategy || trade.botStrategy}</div>
                              <div className="text-xs text-content-tertiary">{(trade.bot_id || trade.botId || '').slice(-8)}</div>
                            </td>
                            <td className="py-3 px-2 font-bold text-content-primary">{trade.symbol}</td>
                            <td className="py-3 px-2 text-center">
                              <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${
                                trade.side === 'buy' ? 'bg-success-light text-success' : 'bg-danger-light text-danger'
                              }`}>
                                {trade.side.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right font-semibold text-content-primary">{qty}</td>
                            <td className="py-3 px-2 text-right font-bold text-content-primary">${price.toFixed(2)}</td>
                            <td className="py-3 px-2 text-right text-content-secondary">{formatCurrency(tradeValue)}</td>
                            <td className="py-3 px-2 text-content-tertiary text-xs">{trade.reason || 'Strategy signal'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-200">
                    <div className="text-sm text-content-secondary">
                      Showing {(tradePage - 1) * TRADES_PER_PAGE + 1}-{Math.min(tradePage * TRADES_PER_PAGE, getFilteredTrades().length)} of {getFilteredTrades().length} trades
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTradePage(p => Math.max(1, p - 1))}
                        disabled={tradePage === 1}
                        className="btn-secondary btn-sm disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Prev
                      </button>
                      <span className="px-3 text-sm text-content-secondary">
                        Page {tradePage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setTradePage(p => Math.min(totalPages, p + 1))}
                        disabled={tradePage === totalPages}
                        className="btn-secondary btn-sm disabled:opacity-50"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <AIAnalysisLog experimentId={experimentId} />
        )}
      </div>
    </DashboardLayout>
  );
}
