'use client';

import { formatDistanceToNow } from 'date-fns';
import { Activity, TrendingUp, TrendingDown, Clock } from 'lucide-react';

export default function VolumeAlerts({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="card-elevated p-6 h-full flex flex-col">
        <div className="section-header">
          <h3 className="section-title">Volume Alerts</h3>
          <span className="badge-default">Monitoring</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="empty-state-icon">
            <Activity className="w-7 h-7 text-content-tertiary" />
          </div>
          <p className="empty-state-title">No alerts yet</p>
          <p className="empty-state-text">
            Volume anomalies will appear here in real-time
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated p-6 h-full flex flex-col">
      <div className="section-header">
        <h3 className="section-title">Volume Alerts</h3>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
          <span className="badge-success">{alerts.length} Active</span>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin">
        {alerts.map((alert, index) => {
          const isSpike = alert.type === 'spike';
          const zScore = Math.abs(alert.zScore || 0);

          return (
            <div
              key={`${alert.symbol}-${alert.timestamp}-${index}`}
              className={`p-4 rounded-lg border-l-4 ${
                isSpike
                  ? 'bg-success-light/40 border-l-success'
                  : 'bg-danger-light/40 border-l-danger'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    isSpike ? 'bg-success/10' : 'bg-danger/10'
                  }`}>
                    {isSpike ? (
                      <TrendingUp className={`w-4 h-4 text-success`} />
                    ) : (
                      <TrendingDown className={`w-4 h-4 text-danger`} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-body font-bold text-content-primary">
                        {alert.symbol}
                      </span>
                      <span className={`badge ${isSpike ? 'badge-success' : 'badge-danger'}`}>
                        {isSpike ? 'Spike' : 'Drop'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
                      <div>
                        <span className="text-content-tertiary">Volume: </span>
                        <span className="font-semibold text-content-primary tabular-nums">
                          {alert.currentVolume?.toLocaleString() || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-content-tertiary">Avg: </span>
                        <span className="font-semibold text-content-primary tabular-nums">
                          {Math.round(alert.avgVolume || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-content-tertiary">Z-Score: </span>
                        <span className={`font-bold tabular-nums ${isSpike ? 'text-success' : 'text-danger'}`}>
                          {zScore.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-tiny text-content-tertiary whitespace-nowrap">
                  <Clock className="w-3 h-3" />
                  <span>
                    {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
