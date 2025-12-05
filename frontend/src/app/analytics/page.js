'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  Target,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Package,
  FileText,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';

export default function Analytics() {
  const [statistics, setStatistics] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [statsRes, perfRes] = await Promise.all([
        api.get('/api/analytics/statistics'),
        api.get('/api/analytics/performance')
      ]);

      setStatistics(statsRes.data);
      setPerformance(perfRes.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-body text-content-secondary">Loading analytics...</p>
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
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">Performance metrics and trading statistics</p>
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

        {/* Key Metrics */}
        {statistics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="metric-card group">
              <div className="flex items-start justify-between mb-3">
                <span className="metric-label">Total Trades</span>
                <div className="p-2 rounded-lg bg-brand-50 text-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>
              <div className="metric-value tabular-nums">{statistics.totalTrades}</div>
            </div>

            <div className="metric-card group">
              <div className="flex items-start justify-between mb-3">
                <span className="metric-label">Win Rate</span>
                <div className={`p-2 rounded-lg transition-colors ${
                  statistics.winRate >= 50
                    ? 'bg-success-light text-success group-hover:bg-success group-hover:text-white'
                    : 'bg-danger-light text-danger group-hover:bg-danger group-hover:text-white'
                }`}>
                  <Target className="w-4 h-4" />
                </div>
              </div>
              <div className={`metric-value tabular-nums ${statistics.winRate >= 50 ? 'text-success' : 'text-danger'}`}>
                {statistics.winRate.toFixed(1)}%
              </div>
              <p className="text-caption text-content-secondary mt-1">
                {statistics.wins}W / {statistics.losses}L
              </p>
            </div>

            <div className="metric-card group">
              <div className="flex items-start justify-between mb-3">
                <span className="metric-label">Total P&L</span>
                <div className={`p-2 rounded-lg transition-colors ${
                  statistics.totalProfit >= 0
                    ? 'bg-success-light text-success group-hover:bg-success group-hover:text-white'
                    : 'bg-danger-light text-danger group-hover:bg-danger group-hover:text-white'
                }`}>
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className={`metric-value tabular-nums ${statistics.totalProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                {statistics.totalProfit >= 0 ? '+' : ''}{formatCurrency(statistics.totalProfit)}
              </div>
            </div>

            <div className="metric-card group">
              <div className="flex items-start justify-between mb-3">
                <span className="metric-label">Avg P&L/Trade</span>
                <div className={`p-2 rounded-lg transition-colors ${
                  statistics.avgProfitPerTrade >= 0
                    ? 'bg-success-light text-success group-hover:bg-success group-hover:text-white'
                    : 'bg-danger-light text-danger group-hover:bg-danger group-hover:text-white'
                }`}>
                  {statistics.avgProfitPerTrade >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                </div>
              </div>
              <div className={`metric-value tabular-nums ${statistics.avgProfitPerTrade >= 0 ? 'text-success' : 'text-danger'}`}>
                {statistics.avgProfitPerTrade >= 0 ? '+' : ''}{formatCurrency(statistics.avgProfitPerTrade)}
              </div>
            </div>
          </div>
        )}

        {/* Performance Details */}
        {performance && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Account Status */}
            <div className="card-elevated p-6">
              <div className="section-header">
                <h3 className="section-title flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-brand-500" />
                  Account Status
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 px-4 rounded-lg bg-surface-50 border border-surface-100">
                  <span className="text-body text-content-secondary">Equity</span>
                  <span className="text-body font-bold text-content-primary tabular-nums">
                    {formatCurrency(performance.account.equity)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 rounded-lg bg-surface-50 border border-surface-100">
                  <span className="text-body text-content-secondary">Cash</span>
                  <span className="text-body font-bold text-content-primary tabular-nums">
                    {formatCurrency(performance.account.cash)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 rounded-lg bg-surface-50 border border-surface-100">
                  <span className="text-body text-content-secondary">Buying Power</span>
                  <span className="text-body font-bold text-content-primary tabular-nums">
                    {formatCurrency(performance.account.buyingPower)}
                  </span>
                </div>
              </div>
            </div>

            {/* Trading Activity */}
            <div className="card-elevated p-6">
              <div className="section-header">
                <h3 className="section-title flex items-center gap-2">
                  <Activity className="w-5 h-5 text-success" />
                  Trading Activity
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 px-4 rounded-lg bg-surface-50 border border-surface-100">
                  <span className="text-body text-content-secondary flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Open Positions
                  </span>
                  <span className="text-body font-bold text-content-primary tabular-nums">
                    {performance.positions.count}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 rounded-lg bg-surface-50 border border-surface-100">
                  <span className="text-body text-content-secondary flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Total Orders
                  </span>
                  <span className="text-body font-bold text-content-primary tabular-nums">
                    {performance.orders.total}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 rounded-lg bg-surface-50 border border-surface-100">
                  <span className="text-body text-content-secondary">Open Orders</span>
                  <span className="badge-warning">{performance.orders.open}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 rounded-lg bg-surface-50 border border-surface-100">
                  <span className="text-body text-content-secondary">Filled Orders</span>
                  <span className="badge-success">{performance.orders.filled}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Simulation Metrics */}
        {performance?.simulation && (
          <div className="card-elevated p-6">
            <div className="section-header">
              <h3 className="section-title flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-brand-500" />
                Simulation Metrics
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-lg bg-brand-50 border border-brand-100">
                <p className="text-caption font-medium text-content-secondary mb-2">
                  Total Simulated Trades
                </p>
                <p className="text-heading-lg font-bold text-content-primary tabular-nums">
                  {performance.simulation.totalTrades || 0}
                </p>
              </div>
              <div className="p-5 rounded-lg bg-success-light border border-success/20">
                <p className="text-caption font-medium text-content-secondary mb-2">
                  Filled Trades
                </p>
                <p className="text-heading-lg font-bold text-success-dark tabular-nums">
                  {performance.simulation.filledTrades || 0}
                </p>
              </div>
              <div className="p-5 rounded-lg bg-warning-light border border-warning/20">
                <p className="text-caption font-medium text-content-secondary mb-2">
                  Avg Slippage
                </p>
                <p className="text-heading-lg font-bold text-warning-dark tabular-nums">
                  {((performance.simulation.avgSlippage || 0) * 100).toFixed(3)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
