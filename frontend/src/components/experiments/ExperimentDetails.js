'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ExperimentDetails({ experimentId, onBack }) {
  const [experiment, setExperiment] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState(null);

  useEffect(() => {
    if (experimentId) {
      fetchExperimentDetails();
      const interval = setInterval(fetchExperimentDetails, 10000); // Refresh every 10s
      return () => clearInterval(interval);
    }
  }, [experimentId]);

  const fetchExperimentDetails = async () => {
    try {
      const [expResponse, resultsResponse] = await Promise.all([
        api.get(`/api/experiments/${experimentId}`),
        api.get(`/api/experiments/${experimentId}/results`)
      ]);

      setExperiment(expResponse.data);
      setResults(resultsResponse.data);
    } catch (error) {
      console.error('Failed to fetch experiment details:', error);
      toast.error('Failed to load experiment details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
        <p className="text-slate-400">Loading experiment details...</p>
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
        <p className="text-red-400">Experiment not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
        <button
          onClick={onBack}
          className="text-primary-400 hover:text-primary-300 mb-4 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Experiments
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">{experiment.id}</h2>
            <div className="text-sm text-slate-400 space-y-1">
              <p>Status: <span className="text-white">{experiment.status}</span></p>
              <p>Bots: {experiment.botCount}</p>
              <p>Started: {new Date(experiment.startTime).toLocaleString()}</p>
              {experiment.endTime && (
                <p>Ended: {new Date(experiment.endTime).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Comparison */}
      {results && results.results.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4">Performance Comparison</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Rank</th>
                  <th className="text-left py-3 px-2 text-slate-400 font-medium">Strategy</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Final Equity</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Profit/Loss</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Return %</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Trades</th>
                  <th className="text-right py-3 px-2 text-slate-400 font-medium">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {results.results.map((result, index) => (
                  <tr
                    key={result.botId}
                    className="border-b border-slate-700/50 hover:bg-slate-700/20 cursor-pointer"
                    onClick={() => setSelectedBot(result.botId)}
                  >
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-yellow-900' :
                        index === 1 ? 'bg-slate-400 text-slate-900' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-white font-medium">{result.strategy}</td>
                    <td className="py-3 px-2 text-right text-white">
                      ${result.finalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-2 text-right font-semibold ${
                      result.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {result.totalProfit >= 0 ? '+' : ''}${result.totalProfit.toFixed(2)}
                    </td>
                    <td className={`py-3 px-2 text-right font-semibold ${
                      result.returnPercent >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {result.returnPercent >= 0 ? '+' : ''}{result.returnPercent.toFixed(2)}%
                    </td>
                    <td className="py-3 px-2 text-right text-white">{result.totalTrades}</td>
                    <td className="py-3 px-2 text-right text-white">
                      {result.winRate.toFixed(1)}%
                      <span className="text-slate-500 ml-1">({result.winningTrades}W/{result.losingTrades}L)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bot Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {experiment.botsDetails?.map((bot) => (
          <div
            key={bot.id}
            className="bg-slate-800/50 backdrop-blur-sm p-4 rounded-lg border border-slate-700 hover:border-primary-500 transition-colors cursor-pointer"
            onClick={() => setSelectedBot(bot.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-white font-semibold">{bot.strategy}</h4>
                <p className="text-xs text-slate-400">{bot.id}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                bot.status === 'running' ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-200'
              }`}>
                {bot.status}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Equity:</span>
                <span className="text-white font-medium">
                  ${bot.metrics.currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">P&L:</span>
                <span className={`font-semibold ${
                  bot.metrics.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {bot.metrics.totalProfit >= 0 ? '+' : ''}${bot.metrics.totalProfit.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Trades:</span>
                <span className="text-white">
                  {bot.metrics.totalTrades} ({bot.metrics.winningTrades}W / {bot.metrics.losingTrades}L)
                </span>
              </div>
            </div>

            {/* Recent Trades */}
            {bot.trades && bot.trades.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-400 mb-2">Recent Trades:</p>
                <div className="space-y-1">
                  {bot.trades.slice(-3).reverse().map((trade, idx) => (
                    <div key={idx} className="text-xs flex justify-between">
                      <span className={trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                        {trade.side.toUpperCase()} {trade.qty} {trade.symbol}
                      </span>
                      <span className="text-slate-400">${trade.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Selected Bot Detail Modal could go here */}
    </div>
  );
}
