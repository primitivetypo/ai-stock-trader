'use client';

import { useState, useEffect } from 'react';
import { Eye, ArrowRight } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';
import Link from 'next/link';

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

  if (watchlist.length === 0) {
    return (
      <div className="card-elevated p-6 h-full flex flex-col">
        <div className="section-header">
          <h3 className="section-title">Market Watch</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="empty-state-icon">
            <Eye className="w-7 h-7 text-content-tertiary" />
          </div>
          <p className="empty-state-title">No symbols tracked</p>
          <p className="empty-state-text mb-4">
            Add symbols to your watchlist to monitor them here
          </p>
          <Link href="/watchlist" className="btn-primary btn-sm">
            Go to Watchlist
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated p-6 h-full flex flex-col">
      <div className="section-header">
        <h3 className="section-title">Market Watch</h3>
        <Link href="/watchlist" className="btn-ghost btn-sm text-brand-500">
          View all
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin">
        {watchlist.slice(0, 6).map((symbol) => {
          const quote = quotes[symbol];
          const midPrice = quote ? (quote.bidPrice + quote.askPrice) / 2 : 0;

          return (
            <div
              key={symbol}
              className="flex items-center justify-between p-3 rounded-lg border border-surface-200 hover:border-brand-200 hover:bg-surface-50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-body group-hover:bg-brand-100 transition-colors">
                  {symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="text-body font-semibold text-content-primary">{symbol}</p>
                  {quote && (
                    <p className="text-caption text-content-tertiary">
                      Spread: ${quote.spread.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                {quote ? (
                  <>
                    <p className="text-body font-bold text-content-primary tabular-nums">
                      ${midPrice.toFixed(2)}
                    </p>
                    <div className="flex items-center gap-2 text-caption tabular-nums">
                      <span className="text-success">${quote.bidPrice.toFixed(2)}</span>
                      <span className="text-content-tertiary">/</span>
                      <span className="text-danger">${quote.askPrice.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-surface-300 border-t-brand-500 rounded-full animate-spin" />
                    <span className="text-caption text-content-tertiary">Loading</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {watchlist.length > 6 && (
        <div className="pt-3 mt-3 border-t border-surface-100">
          <Link
            href="/watchlist"
            className="text-caption text-brand-500 font-medium hover:text-brand-600"
          >
            +{watchlist.length - 6} more symbols
          </Link>
        </div>
      )}
    </div>
  );
}
