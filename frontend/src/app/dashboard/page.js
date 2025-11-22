'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, RefreshCw } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AccountSummary from '@/components/dashboard/AccountSummary';
import MarketWatch from '@/components/dashboard/MarketWatch';
import VolumeAlerts from '@/components/dashboard/VolumeAlerts';
import RecentTrades from '@/components/dashboard/RecentTrades';
import PerformanceChart from '@/components/dashboard/PerformanceChart';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import api from '@/lib/api';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accountData, setAccountData] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [volumeAlerts, setVolumeAlerts] = useState([]);
  const [recentTrades, setRecentTrades] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    loadDashboardData();

    const socket = connectSocket();

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
    });

    socket.on('volumeAlert', (alert) => {
      setVolumeAlerts((prev) => [alert, ...prev].slice(0, 10));
    });

    socket.on('tradeExecuted', (trade) => {
      setRecentTrades((prev) => [trade, ...prev].slice(0, 10));
      loadDashboardData();
    });

    return () => {
      disconnectSocket();
    };
  }, [router]);

  const loadDashboardData = async () => {
    try {
      const [accountRes, performanceRes, historyRes] = await Promise.all([
        api.get('/api/trades/account'),
        api.get('/api/analytics/performance'),
        api.get('/api/analytics/history?limit=10')
      ]);

      setAccountData(accountRes.data);
      setPerformance(performanceRes.data);
      setRecentTrades(historyRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-600 font-medium">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600 mt-1">
              Real-time market monitoring and trading overview
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => router.push('/experiments')}
              className="btn-primary flex items-center gap-2"
            >
              <FlaskConical className="w-5 h-5" />
              <span className="hidden sm:inline">Trading</span> Experiments
            </button>
          </div>
        </div>

        {/* Account Summary */}
        <AccountSummary accountData={accountData} performance={performance} />

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          <VolumeAlerts alerts={volumeAlerts} />
          <MarketWatch />
        </div>

        {/* Performance Chart */}
        <PerformanceChart />

        {/* Recent Trades */}
        <RecentTrades trades={recentTrades} />
      </div>
    </DashboardLayout>
  );
}
