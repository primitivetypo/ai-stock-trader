'use client';

import { useState, useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';

export default function MarketWatch() {
  const [watchlist, setWatchlist] = useState([]);
  const [quotes, setQuotes] = useState({});

  useEffect(() => {
    loadWatchlist();

    const socket = getSocket();

    socket.on('marketData', (data) => {
      if (data.type === 'quote') {
        setQuotes((prev) => ({
          ...prev,
          [data.symbol]: {
            bidPrice: data.bidPrice,
            askPrice: data.askPrice,
            spread: data.askPrice - data.bidPrice,
            timestamp: data.timestamp
          }
        }));
      }
    });

    return () => {
      socket.off('marketData');
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (watchlist.length > 0) {
      socket.emit('subscribe', watchlist);
    }

    return () => {
      if (watchlist.length > 0) {
        socket.emit('unsubscribe', watchlist);
      }
    };
  }, [watchlist]);

  const loadWatchlist = async () => {
    try {
      const response = await api.get('/api/market/watchlist');
      setWatchlist(response.data);
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">Market Watch</h2>

      {watchlist.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <div className="text-4xl mb-2">👁️</div>
          <p>No symbols in watchlist</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {watchlist.map((symbol) => {
            const quote = quotes[symbol];
            return (
              <div
                key={symbol}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50"
              >
                <div>
                  <div className="text-lg font-bold text-white">{symbol}</div>
                  {quote && (
                    <div className="text-xs text-slate-400">
                      Spread: ${quote.spread.toFixed(2)}
                    </div>
                  )}
                </div>
                {quote ? (
                  <div className="text-right">
                    <div className="text-green-400 text-sm">
                      Bid: ${quote.bidPrice.toFixed(2)}
                    </div>
                    <div className="text-red-400 text-sm">
                      Ask: ${quote.askPrice.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm">Loading...</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
