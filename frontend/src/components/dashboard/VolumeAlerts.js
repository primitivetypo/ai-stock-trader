import { formatDistanceToNow } from 'date-fns';

export default function VolumeAlerts({ alerts }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">Volume Alerts</h2>

      {alerts.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <div className="text-4xl mb-2">🔔</div>
          <p>No alerts yet. Monitoring markets...</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                alert.type === 'spike'
                  ? 'bg-green-900/20 border-green-700/50'
                  : 'bg-red-900/20 border-red-700/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-white">
                      {alert.symbol}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        alert.type === 'spike'
                          ? 'bg-green-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {alert.type === 'spike' ? 'SPIKE' : 'DROP'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-300 space-y-1">
                    <div>
                      Volume: {alert.currentVolume.toLocaleString()} (Avg:{' '}
                      {Math.round(alert.avgVolume).toLocaleString()})
                    </div>
                    <div>Z-Score: {alert.zScore.toFixed(2)}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {formatDistanceToNow(new Date(alert.timestamp), {
                    addSuffix: true
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
