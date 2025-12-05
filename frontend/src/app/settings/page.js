'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Wallet, DollarSign, Settings as SettingsIcon, ArrowUpCircle, ArrowDownCircle, Shield, CheckCircle } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accountData, setAccountData] = useState(null);
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('deposit');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    loadAccountData();
  }, [router]);

  const loadAccountData = async () => {
    try {
      const response = await api.get('/api/trades/account');
      setAccountData(response.data);
    } catch (error) {
      console.error('Failed to load account data:', error);
      toast.error('Failed to load account data');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustBalance = async (e) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post('/api/trades/account/adjust-balance', {
        amount: parseFloat(amount),
        type: adjustmentType
      });

      setAccountData(response.data);
      toast.success(`${adjustmentType === 'deposit' ? 'Deposited' : 'Withdrew'} $${parseFloat(amount).toLocaleString()}`);
      setAmount('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to adjust balance');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value || 0);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-body text-content-secondary">Loading settings...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and portfolio settings</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Profile Section */}
          <div className="card-elevated p-6">
            <div className="section-header">
              <h3 className="section-title flex items-center gap-2">
                <User className="w-5 h-5 text-brand-500" />
                Profile
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-caption font-medium text-content-secondary mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={user?.name || ''}
                  disabled
                  className="input bg-surface-50 text-content-secondary cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-caption font-medium text-content-secondary mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="input bg-surface-50 text-content-secondary cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-caption font-medium text-content-secondary mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  value={accountData?.account_number || ''}
                  disabled
                  className="input bg-surface-50 text-content-secondary cursor-not-allowed font-mono"
                />
              </div>
            </div>
          </div>

          {/* Account Status */}
          <div className="card-elevated p-6">
            <div className="section-header">
              <h3 className="section-title flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-brand-500" />
                Account Status
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-50 border border-surface-100">
                <span className="text-body text-content-secondary">Status</span>
                <span className="badge-success flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {accountData?.status || 'ACTIVE'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-50 border border-surface-100">
                <span className="text-body text-content-secondary">Currency</span>
                <span className="text-body font-semibold text-content-primary">
                  {accountData?.currency || 'USD'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-50 border border-surface-100">
                <span className="text-body text-content-secondary">Pattern Day Trader</span>
                <span className={accountData?.pattern_day_trader ? 'badge-warning' : 'badge-success'}>
                  {accountData?.pattern_day_trader ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-50 border border-surface-100">
                <span className="text-body text-content-secondary">Trading Status</span>
                <span className={accountData?.trading_blocked ? 'badge-danger' : 'badge-success'}>
                  {accountData?.trading_blocked ? 'Blocked' : 'Active'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Balance Section */}
        <div className="card-elevated p-6">
          <div className="section-header">
            <h3 className="section-title flex items-center gap-2">
              <Wallet className="w-5 h-5 text-success" />
              Portfolio Balance
            </h3>
          </div>

          {/* Balance Cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-lg bg-brand-50 border border-brand-100">
              <p className="text-caption text-content-secondary mb-1">Cash Balance</p>
              <p className="text-heading-lg font-bold text-content-primary tabular-nums">
                {formatCurrency(accountData?.cash)}
              </p>
            </div>
            <div className="p-5 rounded-lg bg-success-light border border-success/20">
              <p className="text-caption text-content-secondary mb-1">Portfolio Value</p>
              <p className="text-heading-lg font-bold text-content-primary tabular-nums">
                {formatCurrency(accountData?.portfolio_value)}
              </p>
            </div>
            <div className="p-5 rounded-lg bg-warning-light border border-warning/20">
              <p className="text-caption text-content-secondary mb-1">Total Equity</p>
              <p className="text-heading-lg font-bold text-content-primary tabular-nums">
                {formatCurrency(accountData?.equity)}
              </p>
            </div>
          </div>

          {/* Adjustment Form */}
          <form onSubmit={handleAdjustBalance} className="space-y-4">
            <div>
              <label className="block text-caption font-medium text-content-secondary mb-2">
                Adjustment Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('deposit')}
                  className={`p-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                    adjustmentType === 'deposit'
                      ? 'border-success bg-success-light text-success-dark'
                      : 'border-surface-200 bg-surface-0 text-content-secondary hover:border-surface-300'
                  }`}
                >
                  <ArrowUpCircle className="w-5 h-5" />
                  <span className="font-semibold">Deposit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('withdrawal')}
                  className={`p-4 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                    adjustmentType === 'withdrawal'
                      ? 'border-danger bg-danger-light text-danger-dark'
                      : 'border-surface-200 bg-surface-0 text-content-secondary hover:border-surface-300'
                  }`}
                >
                  <ArrowDownCircle className="w-5 h-5" />
                  <span className="font-semibold">Withdraw</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-caption font-medium text-content-secondary mb-2">
                Amount
              </label>
              <div className="relative max-w-sm">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="input input-with-icon"
                  disabled={submitting}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !amount}
              className={`${adjustmentType === 'deposit' ? 'btn-success' : 'btn-danger'} w-full sm:w-auto`}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {adjustmentType === 'deposit' ? (
                    <ArrowUpCircle className="w-4 h-4" />
                  ) : (
                    <ArrowDownCircle className="w-4 h-4" />
                  )}
                  {adjustmentType === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
                </>
              )}
            </button>
          </form>

          {/* Info Note */}
          <div className="mt-6 p-4 rounded-lg bg-warning-light border border-warning/20">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-body font-medium text-content-primary mb-1">Virtual Portfolio</p>
                <p className="text-caption text-content-secondary">
                  This is a simulated portfolio for practice. All transactions are virtual and do not involve real money.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
