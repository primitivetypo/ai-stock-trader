import { formatDistanceToNow } from 'date-fns';
import { History, TrendingUp, TrendingDown, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function RecentTrades({ trades }) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg">
          <History className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Recent Trades</h2>
        {trades.length > 0 && (
          <span className="ml-auto badge badge-info">
            {trades.length} trades
          </span>
        )}
      </div>

      {trades.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4">
            <History className="w-10 h-10 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">No trades yet</p>
          <p className="text-sm text-slate-500 mt-1">Your trade history will appear here</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-600 text-sm font-semibold border-b border-slate-200">
                <th className="pb-3 px-2">Symbol</th>
                <th className="pb-3 px-2">Side</th>
                <th className="pb-3 px-2">Quantity</th>
                <th className="pb-3 px-2">Price</th>
                <th className="pb-3 px-2">Status</th>
                <th className="pb-3 px-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const isBuy = trade.side === 'buy';
                const status = trade.status;
                
                return (
                  <tr
                    key={trade.id}
                    className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="py-4 px-2">
                      <span className="text-slate-900 font-bold">{trade.symbol}</span>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-1.5">
                        {isBuy ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-rose-600" />
                        )}
                        <span className={`badge ${isBuy ? 'badge-success' : 'badge-danger'}`}>
                          {trade.side.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-slate-900 font-semibold">
                        {trade.filled_qty || trade.qty}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-slate-900 font-semibold">
                        ${parseFloat(trade.filled_avg_price || trade.limit_price || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      {status === 'filled' && (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span className="badge badge-success">Filled</span>
                        </div>
                      )}
                      {status === 'canceled' && (
                        <div className="flex items-center gap-1.5">
                          <XCircle className="w-4 h-4 text-rose-600" />
                          <span className="badge badge-danger">Canceled</span>
                        </div>
                      )}
                      {status !== 'filled' && status !== 'canceled' && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span className="badge badge-warning">{status}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-slate-600 text-sm font-medium">
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
      )}
    </div>
  );
}
