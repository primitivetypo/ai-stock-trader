'use client';

import { useState, useEffect } from 'react';
import { Eye, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
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
      const symbols = response.data;
      setWatchlist(symbols);

      if (symbols.length > 0) {
        try {
          const snapshotsRes = await api.post('/api/market/snapshots', { symbols });
          const newQuotes = {};

          Object.entries(snapshotsRes.data).forEach(([symbol, snapshot]) => {
            if (snapshot && snapshot.latestQuote) {
              const quote = snapshot.latestQuote;
              newQuotes[symbol] = {
                bidPrice: quote.bp || quote.BidPrice || 0,
                askPrice: quote.ap || quote.AskPrice || 0,
                spread: (quote.ap || quote.AskPrice || 0) - (quote.bp || quote.BidPrice || 0),
                timestamp: quote.t || quote.Timestamp
              };
            }
          });

          setQuotes(newQuotes);
        } catch (snapError) {
          console.error('Failed to load snapshots:', snapError);
        }
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    }
  };

  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg">
          <Eye className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Market Watch</h2>
        {watchlist.length > 0 && (
          <span className="ml-auto badge badge-info">
            {watchlist.length} symbols
          </span>
        )}
      </div>

      {watchlist.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4">
            <Eye className="w-10 h-10 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">No symbols in watchlist</p>
          <p className="text-sm text-slate-500 mt-1">Add symbols to start tracking</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {watchlist.map((symbol) => {
            const quote = quotes[symbol];
            const midPrice = quote ? (quote.bidPrice + quote.askPrice) / 2 : 0;
            
            return (
              <div
                key={symbol}
                className="p-4 rounded-xl bg-white/60 border border-slate-200 hover:bg-white hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-bold text-slate-900">{symbol}</span>
                      {quote && (
                        <span className="badge badge-info">
                          ${midPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {quote && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1.5">
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-slate-600">Bid:</span>
                          <span className="font-semibold text-emerald-600">
                            ${quote.bidPrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
                          <span className="text-slate-600">Ask:</span>
                          <span className="font-semibold text-rose-600">
                            ${quote.askPrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center gap-1.5">
                          <Minus className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-slate-600">Spread:</span>
                          <span className="font-semibold text-slate-900">
                            ${quote.spread.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {!quote && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      <span className="text-sm font-medium">Loading...</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
