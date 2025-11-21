'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [levels, setLevels] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      const response = await api.get('/api/market/watchlist');
      setWatchlist(response.data);

      // Load support/resistance levels for each symbol
      for (const symbol of response.data) {
        loadLevels(symbol);
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    } finally {
      setLoading(false);
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
      // Symbol might not have data yet
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Watchlist</h1>
          <p className="text-slate-400 mt-1">
            Monitor symbols and support/resistance levels
          </p>
        </div>

        {/* Add Symbol Form */}
        <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
          <form onSubmit={handleAddSymbol} className="flex gap-4">
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              placeholder="Enter symbol (e.g., AAPL)"
              className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
            >
              Add Symbol
            </button>
          </form>
        </div>

        {/* Watchlist */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map((symbol) => {
            const symbolLevels = levels[symbol];

            return (
              <div
                key={symbol}
                className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-white">{symbol}</h3>
                  <button
                    onClick={() => handleRemoveSymbol(symbol)}
                    className="text-red-400 hover:text-red-300 text-xl"
                  >
                    ✕
                  </button>
                </div>

                {symbolLevels ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-slate-400 mb-1">
                        Current Price
                      </div>
                      <div className="text-xl font-semibold text-white">
                        ${symbolLevels.currentPrice.toFixed(2)}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-400 mb-1">
                        Resistance Levels
                      </div>
                      <div className="space-y-1">
                        {symbolLevels.resistance.map((level, i) => (
                          <div
                            key={i}
                            className="text-sm text-red-400 font-medium"
                          >
                            ${level.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-400 mb-1">
                        Support Levels
                      </div>
                      <div className="space-y-1">
                        {symbolLevels.support.map((level, i) => (
                          <div
                            key={i}
                            className="text-sm text-green-400 font-medium"
                          >
                            ${level.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 pt-2">
                      Updated:{' '}
                      {new Date(symbolLevels.updatedAt).toLocaleTimeString()}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 text-sm">
                    Loading levels...
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {watchlist.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <div className="text-6xl mb-4">👁️</div>
            <p className="text-xl">No symbols in watchlist</p>
            <p className="text-sm mt-2">Add symbols above to start monitoring</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
