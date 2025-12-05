'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import OrderForm from '@/components/trading/OrderForm';
import PositionsTable from '@/components/trading/PositionsTable';
import OpenOrders from '@/components/trading/OpenOrders';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function Trading() {
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTradingData();

    const interval = setInterval(loadTradingData, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadTradingData = async () => {
    try {
      const [positionsRes, ordersRes] = await Promise.all([
        api.get('/api/trades/positions'),
        api.get('/api/trades/orders?status=open')
      ]);

      setPositions(positionsRes.data);
      setOrders(ordersRes.data);
    } catch (error) {
      console.error('Failed to load trading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleOrderSubmit = async (orderData) => {
    try {
      await api.post('/api/trades/orders', orderData);
      toast.success('Order placed successfully!');
      loadTradingData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to place order');
    }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      await api.delete(`/api/trades/orders/${orderId}`);
      toast.success('Order cancelled');
      loadTradingData();
    } catch (error) {
      toast.error('Failed to cancel order');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTradingData();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-body text-content-secondary">Loading trading data...</p>
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
            <h1 className="page-title">Trading</h1>
            <p className="page-subtitle">Place orders and manage your positions</p>
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

        {/* Order Form */}
        <OrderForm onSubmit={handleOrderSubmit} />

        {/* Positions */}
        <PositionsTable positions={positions} onSell={loadTradingData} />

        {/* Open Orders */}
        <OpenOrders orders={orders} onCancel={handleCancelOrder} />
      </div>
    </DashboardLayout>
  );
}
