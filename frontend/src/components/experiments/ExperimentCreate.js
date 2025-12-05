'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Sparkles, Store, TrendingUp, BarChart3, Zap, Target, LineChart } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ExperimentCreate({ onCreated }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState({});
  const [marketplaceStrategy, setMarketplaceStrategy] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    botCount: 5,
    selectedStrategies: [],
    watchlist: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'],
    duration: null,
    marketplaceStrategyId: null
  });

  useEffect(() => {
    fetchStrategies();

    // Check for marketplace strategy in URL params
    const strategyId = searchParams.get('strategyId');
    if (strategyId) {
      loadMarketplaceStrategy(strategyId);
    }
  }, [searchParams]);

  const fetchStrategies = async () => {
    try {
      const response = await api.get('/api/experiments/strategies');
      setStrategies(response.data);
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
      toast.error('Failed to load strategies');
    }
  };

  const loadMarketplaceStrategy = async (strategyId) => {
    try {
      const response = await api.get(`/api/strategies/${strategyId}`);
      const strategy = response.data;

      setMarketplaceStrategy(strategy);

      // Pre-populate form with marketplace strategy data
      setFormData({
        ...formData,
        name: `${strategy.title} Experiment`,
        watchlist: strategy.watchlist && strategy.watchlist.length > 0
          ? strategy.watchlist
          : formData.watchlist,
        selectedStrategies: [strategy.strategy_key],
        botCount: 1,
        marketplaceStrategyId: parseInt(strategyId)
      });

      // Record usage
      await api.post(`/api/strategies/${strategyId}/use`);

      toast.success(`Loaded strategy: ${strategy.title}`);
    } catch (error) {
      console.error('Failed to load marketplace strategy:', error);
      toast.error('Failed to load strategy from marketplace');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Auto-select strategies if none selected
      let selectedStrategies = formData.selectedStrategies;
      if (selectedStrategies.length === 0) {
        selectedStrategies = Object.keys(strategies).slice(0, formData.botCount);
      }

      if (selectedStrategies.length !== formData.botCount) {
        toast.error(`Please select exactly ${formData.botCount} strategies`);
        setLoading(false);
        return;
      }

      const response = await api.post('/api/experiments/create', {
        name: formData.name,
        botCount: parseInt(formData.botCount),
        strategies: selectedStrategies,
        watchlist: formData.watchlist,
        duration: formData.duration,
        marketplaceStrategyId: formData.marketplaceStrategyId
      });

      toast.success('Experiment created successfully!');
      if (onCreated) onCreated(response.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create experiment');
    } finally {
      setLoading(false);
    }
  };

  const toggleStrategy = (strategyKey) => {
    const newStrategies = formData.selectedStrategies.includes(strategyKey)
      ? formData.selectedStrategies.filter(s => s !== strategyKey)
      : [...formData.selectedStrategies, strategyKey];

    setFormData({ ...formData, selectedStrategies: newStrategies });
  };

  const autoSelectStrategies = () => {
    const selected = Object.keys(strategies).slice(0, formData.botCount);
    setFormData({ ...formData, selectedStrategies: selected });
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Create Experiment</h2>
          <p className="text-slate-600 mt-1">
            Set up autonomous trading bots to test different strategies
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/marketplace')}
          className="btn-secondary flex items-center gap-2"
        >
          <Store className="w-4 h-4" />
          Browse Marketplace
        </button>
      </div>

      {/* Marketplace Strategy Badge */}
      {marketplaceStrategy && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
          <div className="flex items-start gap-3">
            <div className="text-3xl">{marketplaceStrategy.category === 'Technology' ? '💻' : marketplaceStrategy.category === 'AI-Powered' ? '🤖' : '📈'}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-slate-900">{marketplaceStrategy.title}</h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                  Marketplace Strategy
                </span>
              </div>
              <p className="text-sm text-slate-600">{marketplaceStrategy.description}</p>
              <div className="flex gap-2 mt-2">
                <span className="text-xs text-green-600 font-semibold">
                  30d: {marketplaceStrategy.performance_30d > 0 ? '+' : ''}{marketplaceStrategy.performance_30d}%
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs text-slate-600">
                  {marketplaceStrategy.uses_count} users
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Experiment Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Experiment Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="input-primary"
            placeholder="e.g., High Volume Strategy Test"
            required
          />
          <p className="text-xs text-slate-500 mt-1">Give your experiment a descriptive name</p>
        </div>

        {/* Bot Count */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Number of Bots
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={formData.botCount}
            onChange={(e) => setFormData({ ...formData, botCount: parseInt(e.target.value), selectedStrategies: [] })}
            className="input-primary"
            required
          />
          <p className="text-xs text-slate-500 mt-1">Each bot gets $100,000 allocation</p>
        </div>

        {/* Strategy Selection */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-slate-700">
              Select {formData.botCount} Strategies
            </label>
            <button
              type="button"
              onClick={autoSelectStrategies}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Auto Select
            </button>
          </div>

          {/* Strategy Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(strategies).map(([key, strategy]) => {
              // Get category icon and color
              const getCategoryInfo = (cat) => {
                switch(cat) {
                  case 'momentum':
                  case 'trend':
                    return { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', label: 'Momentum' };
                  case 'mean-reversion':
                    return { icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Mean Reversion' };
                  case 'breakout':
                    return { icon: Zap, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Breakout' };
                  case 'reversal':
                    return { icon: Target, color: 'text-red-600', bg: 'bg-red-50', label: 'Reversal' };
                  case 'ai':
                    return { icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50', label: 'AI-Powered' };
                  default:
                    return { icon: LineChart, color: 'text-slate-600', bg: 'bg-slate-50', label: 'Strategy' };
                }
              };

              const catInfo = getCategoryInfo(strategy.category);
              const CategoryIcon = catInfo.icon;

              return (
                <div
                  key={key}
                  onClick={() => toggleStrategy(key)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                    formData.selectedStrategies.includes(key)
                      ? 'bg-blue-50 border-primary shadow-md ring-2 ring-primary/20'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg ${catInfo.bg}`}>
                          <CategoryIcon className={`w-4 h-4 ${catInfo.color}`} />
                        </div>
                        <h4 className="text-slate-900 font-semibold">{strategy.name}</h4>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catInfo.bg} ${catInfo.color}`}>
                          {catInfo.label}
                        </span>
                        {strategy.isAI && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium">
                            <Sparkles className="w-3 h-3" />
                            AI
                          </span>
                        )}
                        {strategy.useAdvancedStrategy && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                            Advanced
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{strategy.description}</p>
                      {strategy.isAI && (
                        <p className="text-xs text-purple-600 mt-2 font-medium">
                          Powered by Google Gemini • Real-time news analysis
                        </p>
                      )}
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ml-3 ${
                      formData.selectedStrategies.includes(key)
                        ? 'bg-primary border-primary'
                        : 'border-slate-300'
                    }`}>
                      {formData.selectedStrategies.includes(key) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Selected: {formData.selectedStrategies.length} / {formData.botCount} strategies
            {formData.selectedStrategies.length !== formData.botCount && (
              <span className="text-amber-600 ml-2">
                • Please select exactly {formData.botCount} strategies
              </span>
            )}
          </p>
        </div>

        {/* Watchlist */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Watchlist (comma-separated)
          </label>
          <input
            type="text"
            value={formData.watchlist.join(', ')}
            onChange={(e) => setFormData({
              ...formData,
              watchlist: e.target.value.split(',').map(s => s.trim()).filter(s => s)
            })}
            className="input-primary"
            placeholder="AAPL, TSLA, NVDA"
            required
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || formData.selectedStrategies.length !== formData.botCount}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Experiment'}
        </button>
      </form>
    </div>
  );
}
