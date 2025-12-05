'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Trash2, Play, Square, ChevronRight, FlaskConical, TrendingUp, TrendingDown, Clock } from 'lucide-react';

export default function ExperimentList({ refreshTrigger }) {
  const router = useRouter();
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

  const deleteExperiment = async (experimentId) => {
    if (!window.confirm('Are you sure you want to delete this experiment?')) {
      return;
    }

    try {
      await api.delete(`/api/experiments/${experimentId}`);
      toast.success('Experiment deleted!');
      fetchExperiments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete experiment');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running':
        return <span className="badge-success flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />Running</span>;
      case 'stopped':
        return <span className="badge-danger">Stopped</span>;
      default:
        return <span className="badge-brand">Created</span>;
    }
  };

  const calculateTotalProfit = (bots) => {
    return bots.reduce((sum, bot) => sum + (bot.totalProfit || 0), 0);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="card-elevated p-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-body text-content-secondary">Loading experiments...</p>
          </div>
        </div>
      </div>
    );
  }

  if (experiments.length === 0) {
    return (
      <div className="card-elevated p-6">
        <div className="empty-state py-12">
          <div className="empty-state-icon">
            <FlaskConical className="w-7 h-7 text-content-tertiary" />
          </div>
          <p className="empty-state-title">No experiments yet</p>
          <p className="empty-state-text">
            Create your first experiment to start testing trading strategies
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {experiments.map((experiment) => {
        const totalProfit = calculateTotalProfit(experiment.bots);
        const isProfit = totalProfit >= 0;

        return (
          <div key={experiment.id} className="card-elevated p-5 hover:shadow-md transition-all">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-heading font-bold text-content-primary">
                    {experiment.name || experiment.id}
                  </h3>
                  {getStatusBadge(experiment.status)}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-caption text-content-secondary">
                  <div className="flex items-center gap-1.5">
                    <FlaskConical className="w-4 h-4" />
                    <span>{experiment.botCount} Bots</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>Started {new Date(experiment.startTime).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {experiment.status === 'created' && (
                  <button
                    onClick={() => startExperiment(experiment.id)}
                    className="btn-success btn-sm"
                  >
                    <Play className="w-4 h-4" />
                    Start
                  </button>
                )}
                {experiment.status === 'running' && (
                  <button
                    onClick={() => stopExperiment(experiment.id)}
                    className="btn-danger btn-sm"
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                )}
                <button
                  onClick={() => router.push(`/experiments/${experiment.id}`)}
                  className="btn-primary btn-sm"
                >
                  Details
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteExperiment(experiment.id)}
                  className="btn-icon text-content-secondary hover:text-danger hover:bg-danger-light"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bots Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-4">
              {experiment.bots.map((bot) => {
                const botProfit = bot.totalProfit || 0;
                const isBotProfit = botProfit >= 0;

                return (
                  <div key={bot.id} className="p-3 rounded-lg bg-surface-50 border border-surface-100">
                    <p className="text-caption text-content-secondary truncate mb-1">{bot.strategy}</p>
                    <div className={`flex items-center gap-1 ${isBotProfit ? 'text-success' : 'text-danger'}`}>
                      {isBotProfit ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      <span className="text-body font-bold tabular-nums">
                        {formatCurrency(botProfit)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total P&L */}
            <div className="mt-4 pt-4 border-t border-surface-100">
              <div className="flex items-center justify-between">
                <span className="text-caption text-content-secondary">Total P&L</span>
                <div className={`flex items-center gap-2 ${isProfit ? 'text-success' : 'text-danger'}`}>
                  {isProfit ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="text-heading font-bold tabular-nums">
                    {isProfit ? '+' : ''}{formatCurrency(totalProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
