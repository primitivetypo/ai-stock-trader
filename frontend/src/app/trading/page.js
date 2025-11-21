'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadTradingData();

    // Refresh every 10 seconds
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
          <h1 className="text-3xl font-bold text-white">Trading</h1>
          <p className="text-slate-400 mt-1">Place orders and manage positions</p>
        </div>

        {/* Order Form */}
        <OrderForm onSubmit={handleOrderSubmit} />

        {/* Open Orders */}
        <OpenOrders orders={orders} onCancel={handleCancelOrder} />

        {/* Positions */}
        <PositionsTable positions={positions} />
      </div>
    </DashboardLayout>
  );
}
