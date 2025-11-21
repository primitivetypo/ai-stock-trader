import { formatDistanceToNow } from 'date-fns';

export default function RecentTrades({ trades }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">Recent Trades</h2>

      {trades.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <div className="text-4xl mb-2">📋</div>
          <p>No trades yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                <th className="pb-3">Symbol</th>
                <th className="pb-3">Side</th>
                <th className="pb-3">Qty</th>
                <th className="pb-3">Price</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30"
                >
                  <td className="py-3 text-white font-medium">{trade.symbol}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.side === 'buy'
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-red-900/50 text-red-400'
                      }`}
                    >
                      {trade.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 text-white">{trade.filled_qty || trade.qty}</td>
                  <td className="py-3 text-white">
                    ${parseFloat(trade.filled_avg_price || trade.limit_price || 0).toFixed(2)}
                  </td>
                  <td className="py-3">
                    <span
                      className={`text-xs ${
                        trade.status === 'filled'
                          ? 'text-green-400'
                          : trade.status === 'canceled'
                          ? 'text-red-400'
                          : 'text-yellow-400'
                      }`}
                    >
                      {trade.status}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400 text-sm">
                    {formatDistanceToNow(new Date(trade.submitted_at || trade.timestamp), {
                      addSuffix: true
                    })}
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
