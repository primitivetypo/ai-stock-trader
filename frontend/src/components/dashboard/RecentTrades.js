'use client';

import { formatDistanceToNow } from 'date-fns';
import { History, TrendingUp, TrendingDown, CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function RecentTrades({ trades }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="card-elevated p-6">
        <div className="section-header">
          <h3 className="section-title">Recent Trades</h3>
        </div>
        <div className="empty-state py-12">
          <div className="empty-state-icon">
            <History className="w-7 h-7 text-content-tertiary" />
          </div>
          <p className="empty-state-title">No trades yet</p>
          <p className="empty-state-text mb-4">
            Your trading history will appear here
          </p>
          <Link href="/trading" className="btn-primary btn-sm">
            Start Trading
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'filled':
        return (
          <span className="badge-success flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Filled
          </span>
        );
      case 'canceled':
        return (
          <span className="badge-danger flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Canceled
          </span>
        );
      default:
        return (
          <span className="badge-warning flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="card-elevated overflow-hidden">
      <div className="p-6 pb-0">
        <div className="section-header mb-0">
          <h3 className="section-title">Recent Trades</h3>
          <Link href="/analytics" className="btn-ghost btn-sm text-brand-500">
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Side</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 10).map((trade) => {
              const isBuy = trade.side === 'buy';
              const price = parseFloat(trade.filled_avg_price || trade.limit_price || 0);

              return (
                <tr key={trade.id}>
                  <td>
                    <span className="font-semibold text-content-primary">{trade.symbol}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {isBuy ? (
                        <TrendingUp className="w-4 h-4 text-success" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-danger" />
                      )}
                      <span className={`text-caption font-semibold ${isBuy ? 'text-success' : 'text-danger'}`}>
                        {trade.side.toUpperCase()}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="font-medium tabular-nums">
                      {trade.filled_qty || trade.qty}
                    </span>
                  </td>
                  <td>
                    <span className="font-medium tabular-nums">
                      ${price.toFixed(2)}
                    </span>
                  </td>
                  <td>{getStatusBadge(trade.status)}</td>
                  <td>
                    <span className="text-content-secondary text-caption">
                      {formatDistanceToNow(new Date(trade.submitted_at || trade.timestamp), {
                        addSuffix: true
                      })}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
