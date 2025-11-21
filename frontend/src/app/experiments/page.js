'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ExperimentCreate from '@/components/experiments/ExperimentCreate';
import ExperimentList from '@/components/experiments/ExperimentList';
import ExperimentDetails from '@/components/experiments/ExperimentDetails';

export default function ExperimentsPage() {
  const router = useRouter();
  const [view, setView] = useState('list'); // 'list', 'create', 'details'
  const [selectedExperimentId, setSelectedExperimentId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
    }
  }, [router]);

  const handleExperimentCreated = (experiment) => {
    setRefreshTrigger(prev => prev + 1);
    setView('list');
  };

  const handleSelectExperiment = (experimentId) => {
    setSelectedExperimentId(experimentId);
    setView('details');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Trading Experiments</h1>
              <p className="text-slate-400">
                Run autonomous trading bots with different strategies and compare their performance
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </div>

          {/* View Toggle */}
          {view !== 'details' && (
            <div className="flex gap-2">
              <button
                onClick={() => setView('list')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  view === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                My Experiments
              </button>
              <button
                onClick={() => setView('create')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  view === 'create'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Create New
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {view === 'list' && (
          <ExperimentList
            onSelectExperiment={handleSelectExperiment}
            refreshTrigger={refreshTrigger}
          />
        )}

        {view === 'create' && (
          <ExperimentCreate onCreated={handleExperimentCreated} />
        )}

        {view === 'details' && selectedExperimentId && (
          <ExperimentDetails
            experimentId={selectedExperimentId}
            onBack={() => {
              setView('list');
              setRefreshTrigger(prev => prev + 1);
            }}
          />
        )}

        {/* Info Card */}
        <div className="mt-8 bg-primary-900/30 backdrop-blur-sm p-6 rounded-lg border border-primary-700">
          <h3 className="text-lg font-semibold text-white mb-3">How Experiments Work</h3>
          <div className="space-y-2 text-sm text-slate-300">
            <p>• Each bot gets a $100,000 virtual allocation</p>
            <p>• Bots run autonomously based on their assigned strategy</p>
            <p>• All bots trade from the same watchlist you configure</p>
            <p>• Strategies include: Volume Spike, Momentum, Mean Reversion, Breakout, and Support/Resistance</p>
            <p>• Compare performance in real-time to see which strategy works best</p>
            <p>• All trading is simulated - no real money is used</p>
          </div>
        </div>

        {/* Available Strategies Info */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h4 className="text-white font-semibold mb-2">Volume Spike</h4>
            <p className="text-xs text-slate-400">
              Detects abnormal volume spikes and enters positions near support levels, exits at resistance
            </p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h4 className="text-white font-semibold mb-2">Momentum</h4>
            <p className="text-xs text-slate-400">
              Uses moving average crossovers to identify trend direction and ride momentum
            </p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h4 className="text-white font-semibold mb-2">Mean Reversion</h4>
            <p className="text-xs text-slate-400">
              Buys oversold conditions (RSI {'<'} 30) and sells overbought (RSI {'>'} 70)
            </p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h4 className="text-white font-semibold mb-2">Breakout</h4>
            <p className="text-xs text-slate-400">
              Trades price breakouts above resistance with volume confirmation
            </p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h4 className="text-white font-semibold mb-2">Support/Resistance</h4>
            <p className="text-xs text-slate-400">
              Enters at support levels and exits at resistance levels
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
