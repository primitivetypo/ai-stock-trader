'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, List, Plus, ArrowLeft, Zap, Target, TrendingUp, Shield, Activity } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ExperimentCreate from '@/components/experiments/ExperimentCreate';
import ExperimentList from '@/components/experiments/ExperimentList';
import ExperimentDetails from '@/components/experiments/ExperimentDetails';

export default function ExperimentsPage() {
  const router = useRouter();
  const [view, setView] = useState('list');
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
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Trading Experiments</h1>
            <p className="text-slate-600 mt-1">
              Run autonomous trading bots with different strategies
            </p>
          </div>
          {view === 'details' && (
            <button
              onClick={() => {
                setView('list');
                setRefreshTrigger(prev => prev + 1);
              }}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to List
            </button>
          )}
        </div>

        {/* View Toggle */}
        {view !== 'details' && (
          <div className="flex gap-3">
            <button
              onClick={() => setView('list')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                view === 'list'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-white/60 text-slate-700 border border-slate-200 hover:bg-white'
              }`}
            >
              <List className="w-5 h-5" />
              My Experiments
            </button>
            <button
              onClick={() => setView('create')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                view === 'create'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-white/60 text-slate-700 border border-slate-200 hover:bg-white'
              }`}
            >
              <Plus className="w-5 h-5" />
              Create New
            </button>
          </div>
        )}

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

        {/* Info Cards */}
        {view === 'list' && (
          <>
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg">
                  <FlaskConical className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">How Experiments Work</h3>
              </div>
              <div className="grid gap-3 text-sm text-slate-700">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50">
                  <DollarSign className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p>Each bot gets a $100,000 virtual allocation to trade with</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-indigo-50/50">
                  <Zap className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <p>Bots run autonomously based on their assigned trading strategy</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-50/50">
                  <Activity className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <p>All bots trade from the same watchlist that you configure</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50/50">
                  <Target className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p>Compare performance in real-time to find the best strategy</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50/50">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p>All trading is simulated - no real money is used</p>
                </div>
              </div>
            </div>

            {/* Strategy Cards */}
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">Available Strategies</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StrategyCard
                  title="Volume Spike"
                  description="Detects abnormal volume spikes and enters positions near support levels, exits at resistance"
                  gradient="from-blue-500 to-cyan-500"
                />
                <StrategyCard
                  title="Momentum"
                  description="Uses moving average crossovers to identify trend direction and ride momentum"
                  gradient="from-emerald-500 to-teal-500"
                />
                <StrategyCard
                  title="Mean Reversion"
                  description="Buys oversold conditions (RSI < 30) and sells overbought (RSI > 70)"
                  gradient="from-indigo-500 to-purple-500"
                />
                <StrategyCard
                  title="Breakout"
                  description="Trades price breakouts above resistance with volume confirmation"
                  gradient="from-amber-500 to-orange-500"
                />
                <StrategyCard
                  title="Support/Resistance"
                  description="Enters at support levels and exits at resistance levels"
                  gradient="from-rose-500 to-pink-500"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StrategyCard({ title, description, gradient }) {
  return (
    <div className="glass-card p-5 group hover:shadow-xl transition-all duration-300">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
        <TrendingUp className="w-6 h-6 text-white" />
      </div>
      <h4 className="text-slate-900 font-bold mb-2 text-lg">{title}</h4>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function DollarSign({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
