'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    loadDashboardData();

    // Connect to WebSocket
    const socket = connectSocket();

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
    });

    socket.on('volumeAlert', (alert) => {
      setVolumeAlerts((prev) => [alert, ...prev].slice(0, 10));
    });

    socket.on('tradeExecuted', (trade) => {
      setRecentTrades((prev) => [trade, ...prev].slice(0, 10));
      loadDashboardData(); // Refresh account data
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400 mt-1">
              Real-time market monitoring and trading overview
            </p>
          </div>
          <button
            onClick={() => router.push('/experiments')}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            Trading Experiments
          </button>
        </div>

        {/* Account Summary */}
        <AccountSummary accountData={accountData} performance={performance} />

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Volume Alerts */}
          <VolumeAlerts alerts={volumeAlerts} />

          {/* Market Watch */}
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
