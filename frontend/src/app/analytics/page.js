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
  FileText
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';

export default function Analytics() {
  const [statistics, setStatistics] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);

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
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-600 font-medium">Loading analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-600 mt-1">
            Performance metrics and trading statistics
          </p>
        </div>

        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Trades"
              value={statistics.totalTrades}
              icon={BarChart3}
              gradient="from-blue-500 to-cyan-500"
            />
            <StatCard
              title="Win Rate"
              value={`${statistics.winRate.toFixed(1)}%`}
              subtitle={`${statistics.wins}W / ${statistics.losses}L`}
              icon={Target}
              gradient="from-emerald-500 to-teal-500"
              isPositive={statistics.winRate >= 50}
            />
            <StatCard
              title="Total P&L"
              value={`$${statistics.totalProfit.toFixed(2)}`}
              icon={DollarSign}
              gradient="from-indigo-500 to-purple-500"
              isPositive={statistics.totalProfit >= 0}
            />
            <StatCard
              title="Avg P&L/Trade"
              value={`$${statistics.avgProfitPerTrade.toFixed(2)}`}
              icon={statistics.avgProfitPerTrade >= 0 ? TrendingUp : TrendingDown}
              gradient="from-amber-500 to-orange-500"
              isPositive={statistics.avgProfitPerTrade >= 0}
            />
          </div>
        )}

        {performance && (
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Performance Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  Account Status
                </h3>
                <div className="space-y-3">
                  <DetailRow
                    label="Equity"
                    value={`$${performance.account.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
                  <DetailRow
                    label="Cash"
                    value={`$${performance.account.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
                  <DetailRow
                    label="Buying Power"
                    value={`$${performance.account.buyingPower.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  Trading Activity
                </h3>
                <div className="space-y-3">
                  <DetailRow
                    label="Open Positions"
                    value={performance.positions.count}
                    icon={Package}
                  />
                  <DetailRow
                    label="Total Orders"
                    value={performance.orders.total}
                    icon={FileText}
                  />
                  <DetailRow
                    label="Open Orders"
                    value={performance.orders.open}
                  />
                  <DetailRow
                    label="Filled Orders"
                    value={performance.orders.filled}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {performance?.simulation && (
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Simulation Metrics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                <div className="text-sm font-semibold text-slate-700 mb-2">
                  Total Simulated Trades
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {performance.simulation.totalTrades || 0}
                </div>
              </div>
              <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
                <div className="text-sm font-semibold text-slate-700 mb-2">
                  Filled Trades
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {performance.simulation.filledTrades || 0}
                </div>
              </div>
              <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
                <div className="text-sm font-semibold text-slate-700 mb-2">
                  Avg Slippage
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {((performance.simulation.avgSlippage || 0) * 100).toFixed(3)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, gradient, isPositive }) {
  return (
    <div className="stats-card group">
      <div className="flex items-center justify-between mb-3">
        <span className="stats-label">{title}</span>
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className={`stats-value mb-2 ${isPositive !== undefined ? (isPositive ? 'text-emerald-600' : 'text-rose-600') : ''}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-sm text-slate-600 font-medium">{subtitle}</div>
      )}
    </div>
  );
}

function DetailRow({ label, value, icon: Icon }) {
  return (
    <div className="flex justify-between items-center py-3 px-4 rounded-lg bg-white/60 hover:bg-white transition-colors">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-slate-500" />}
        <span className="text-slate-700 font-medium">{label}</span>
      </div>
      <span className="text-slate-900 font-bold">{value}</span>
    </div>
  );
}
