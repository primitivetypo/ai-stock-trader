'use client';

import { useState, useEffect } from 'react';
import { Eye, Plus, X, TrendingUp, TrendingDown, DollarSign, RefreshCw } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [levels, setLevels] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      const response = await api.get('/api/market/watchlist');
      setWatchlist(response.data);

      for (const symbol of response.data) {
        loadLevels(symbol);
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadLevels = async (symbol) => {
    try {
      const response = await api.get(`/api/market/levels/${symbol}`);
      setLevels((prev) => ({
        ...prev,
        [symbol]: response.data
      }));
    } catch (error) {
      console.log(`No levels available for ${symbol}`);
    }
  };

  const handleAddSymbol = async (e) => {
    e.preventDefault();

    if (!newSymbol) return;

    try {
      await api.post('/api/market/watchlist', {
        symbol: newSymbol.toUpperCase()
      });

      toast.success(`Added ${newSymbol.toUpperCase()} to watchlist`);
      setNewSymbol('');
      loadWatchlist();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add symbol');
    }
  };

  const handleRemoveSymbol = async (symbol) => {
    try {
      await api.delete(`/api/market/watchlist/${symbol}`);
      toast.success(`Removed ${symbol} from watchlist`);
      loadWatchlist();
    } catch (error) {
      toast.error('Failed to remove symbol');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadWatchlist();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-600 font-medium">Loading watchlist...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Watchlist</h1>
            <p className="text-slate-600 mt-1">
              Monitor symbols and support/resistance levels
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Add Symbol</h2>
          </div>
          <form onSubmit={handleAddSymbol} className="flex gap-3">
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              placeholder="Enter symbol (e.g., AAPL)"
              className="flex-1 input-primary"
            />
            <button
              type="submit"
              className="btn-primary flex items-center gap-2 px-8"
            >
              <Plus className="w-5 h-5" />
              Add
            </button>
          </form>
        </div>

        {watchlist.length === 0 ? (
          <div className="glass-card p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6">
                <Eye className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No symbols in watchlist</h3>
              <p className="text-slate-600 max-w-md">
                Add symbols above to start monitoring their support and resistance levels
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {watchlist.map((symbol) => {
              const symbolLevels = levels[symbol];

              return (
                <div
                  key={symbol}
                  className="glass-card p-6 relative group hover:shadow-2xl transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-2xl font-bold text-slate-900">{symbol}</h3>
                    <button
                      onClick={() => handleRemoveSymbol(symbol)}
                      className="p-2 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {symbolLevels ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-semibold text-slate-700">
                            Current Price
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">
                          ${symbolLevels.currentPrice.toFixed(2)}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="w-4 h-4 text-rose-600" />
                          <span className="text-sm font-semibold text-slate-700">
                            Resistance Levels
                          </span>
                        </div>
                        <div className="space-y-2">
                          {symbolLevels.resistance.map((level, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-slate-600">R{i + 1}</span>
                              <span className="font-bold text-rose-600">
                                ${level.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingDown className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-semibold text-slate-700">
                            Support Levels
                          </span>
                        </div>
                        <div className="space-y-2">
                          {symbolLevels.support.map((level, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-slate-600">S{i + 1}</span>
                              <span className="font-bold text-emerald-600">
                                ${level.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 text-center pt-2">
                        Updated: {new Date(symbolLevels.updatedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                        <span className="text-slate-600 text-sm font-medium">Loading levels...</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
