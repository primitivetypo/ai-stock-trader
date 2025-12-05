'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, List, Plus, Zap, Target, TrendingUp, Shield, Activity, ChevronDown, ChevronUp, DollarSign, Sparkles } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ExperimentCreate from '@/components/experiments/ExperimentCreate';
import ExperimentList from '@/components/experiments/ExperimentList';

const strategies = [
  {
    title: 'Volume Spike',
    description: 'Detects abnormal volume and enters near support levels',
    risk: 'Medium',
    color: 'brand'
  },
  {
    title: 'Mean Reversion',
    description: 'Buys oversold (RSI < 30), sells overbought (RSI > 70)',
    risk: 'Medium',
    color: 'success'
  },
  {
    title: 'Breakout',
    description: 'Trades price breakouts with volume confirmation',
    risk: 'High',
    color: 'warning'
  },
  {
    title: 'S/R Bounce',
    description: 'Enters at support, exits at resistance',
    risk: 'Low',
    color: 'brand'
  },
  {
    title: 'AI News Trader',
    description: 'Uses AI to analyze breaking news sentiment',
    risk: 'High',
    color: 'danger'
  }
];

export default function ExperimentsPage() {
  const router = useRouter();
  const [view, setView] = useState('list');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
    }
  }, [router]);

  const handleExperimentCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    setView('list');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="page-header mb-0">
            <h1 className="page-title">Experiments</h1>
            <p className="page-subtitle">Run autonomous trading bots with different strategies</p>
          </div>
          <button
            onClick={() => setView(view === 'create' ? 'list' : 'create')}
            className={view === 'create' ? 'btn-secondary' : 'btn-primary'}
          >
            {view === 'create' ? (
              <>
                <List className="w-4 h-4" />
                View List
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                New Experiment
              </>
            )}
          </button>
        </div>

        {/* View Toggle Tabs */}
        <div className="tabs w-fit">
          <button
            onClick={() => setView('list')}
            className={view === 'list' ? 'tab-active' : 'tab'}
          >
            <List className="w-4 h-4" />
            My Experiments
          </button>
          <button
            onClick={() => setView('create')}
            className={view === 'create' ? 'tab-active' : 'tab'}
          >
            <Plus className="w-4 h-4" />
            Create New
          </button>
        </div>

        {/* Content */}
        {view === 'list' && (
          <ExperimentList refreshTrigger={refreshTrigger} />
        )}

        {view === 'create' && (
          <ExperimentCreate onCreated={handleExperimentCreated} />
        )}

        {/* Info Section */}
        {view === 'list' && (
          <div className="space-y-4">
            {/* How It Works */}
            <div className="card-elevated overflow-hidden">
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="w-full p-5 flex items-center justify-between hover:bg-surface-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-brand-50">
                    <FlaskConical className="w-5 h-5 text-brand-500" />
                  </div>
                  <span className="text-heading font-semibold text-content-primary">How Experiments Work</span>
                </div>
                {showInfo ? (
                  <ChevronUp className="w-5 h-5 text-content-tertiary" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-content-tertiary" />
                )}
              </button>
              {showInfo && (
                <div className="px-5 pb-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-brand-50 border border-brand-100">
                    <DollarSign className="w-5 h-5 text-brand-500 flex-shrink-0" />
                    <p className="text-caption text-content-secondary">Each bot gets $100,000 virtual allocation</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-success-light border border-success/20">
                    <Zap className="w-5 h-5 text-success flex-shrink-0" />
                    <p className="text-caption text-content-secondary">Bots run autonomously with assigned strategy</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-warning-light border border-warning/20">
                    <Activity className="w-5 h-5 text-warning flex-shrink-0" />
                    <p className="text-caption text-content-secondary">All bots trade from your watchlist symbols</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-brand-50 border border-brand-100">
                    <Target className="w-5 h-5 text-brand-500 flex-shrink-0" />
                    <p className="text-caption text-content-secondary">Compare performance in real-time</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-danger-light border border-danger/20">
                    <Shield className="w-5 h-5 text-danger flex-shrink-0" />
                    <p className="text-caption text-content-secondary">All trading is simulated - no real money</p>
                  </div>
                </div>
              )}
            </div>

            {/* Strategy Cards */}
            <div className="card-elevated p-5">
              <div className="section-header">
                <h3 className="section-title flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-500" />
                  Available Strategies
                </h3>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {strategies.map((strategy) => (
                  <div
                    key={strategy.title}
                    className="p-4 rounded-lg bg-surface-50 border border-surface-200 hover:border-brand-200 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-brand-500" />
                      <h4 className="text-body font-semibold text-content-primary">{strategy.title}</h4>
                    </div>
                    <p className="text-caption text-content-secondary mb-3">{strategy.description}</p>
                    <span className={`badge ${
                      strategy.risk === 'Low' ? 'badge-success' :
                      strategy.risk === 'Medium' ? 'badge-warning' : 'badge-danger'
                    }`}>
                      {strategy.risk} Risk
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
