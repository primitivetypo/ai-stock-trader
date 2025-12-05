'use client';

import { useState, useEffect } from 'react';
import { Eye, Plus, X, TrendingUp, TrendingDown, Search, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [levels, setLevels] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadWatchlist();

    const refreshInterval = setInterval(() => {
      if (!refreshing) {
        refreshPrices();
      }
    }, 10000);

    return () => clearInterval(refreshInterval);
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

  const refreshPrices = async () => {
    if (watchlist.length === 0) return;

    try {
      for (const symbol of watchlist) {
        const response = await api.get(`/api/market/levels/${symbol}`);
        setLevels((prev) => ({
          ...prev,
          [symbol]: response.data
        }));
      }
    } catch (error) {
      console.error('Background price refresh failed:', error);
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

  const handleSearchSymbol = async (query) => {
    setNewSymbol(query);

    if (query.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    try {
      const response = await api.get(`/api/market/search?q=${encodeURIComponent(query)}&limit=10`);
      setSearchResults(response.data);
      setShowDropdown(true);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    }
  };

  const selectSymbol = (symbol) => {
    setNewSymbol(symbol);
    setShowDropdown(false);
    setSearchResults([]);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-body text-content-secondary">Loading watchlist...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="page-header mb-0">
            <h1 className="page-title">Watchlist</h1>
            <p className="page-subtitle">Monitor symbols and support/resistance levels</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-caption text-success font-medium">Auto-updating every 10s</span>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Add Symbol Form */}
        <div className="card-elevated p-6">
          <div className="section-header">
            <h3 className="section-title">Add Symbol</h3>
          </div>
          <form onSubmit={handleAddSymbol} className="flex gap-3">
            <div className="flex-1 relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
                <input
                  type="text"
                  value={newSymbol}
                  onChange={(e) => handleSearchSymbol(e.target.value)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Search for a symbol (e.g., AAPL)"
                  className="input input-with-icon"
                  autoComplete="off"
                />
              </div>
              {showDropdown && searchResults.length > 0 && (
                <div className="dropdown max-h-72 overflow-y-auto scrollbar-thin">
                  {searchResults.map((asset) => (
                    <button
                      key={asset.symbol}
                      type="button"
                      onClick={() => selectSymbol(asset.symbol)}
                      className="dropdown-item w-full flex items-center justify-between"
                    >
                      <div className="text-left">
                        <div className="font-semibold text-content-primary">{asset.symbol}</div>
                        <div className="text-caption text-content-tertiary">{asset.name}</div>
                      </div>
                      <span className="badge-default">{asset.exchange}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" className="btn-primary">
              <Plus className="w-4 h-4" />
              Add
            </button>
          </form>
        </div>

        {/* Watchlist Grid */}
        {watchlist.length === 0 ? (
          <div className="card-elevated p-6">
            <div className="empty-state py-12">
              <div className="empty-state-icon">
                <Eye className="w-7 h-7 text-content-tertiary" />
              </div>
              <p className="empty-state-title">No symbols in watchlist</p>
              <p className="empty-state-text">
                Add symbols above to start monitoring their support and resistance levels
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlist.map((symbol) => {
              const symbolLevels = levels[symbol];

              return (
                <div key={symbol} className="card-elevated p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 font-bold">
                        {symbol.slice(0, 2)}
                      </div>
                      <h3 className="text-heading font-bold text-content-primary">{symbol}</h3>
                    </div>
                    <button
                      onClick={() => handleRemoveSymbol(symbol)}
                      className="btn-icon text-danger hover:bg-danger-light"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {symbolLevels ? (
                    <div className="space-y-4">
                      {/* Current Price */}
                      <div className="p-4 rounded-lg bg-brand-50 border border-brand-100">
                        <p className="text-caption text-content-secondary mb-1">Current Price</p>
                        <p className="text-heading-lg font-bold text-content-primary tabular-nums">
                          ${symbolLevels.currentPrice.toFixed(2)}
                        </p>
                      </div>

                      {/* Resistance Levels */}
                      <div className="p-4 rounded-lg bg-danger-light/50 border border-danger/10">
                        <div className="flex items-center gap-2 mb-3">
                          <ArrowUpRight className="w-4 h-4 text-danger" />
                          <span className="text-caption font-semibold text-content-secondary">
                            Resistance Levels
                          </span>
                        </div>
                        <div className="space-y-2">
                          {symbolLevels.resistance.map((level, i) => (
                            <div key={i} className="flex items-center justify-between text-caption">
                              <span className="text-content-tertiary">R{i + 1}</span>
                              <span className="font-bold text-danger tabular-nums">
                                ${level.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Support Levels */}
                      <div className="p-4 rounded-lg bg-success-light/50 border border-success/10">
                        <div className="flex items-center gap-2 mb-3">
                          <ArrowDownRight className="w-4 h-4 text-success" />
                          <span className="text-caption font-semibold text-content-secondary">
                            Support Levels
                          </span>
                        </div>
                        <div className="space-y-2">
                          {symbolLevels.support.map((level, i) => (
                            <div key={i} className="flex items-center justify-between text-caption">
                              <span className="text-content-tertiary">S{i + 1}</span>
                              <span className="font-bold text-success tabular-nums">
                                ${level.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="text-tiny text-content-tertiary text-center">
                        Updated: {new Date(symbolLevels.updatedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-surface-300 border-t-brand-500 rounded-full animate-spin" />
                        <span className="text-caption text-content-tertiary">Loading levels...</span>
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
