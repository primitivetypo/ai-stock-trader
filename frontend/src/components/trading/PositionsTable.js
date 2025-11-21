export default function PositionsTable({ positions }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">Open Positions</h2>

      {positions.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <div className="text-4xl mb-2">📊</div>
          <p>No open positions</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                <th className="pb-3">Symbol</th>
                <th className="pb-3">Qty</th>
                <th className="pb-3">Avg Cost</th>
                <th className="pb-3">Current Price</th>
                <th className="pb-3">Market Value</th>
                <th className="pb-3">P&L</th>
                <th className="pb-3">P&L %</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => {
                const pnl = parseFloat(position.unrealized_pl);
                const pnlPercent = parseFloat(position.unrealized_plpc) * 100;

                return (
                  <tr
                    key={position.symbol}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30"
                  >
                    <td className="py-3 text-white font-medium">
                      {position.symbol}
                    </td>
                    <td className="py-3 text-white">{position.qty}</td>
                    <td className="py-3 text-white">
                      ${parseFloat(position.avg_entry_price).toFixed(2)}
                    </td>
                    <td className="py-3 text-white">
                      ${parseFloat(position.current_price).toFixed(2)}
                    </td>
                    <td className="py-3 text-white">
                      ${parseFloat(position.market_value).toFixed(2)}
                    </td>
                    <td
                      className={`py-3 font-medium ${
                        pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 font-medium ${
                        pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {pnlPercent >= 0 ? '+' : ''}
                      {pnlPercent.toFixed(2)}%
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
