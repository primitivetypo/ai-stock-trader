'use client';

import { useState } from 'react';

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

    // Reset form
    setFormData({
      ...formData,
      symbol: '',
      qty: '',
      limit_price: ''
    });
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">Place Order</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Symbol */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Symbol
            </label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) =>
                setFormData({ ...formData, symbol: e.target.value.toUpperCase() })
              }
              placeholder="AAPL"
              className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Quantity
            </label>
            <input
              type="number"
              value={formData.qty}
              onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
              placeholder="100"
              min="1"
              className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          {/* Side */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Side
            </label>
            <select
              value={formData.side}
              onChange={(e) => setFormData({ ...formData, side: e.target.value })}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Order Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
          </div>

          {/* Limit Price (conditional) */}
          {formData.type === 'limit' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Limit Price
              </label>
              <input
                type="number"
                value={formData.limit_price}
                onChange={(e) =>
                  setFormData({ ...formData, limit_price: e.target.value })
                }
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                required={formData.type === 'limit'}
              />
            </div>
          )}

          {/* Time in Force */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Time in Force
            </label>
            <select
              value={formData.time_in_force}
              onChange={(e) =>
                setFormData({ ...formData, time_in_force: e.target.value })
              }
              className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="day">Day</option>
              <option value="gtc">GTC (Good Till Cancelled)</option>
              <option value="ioc">IOC (Immediate or Cancel)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className={`w-full py-3 rounded-lg font-semibold transition-colors ${
            formData.side === 'buy'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {formData.side === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
        </button>
      </form>
    </div>
  );
}
