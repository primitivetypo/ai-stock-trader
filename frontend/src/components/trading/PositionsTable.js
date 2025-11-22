import { Package, TrendingUp, TrendingDown } from 'lucide-react';

export default function PositionsTable({ positions }) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg">
          <Package className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Open Positions</h2>
        {positions.length > 0 && (
          <span className="ml-auto badge badge-info">
            {positions.length} positions
          </span>
        )}
      </div>

      {positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4">
            <Package className="w-10 h-10 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">No open positions</p>
          <p className="text-sm text-slate-500 mt-1">Your positions will appear here</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-600 text-sm font-semibold border-b border-slate-200">
                <th className="pb-3 px-2">Symbol</th>
                <th className="pb-3 px-2">Qty</th>
                <th className="pb-3 px-2">Avg Cost</th>
                <th className="pb-3 px-2">Current Price</th>
                <th className="pb-3 px-2">Market Value</th>
                <th className="pb-3 px-2">P&L</th>
                <th className="pb-3 px-2">P&L %</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => {
                const pnl = parseFloat(position.unrealized_pl);
                const pnlPercent = parseFloat(position.unrealized_plpc) * 100;
                const isProfit = pnl >= 0;

                return (
                  <tr
                    key={position.symbol}
                    className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="py-4 px-2">
                      <span className="text-slate-900 font-bold">{position.symbol}</span>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-slate-900 font-semibold">{position.qty}</span>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-slate-900 font-semibold">
                        ${parseFloat(position.avg_entry_price).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-slate-900 font-semibold">
                        ${parseFloat(position.current_price).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <span className="text-slate-900 font-semibold">
                        ${parseFloat(position.market_value).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-1.5">
                        {isProfit ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-rose-600" />
                        )}
                        <span className={`font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isProfit ? '+' : ''}${pnl.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <span className={`badge ${isProfit ? 'badge-success' : 'badge-danger'}`}>
                        {isProfit ? '+' : ''}
                        {pnlPercent.toFixed(2)}%
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
