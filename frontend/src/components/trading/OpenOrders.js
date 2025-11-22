import { formatDistanceToNow } from 'date-fns';
import { FileText, TrendingUp, TrendingDown, X } from 'lucide-react';

export default function OpenOrders({ orders, onCancel }) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Open Orders</h2>
        {orders.length > 0 && (
          <span className="ml-auto badge badge-warning">
            {orders.length} pending
          </span>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4">
            <FileText className="w-10 h-10 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">No open orders</p>
          <p className="text-sm text-slate-500 mt-1">Your pending orders will appear here</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-600 text-sm font-semibold border-b border-slate-200">
                <th className="pb-3 px-2">Symbol</th>
                <th className="pb-3 px-2">Side</th>
                <th className="pb-3 px-2">Type</th>
                <th className="pb-3 px-2">Qty</th>
                <th className="pb-3 px-2">Price</th>
                <th className="pb-3 px-2">Status</th>
                <th className="pb-3 px-2">Time</th>
                <th className="pb-3 px-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isBuy = order.side === 'buy';
                
                return (
                  <tr
                    key={order.id}
                    className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="py-4 px-2">
                      <span className="text-slate-900 font-bold">{order.symbol}</span>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-1.5">
                        {isBuy ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-rose-600" />
                        )}
                        <span className={`badge ${isBuy ? 'badge-success' : 'badge-danger'}`}>
                          {order.side.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-slate-900 font-semibold capitalize">{order.type}</span>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-slate-900 font-semibold">{order.qty}</span>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-slate-900 font-semibold">
                        {order.type === 'market'
                          ? 'Market'
                          : `$${parseFloat(order.limit_price).toFixed(2)}`}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <span className="badge badge-warning capitalize">
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-slate-600 text-sm font-medium">
                        {formatDistanceToNow(new Date(order.submitted_at), {
                          addSuffix: true
                        })}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <button
                        onClick={() => onCancel(order.id)}
                        className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-sm rounded-lg font-semibold transition-all hover:shadow-md flex items-center gap-1.5"
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
      )}
    </div>
  );
}
