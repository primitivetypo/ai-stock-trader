'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export default function ExperimentCreate({ onCreated }) {
  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState({});
  const [formData, setFormData] = useState({
    botCount: 5,
    selectedStrategies: [],
    watchlist: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'],
    duration: null
  });

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    try {
      const response = await api.get('/api/experiments/strategies');
      setStrategies(response.data);
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
      toast.error('Failed to load strategies');
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
        botCount: parseInt(formData.botCount),
        strategies: selectedStrategies,
        watchlist: formData.watchlist,
        duration: formData.duration
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
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Create Experiment</h2>
      <p className="text-slate-400 mb-6">
        Set up autonomous trading bots to test different strategies
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bot Count */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Number of Bots
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={formData.botCount}
            onChange={(e) => setFormData({ ...formData, botCount: parseInt(e.target.value), selectedStrategies: [] })}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
          <p className="text-xs text-slate-500 mt-1">Each bot gets $100,000 allocation</p>
        </div>

        {/* Strategy Selection */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-slate-300">
              Select {formData.botCount} Strategies
            </label>
            <button
              type="button"
              onClick={autoSelectStrategies}
              className="text-xs text-primary-400 hover:text-primary-300"
            >
              Auto Select
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(strategies).map(([key, strategy]) => (
              <div
                key={key}
                onClick={() => toggleStrategy(key)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  formData.selectedStrategies.includes(key)
                    ? 'bg-primary-900/30 border-primary-500'
                    : 'bg-slate-900 border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-white font-medium">{strategy.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">{strategy.description}</p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    formData.selectedStrategies.includes(key)
                      ? 'bg-primary-500 border-primary-500'
                      : 'border-slate-600'
                  }`}>
                    {formData.selectedStrategies.includes(key) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Selected: {formData.selectedStrategies.length} / {formData.botCount}
          </p>
        </div>

        {/* Watchlist */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Watchlist (comma-separated)
          </label>
          <input
            type="text"
            value={formData.watchlist.join(', ')}
            onChange={(e) => setFormData({
              ...formData,
              watchlist: e.target.value.split(',').map(s => s.trim()).filter(s => s)
            })}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="AAPL, TSLA, NVDA"
            required
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || formData.selectedStrategies.length !== formData.botCount}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Experiment'}
        </button>
      </form>
    </div>
  );
}
