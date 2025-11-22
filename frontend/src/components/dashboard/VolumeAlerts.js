import { formatDistanceToNow } from 'date-fns';
import { Bell, TrendingUp, TrendingDown, Activity } from 'lucide-react';

export default function VolumeAlerts({ alerts }) {
  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-lg">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Volume Alerts</h2>
        {alerts.length > 0 && (
          <span className="ml-auto badge badge-info">
            {alerts.length} active
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4">
            <Activity className="w-10 h-10 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">No alerts yet</p>
          <p className="text-sm text-slate-500 mt-1">Monitoring markets for unusual activity...</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {alerts.map((alert, index) => {
            const isSpike = alert.type === 'spike';
            return (
              <div
                key={index}
                className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-md ${
                  isSpike
                    ? 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50'
                    : 'bg-rose-50/50 border-rose-200 hover:bg-rose-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${isSpike ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                      {isSpike ? (
                        <TrendingUp className={`w-4 h-4 ${isSpike ? 'text-emerald-700' : 'text-rose-700'}`} />
                      ) : (
                        <TrendingDown className={`w-4 h-4 text-rose-700`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-bold text-slate-900">
                          {alert.symbol}
                        </span>
                        <span className={`badge ${isSpike ? 'badge-success' : 'badge-danger'}`}>
                          {isSpike ? 'SPIKE' : 'DROP'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-600">Volume:</span>{' '}
                          <span className="font-semibold text-slate-900">
                            {alert.currentVolume.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Avg:</span>{' '}
                          <span className="font-semibold text-slate-900">
                            {Math.round(alert.avgVolume).toLocaleString()}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-600">Z-Score:</span>{' '}
                          <span className={`font-bold ${isSpike ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {alert.zScore.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                    {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
