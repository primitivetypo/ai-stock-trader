'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export default function ExperimentList({ onSelectExperiment, refreshTrigger }) {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExperiments();
  }, [refreshTrigger]);

  const fetchExperiments = async () => {
    try {
      const response = await api.get('/api/experiments');
      setExperiments(response.data);
    } catch (error) {
      console.error('Failed to fetch experiments:', error);
      toast.error('Failed to load experiments');
    } finally {
      setLoading(false);
    }
  };

  const startExperiment = async (experimentId) => {
    try {
      await api.post(`/api/experiments/${experimentId}/start`);
      toast.success('Experiment started!');
      fetchExperiments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start experiment');
    }
  };

  const stopExperiment = async (experimentId) => {
    try {
      await api.post(`/api/experiments/${experimentId}/stop`);
      toast.success('Experiment stopped!');
      fetchExperiments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to stop experiment');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      created: 'bg-slate-600 text-slate-200',
      running: 'bg-green-600 text-white',
      stopped: 'bg-red-600 text-white'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[status] || badges.created}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const calculateTotalProfit = (bots) => {
    return bots.reduce((sum, bot) => sum + (bot.totalProfit || 0), 0);
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
        <p className="text-slate-400">Loading experiments...</p>
      </div>
    );
  }

  if (experiments.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
        <p className="text-slate-400">No experiments yet. Create one to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {experiments.map((experiment) => (
        <div
          key={experiment.id}
          className="bg-slate-800/50 backdrop-blur-sm p-4 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-white">{experiment.id}</h3>
                {getStatusBadge(experiment.status)}
              </div>
              <div className="text-sm text-slate-400 space-y-1">
                <p>Bots: {experiment.botCount}</p>
                <p>Started: {new Date(experiment.startTime).toLocaleString()}</p>
                {experiment.endTime && (
                  <p>Ended: {new Date(experiment.endTime).toLocaleString()}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {experiment.status === 'created' && (
                <button
                  onClick={() => startExperiment(experiment.id)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Start
                </button>
              )}
              {experiment.status === 'running' && (
                <button
                  onClick={() => stopExperiment(experiment.id)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Stop
                </button>
              )}
              <button
                onClick={() => onSelectExperiment(experiment.id)}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                View Details
              </button>
            </div>
          </div>

          {/* Bots Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            {experiment.bots.map((bot) => (
              <div key={bot.id} className="bg-slate-900/50 p-2 rounded border border-slate-700">
                <p className="text-xs text-slate-400 truncate">{bot.strategy}</p>
                <p className={`text-sm font-semibold ${
                  bot.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  ${bot.totalProfit?.toFixed(2) || '0.00'}
                </p>
              </div>
            ))}
          </div>

          {/* Total P&L */}
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Total P&L:</span>
              <span className={`text-lg font-bold ${
                calculateTotalProfit(experiment.bots) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${calculateTotalProfit(experiment.bots).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
