'use client';

import { useState } from 'react';
import { Package, TrendingUp, TrendingDown, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

export default function PositionsTable({ positions, onSell }) {
  const [sellModal, setSellModal] = useState(null);
  const [sellQuantity, setSellQuantity] = useState('');
  const [selling, setSelling] = useState(false);

  const handleSellClick = (position) => {
    setSellModal(position);
    setSellQuantity(position.qty);
  };

  const handleCloseSellModal = () => {
    setSellModal(null);
    setSellQuantity('');
    setSelling(false);
  };

  const handleSellSubmit = async () => {
    const qty = parseFloat(sellQuantity);
    const available = parseFloat(sellModal.qty);

    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (qty > available) {
      toast.error(`You only have ${available} shares available to sell`);
      return;
    }

    setSelling(true);

    try {
      await api.post('/api/trades/orders', {
        symbol: sellModal.symbol,
        qty: qty,
        side: 'sell',
        type: 'market',
        time_in_force: 'day'
      });

      toast.success(`Sell order placed for ${qty} shares of ${sellModal.symbol}`);
      handleCloseSellModal();

      if (onSell) {
        onSell();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to place sell order');
    } finally {
      setSelling(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  if (!positions || positions.length === 0) {
    return (
      <div className="card-elevated p-6">
        <div className="section-header">
          <h3 className="section-title">Your Positions</h3>
        </div>
        <div className="empty-state py-12">
          <div className="empty-state-icon">
            <Package className="w-7 h-7 text-content-tertiary" />
          </div>
          <p className="empty-state-title">No open positions</p>
          <p className="empty-state-text">
            Buy stocks to see them here
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card-elevated p-6">
        <div className="section-header">
          <h3 className="section-title">Your Positions</h3>
          <span className="badge-brand">{positions.length} {positions.length === 1 ? 'position' : 'positions'}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {positions.map((position) => {
            const pnl = parseFloat(position.unrealized_pl);
            const pnlPercent = parseFloat(position.unrealized_plpc) * 100;
            const isProfit = pnl >= 0;
            const qty = parseFloat(position.qty);
            const avgPrice = parseFloat(position.avg_entry_price);
            const currentPrice = parseFloat(position.current_price);
            const marketValue = parseFloat(position.market_value);

            return (
              <div key={position.symbol} className="position-card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-heading font-bold text-content-primary">{position.symbol}</span>
                      <span className="badge-default">{qty} shares</span>
                    </div>
                    <p className="text-caption text-content-tertiary mt-0.5">
                      Avg. {formatCurrency(avgPrice)}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${
                    isProfit ? 'bg-success-light' : 'bg-danger-light'
                  }`}>
                    {isProfit ? (
                      <TrendingUp className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-danger" />
                    )}
                    <span className={`text-caption font-bold ${isProfit ? 'text-success-dark' : 'text-danger-dark'}`}>
                      {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-caption">
                    <span className="text-content-tertiary">Current Price</span>
                    <span className="font-semibold text-content-primary tabular-nums">
                      {formatCurrency(currentPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-caption">
                    <span className="text-content-tertiary">Market Value</span>
                    <span className="font-semibold text-content-primary tabular-nums">
                      {formatCurrency(marketValue)}
                    </span>
                  </div>
                  <div className="flex justify-between text-caption">
                    <span className="text-content-tertiary">P&L</span>
                    <span className={`font-bold tabular-nums ${isProfit ? 'text-success' : 'text-danger'}`}>
                      {isProfit ? '+' : ''}{formatCurrency(pnl)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleSellClick(position)}
                  className="w-full btn-danger btn-sm"
                >
                  Sell
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sell Modal */}
      {sellModal && (
        <div className="modal-overlay" onClick={handleCloseSellModal}>
          <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center justify-between">
                <h3 className="text-heading font-bold text-content-primary">
                  Sell {sellModal.symbol}
                </h3>
                <button onClick={handleCloseSellModal} className="btn-icon">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-caption text-content-secondary mt-1">
                Available: {sellModal.qty} shares @ {formatCurrency(parseFloat(sellModal.current_price))}
              </p>
            </div>

            <div className="modal-body space-y-4">
              <div>
                <label className="block text-caption font-medium text-content-secondary mb-2">
                  Number of Shares
                </label>
                <input
                  type="number"
                  value={sellQuantity}
                  onChange={(e) => setSellQuantity(e.target.value)}
                  min="0"
                  max={sellModal.qty}
                  step="1"
                  className="input text-lg"
                  placeholder="Enter quantity"
                  autoFocus
                />
                <div className="flex items-center justify-between mt-2">
                  <button
                    type="button"
                    onClick={() => setSellQuantity(sellModal.qty)}
                    className="text-caption text-brand-500 hover:text-brand-600 font-semibold"
                  >
                    Sell All
                  </button>
                  <span className="text-caption text-content-tertiary">
                    Max: {sellModal.qty} shares
                  </span>
                </div>
              </div>

              {sellQuantity && parseFloat(sellQuantity) > 0 && (
                <div className="p-4 bg-surface-50 rounded-lg">
                  <div className="flex items-center justify-between text-caption mb-2">
                    <span className="text-content-secondary">Market Price</span>
                    <span className="font-semibold text-content-primary">
                      {formatCurrency(parseFloat(sellModal.current_price))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-body font-medium text-content-secondary">Est. Total</span>
                    <span className="text-heading font-bold text-content-primary tabular-nums">
                      {formatCurrency(parseFloat(sellQuantity) * parseFloat(sellModal.current_price))}
                    </span>
                  </div>
                </div>
              )}

              {sellQuantity && parseFloat(sellQuantity) > parseFloat(sellModal.qty) && (
                <div className="p-3 bg-danger-light rounded-lg">
                  <p className="text-caption text-danger-dark font-medium">
                    You only have {sellModal.qty} shares available
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={handleCloseSellModal} disabled={selling} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleSellSubmit}
                disabled={selling || !sellQuantity || parseFloat(sellQuantity) <= 0 || parseFloat(sellQuantity) > parseFloat(sellModal.qty)}
                className="btn-danger"
              >
                {selling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Selling...
                  </>
                ) : (
                  `Sell ${sellQuantity || 0} Shares`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
