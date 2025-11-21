import { formatDistanceToNow } from 'date-fns';

export default function OpenOrders({ orders, onCancel }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">Open Orders</h2>

      {orders.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <div className="text-4xl mb-2">📝</div>
          <p>No open orders</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                <th className="pb-3">Symbol</th>
                <th className="pb-3">Side</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Qty</th>
                <th className="pb-3">Price</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Time</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30"
                >
                  <td className="py-3 text-white font-medium">{order.symbol}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        order.side === 'buy'
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-red-900/50 text-red-400'
                      }`}
                    >
                      {order.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 text-white">{order.type}</td>
                  <td className="py-3 text-white">{order.qty}</td>
                  <td className="py-3 text-white">
                    {order.type === 'market'
                      ? 'Market'
                      : `$${parseFloat(order.limit_price).toFixed(2)}`}
                  </td>
                  <td className="py-3 text-yellow-400 text-sm">
                    {order.status}
                  </td>
                  <td className="py-3 text-slate-400 text-sm">
                    {formatDistanceToNow(new Date(order.submitted_at), {
                      addSuffix: true
                    })}
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => onCancel(order.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
