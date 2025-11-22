'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Hash, Clock, ArrowRight } from 'lucide-react';

export default function OrderForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    symbol: '',
    qty: '',
    side: 'buy',
    type: 'market',
    limit_price: '',
    time_in_force: 'day'
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    const orderData = {
      symbol: formData.symbol.toUpperCase(),
      qty: parseInt(formData.qty),
      side: formData.side,
      type: formData.type,
      time_in_force: formData.time_in_force
    };

    if (formData.type === 'limit' && formData.limit_price) {
      orderData.limit_price = parseFloat(formData.limit_price);
    }

    onSubmit(orderData);

    setFormData({
      ...formData,
      symbol: '',
      qty: '',
      limit_price: ''
    });
  };

  const isBuy = formData.side === 'buy';

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${isBuy ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-pink-500'} shadow-lg`}>
          {isBuy ? <TrendingUp className="w-5 h-5 text-white" /> : <TrendingDown className="w-5 h-5 text-white" />}
        </div>
        <h2 className="text-xl font-bold text-slate-900">Place Order</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Symbol
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Hash className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) =>
                  setFormData({ ...formData, symbol: e.target.value.toUpperCase() })
                }
                placeholder="AAPL"
                className="input-primary pl-11"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Quantity
            </label>
            <input
              type="number"
              value={formData.qty}
              onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
              placeholder="100"
              min="1"
              className="input-primary"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Side
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, side: 'buy' })}
                className={`px-4 py-3 rounded-xl font-semibold transition-all ${
                  isBuy
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-white/60 text-slate-700 border border-slate-200 hover:bg-white'
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, side: 'sell' })}
                className={`px-4 py-3 rounded-xl font-semibold transition-all ${
                  !isBuy
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30'
                    : 'bg-white/60 text-slate-700 border border-slate-200 hover:bg-white'
                }`}
              >
                Sell
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Order Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="input-primary"
            >
              <option value="market">Market Order</option>
              <option value="limit">Limit Order</option>
            </select>
          </div>

          {formData.type === 'limit' && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">
                Limit Price
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="number"
                  value={formData.limit_price}
                  onChange={(e) =>
                    setFormData({ ...formData, limit_price: e.target.value })
                  }
                  placeholder="0.00"
                  step="0.01"
                  className="input-primary pl-11"
                  required={formData.type === 'limit'}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Time in Force
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Clock className="h-5 w-5 text-slate-400" />
              </div>
              <select
                value={formData.time_in_force}
                onChange={(e) =>
                  setFormData({ ...formData, time_in_force: e.target.value })
                }
                className="input-primary pl-11"
              >
                <option value="day">Day</option>
                <option value="gtc">GTC (Good Till Cancelled)</option>
                <option value="ioc">IOC (Immediate or Cancel)</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className={`w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg ${
            isBuy
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5'
              : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:shadow-xl hover:shadow-rose-500/40 hover:-translate-y-0.5'
          }`}
        >
          <span>{isBuy ? 'Place Buy Order' : 'Place Sell Order'}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
