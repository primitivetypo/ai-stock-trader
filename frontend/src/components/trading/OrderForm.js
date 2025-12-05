'use client';

import { useState } from 'react';
import { Search, X, DollarSign, Clock, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import Image from 'next/image';

export default function OrderForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    symbol: '',
    qty: '',
    side: 'buy',
    type: 'market',
    limit_price: '',
    time_in_force: 'day'
  });
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

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

    await onSubmit(orderData);
    setSubmitting(false);

    setFormData({
      ...formData,
      symbol: '',
      qty: '',
      limit_price: ''
    });
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleSearchSymbol = async (query) => {
    setFormData({ ...formData, symbol: query.toUpperCase() });

    if (query.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    try {
      const response = await api.get(`/api/market/search?q=${encodeURIComponent(query)}&limit=10`);
      setSearchResults(response.data);
      setShowDropdown(true);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    }
  };

  const handleSelectSymbol = (result) => {
    setFormData({ ...formData, symbol: result.symbol });
    setSearchResults([]);
    setShowDropdown(false);
  };

  const isBuy = formData.side === 'buy';

  return (
    <div className="card-elevated p-6">
      <div className="section-header">
        <h3 className="section-title">Place Order</h3>
        <div className="tabs">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, side: 'buy' })}
            className={isBuy ? 'tab-active !bg-success-light !text-success-dark' : 'tab'}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, side: 'sell' })}
            className={!isBuy ? 'tab-active !bg-danger-light !text-danger-dark' : 'tab'}
          >
            Sell
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Symbol Search */}
          <div className="relative">
            <label className="block text-caption font-medium text-content-secondary mb-2">
              Symbol
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => handleSearchSymbol(e.target.value)}
                onFocus={() => formData.symbol && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Search stocks..."
                className="input input-with-icon"
                required
              />
              {formData.symbol && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, symbol: '' });
                    setSearchResults([]);
                    setShowDropdown(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-100 rounded"
                >
                  <X className="h-4 w-4 text-content-tertiary" />
                </button>
              )}
            </div>

            {/* Search Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="dropdown max-h-72 overflow-y-auto scrollbar-thin">
                {searchResults.map((result) => (
                  <button
                    key={result.symbol}
                    type="button"
                    onClick={() => handleSelectSymbol(result)}
                    className="dropdown-item w-full flex items-center gap-3"
                  >
                    {result.logo_url ? (
                      <Image
                        src={result.logo_url}
                        alt={result.name}
                        width={32}
                        height={32}
                        className="rounded-lg"
                        unoptimized
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-caption">
                        {result.symbol.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-content-primary">{result.symbol}</div>
                      <div className="text-caption text-content-tertiary truncate">{result.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-caption font-medium text-content-secondary mb-2">
              Quantity
            </label>
            <input
              type="number"
              value={formData.qty}
              onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
              placeholder="100"
              min="1"
              className="input"
              required
            />
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-caption font-medium text-content-secondary mb-2">
              Order Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="select"
            >
              <option value="market">Market Order</option>
              <option value="limit">Limit Order</option>
            </select>
          </div>

          {/* Time in Force */}
          <div>
            <label className="block text-caption font-medium text-content-secondary mb-2">
              Time in Force
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary pointer-events-none" />
              <select
                value={formData.time_in_force}
                onChange={(e) => setFormData({ ...formData, time_in_force: e.target.value })}
                className="select pl-10"
              >
                <option value="day">Day</option>
                <option value="gtc">GTC (Good Till Cancelled)</option>
                <option value="ioc">IOC (Immediate or Cancel)</option>
              </select>
            </div>
          </div>

          {/* Limit Price (conditional) */}
          {formData.type === 'limit' && (
            <div className="md:col-span-2">
              <label className="block text-caption font-medium text-content-secondary mb-2">
                Limit Price
              </label>
              <div className="relative max-w-xs">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
                <input
                  type="number"
                  value={formData.limit_price}
                  onChange={(e) => setFormData({ ...formData, limit_price: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  className="input input-with-icon"
                  required={formData.type === 'limit'}
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !formData.symbol || !formData.qty}
          className={`w-full py-3.5 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 ${
            isBuy
              ? 'bg-success hover:bg-success-dark disabled:bg-success/50'
              : 'bg-danger hover:bg-danger-dark disabled:bg-danger/50'
          } disabled:cursor-not-allowed`}
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {isBuy ? 'Place Buy Order' : 'Place Sell Order'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
