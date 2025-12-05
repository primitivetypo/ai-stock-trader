'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, TrendingUp, FlaskConical } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AccountSummary from '@/components/dashboard/AccountSummary';
import MarketWatch from '@/components/dashboard/MarketWatch';
import VolumeAlerts from '@/components/dashboard/VolumeAlerts';
import RecentTrades from '@/components/dashboard/RecentTrades';
import PerformanceChart from '@/components/dashboard/PerformanceChart';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import api from '@/lib/api';
import Link from 'next/link';

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
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-body text-content-secondary">Loading dashboard...</p>
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
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Real-time market monitoring and trading overview</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link href="/experiments" className="btn-primary">
              <FlaskConical className="w-4 h-4" />
              <span className="hidden sm:inline">Start</span> Experiment
            </Link>
          </div>
        </div>

        {/* Account Summary Metrics */}
        <AccountSummary accountData={accountData} performance={performance} />

        {/* Performance Chart */}
        <PerformanceChart />

        {/* Market Watch & Volume Alerts Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          <MarketWatch />
          <VolumeAlerts alerts={volumeAlerts} />
        </div>

        {/* Recent Trades */}
        <RecentTrades trades={recentTrades} />
      </div>
    </DashboardLayout>
  );
}
