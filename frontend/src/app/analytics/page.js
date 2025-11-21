'use client';

import { useState, useEffect } from 'react';
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
          <div className="text-white text-xl">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 mt-1">Performance metrics and statistics</p>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Trades"
              value={statistics.totalTrades}
              icon="📊"
            />
            <StatCard
              title="Win Rate"
              value={`${statistics.winRate.toFixed(1)}%`}
              subtitle={`${statistics.wins}W / ${statistics.losses}L`}
              icon="🎯"
              color={statistics.winRate >= 50 ? 'green' : 'red'}
            />
            <StatCard
              title="Total P&L"
              value={`$${statistics.totalProfit.toFixed(2)}`}
              icon="💰"
              color={statistics.totalProfit >= 0 ? 'green' : 'red'}
            />
            <StatCard
              title="Avg P&L/Trade"
              value={`$${statistics.avgProfitPerTrade.toFixed(2)}`}
              icon="📈"
              color={statistics.avgProfitPerTrade >= 0 ? 'green' : 'red'}
            />
          </div>
        )}

        {/* Performance Details */}
        {performance && (
          <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">
              Performance Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-300 mb-3">
                  Account Status
                </h3>
                <div className="space-y-2">
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
                <h3 className="text-lg font-semibold text-slate-300 mb-3">
                  Trading Activity
                </h3>
                <div className="space-y-2">
                  <DetailRow
                    label="Open Positions"
                    value={performance.positions.count}
                  />
                  <DetailRow
                    label="Total Orders"
                    value={performance.orders.total}
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

        {/* Simulation Metrics */}
        {performance?.simulation && (
          <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">
              Simulation Metrics
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DetailRow
                label="Total Simulated Trades"
                value={performance.simulation.totalTrades || 0}
              />
              <DetailRow
                label="Filled Trades"
                value={performance.simulation.filledTrades || 0}
              />
              <DetailRow
                label="Avg Slippage"
                value={`${((performance.simulation.avgSlippage || 0) * 100).toFixed(3)}%`}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, subtitle, icon, color = 'blue' }) {
  const colorClasses = {
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-primary-400'
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${colorClasses[color]} mb-1`}>
        {value}
      </div>
      {subtitle && <div className="text-sm text-slate-400">{subtitle}</div>}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
      <span className="text-slate-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}
