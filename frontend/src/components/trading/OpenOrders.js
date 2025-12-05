'use client';

import { formatDistanceToNow } from 'date-fns';
import { FileText, TrendingUp, TrendingDown, X, Clock } from 'lucide-react';

export default function OpenOrders({ orders, onCancel }) {
  if (!orders || orders.length === 0) {
    return (
      <div className="card-elevated p-6">
        <div className="section-header">
          <h3 className="section-title">Open Orders</h3>
        </div>
        <div className="empty-state py-12">
          <div className="empty-state-icon">
            <FileText className="w-7 h-7 text-content-tertiary" />
          </div>
          <p className="empty-state-title">No open orders</p>
          <p className="empty-state-text">
            Your pending orders will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated overflow-hidden">
      <div className="p-6 pb-0">
        <div className="section-header mb-0">
          <h3 className="section-title">Open Orders</h3>
          <span className="badge-warning flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {orders.length} pending
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Side</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Status</th>
              <th>Time</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const isBuy = order.side === 'buy';

              return (
                <tr key={order.id}>
                  <td>
                    <span className="font-semibold text-content-primary">{order.symbol}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {isBuy ? (
                        <TrendingUp className="w-4 h-4 text-success" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-danger" />
                      )}
                      <span className={`text-caption font-semibold ${isBuy ? 'text-success' : 'text-danger'}`}>
                        {order.side.toUpperCase()}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="font-medium capitalize">{order.type}</span>
                  </td>
                  <td>
                    <span className="font-medium tabular-nums">{order.qty}</span>
                  </td>
                  <td>
                    <span className="font-medium tabular-nums">
                      {order.type === 'market'
                        ? 'Market'
                        : `$${parseFloat(order.limit_price).toFixed(2)}`}
                    </span>
                  </td>
                  <td>
                    <span className="badge-warning capitalize">{order.status}</span>
                  </td>
                  <td>
                    <span className="text-content-secondary text-caption">
                      {formatDistanceToNow(new Date(order.submitted_at), {
                        addSuffix: true
                      })}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => onCancel(order.id)}
                      className="btn-ghost btn-sm text-danger hover:bg-danger-light"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
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
