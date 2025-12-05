'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  Brain,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronDown,
  ChevronUp,
  Code,
  Zap,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';

export default function AIAnalysisLog({ experimentId, botId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [experimentId, botId, filter]);

  const fetchLogs = async () => {
    try {
      let endpoint = '/api/ai-analysis';
      if (experimentId) {
        endpoint = `/api/ai-analysis/experiment/${experimentId}`;
      } else if (botId) {
        endpoint = `/api/ai-analysis/bot/${botId}`;
      }

      const params = new URLSearchParams({ limit: 50 });
      if (filter !== 'all') {
        params.append('decision', filter);
      }

      const response = await api.get(`${endpoint}?${params}`);
      setLogs(response.data.logs || []);
    } catch (error) {
      console.error('Failed to fetch AI logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDecisionBadge = (decision) => {
    switch (decision) {
      case 'BUY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success-light text-success text-xs font-semibold">
            <TrendingUp className="w-3 h-3" />
            BUY
          </span>
        );
      case 'SELL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-danger-light text-danger text-xs font-semibold">
            <TrendingDown className="w-3 h-3" />
            SELL
          </span>
        );
      case 'SKIP':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-100 text-content-secondary text-xs font-semibold">
            <AlertCircle className="w-3 h-3" />
            SKIP
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-danger-light text-danger text-xs font-semibold">
            <XCircle className="w-3 h-3" />
            ERROR
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-100 text-content-tertiary text-xs font-semibold">
            {decision || 'N/A'}
          </span>
        );
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const toggleExpand = (logId) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  if (loading) {
    return (
      <div className="card-elevated p-6">
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-body text-content-secondary">Loading AI Analysis Logs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-brand-500" />
          <h3 className="text-heading font-bold text-content-primary">AI Analysis Log</h3>
          <span className="text-caption text-content-tertiary">({logs.length} entries)</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input text-sm py-1.5 px-3"
          >
            <option value="all">All Decisions</option>
            <option value="BUY">Buy Only</option>
            <option value="SELL">Sell Only</option>
            <option value="SKIP">Skip Only</option>
          </select>
          <button
            onClick={fetchLogs}
            className="btn-secondary btn-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs */}
      {logs.length === 0 ? (
        <div className="card-elevated p-6">
          <div className="empty-state py-8">
            <div className="empty-state-icon">
              <Brain className="w-7 h-7 text-content-tertiary" />
            </div>
            <p className="empty-state-title">No AI analysis yet</p>
            <p className="empty-state-text">
              AI analysis logs will appear here when the AI News Trader processes news articles.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="card-elevated overflow-hidden">
              {/* Log Header */}
              <div
                className="p-4 cursor-pointer hover:bg-surface-50 transition-colors"
                onClick={() => toggleExpand(log.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getDecisionBadge(log.decision)}
                      {log.trade_executed && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-semibold">
                          <CheckCircle className="w-3 h-3" />
                          Trade Executed
                        </span>
                      )}
                      <span className="text-caption text-content-tertiary">
                        {log.confidence_score ? `${log.confidence_score}% confidence` : ''}
                      </span>
                    </div>
                    <h4 className="text-body font-semibold text-content-primary truncate">
                      {log.news_headline || 'Unknown Article'}
                    </h4>
                    <div className="flex items-center gap-4 mt-1 text-caption text-content-secondary">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(log.created_at)}
                      </span>
                      {log.processing_time_ms && (
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {log.processing_time_ms}ms
                        </span>
                      )}
                      {log.symbols && log.symbols.length > 0 && (
                        <span className="text-brand-500 font-medium">
                          {log.symbols.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedLog === log.id ? (
                      <ChevronUp className="w-5 h-5 text-content-tertiary" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-content-tertiary" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedLog === log.id && (
                <div className="border-t border-surface-100 p-4 bg-surface-50 space-y-4">
                  {/* Reasoning */}
                  {log.reasoning && (
                    <div>
                      <h5 className="text-caption font-semibold text-content-primary mb-2 flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        AI Reasoning
                      </h5>
                      <p className="text-body text-content-secondary bg-white p-3 rounded-lg border border-surface-100">
                        {log.reasoning}
                      </p>
                    </div>
                  )}

                  {/* Trade Details */}
                  {log.trade_executed && (
                    <div>
                      <h5 className="text-caption font-semibold text-content-primary mb-2 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        Trade Details
                      </h5>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-white p-3 rounded-lg border border-surface-100">
                          <p className="text-caption text-content-tertiary">Symbol</p>
                          <p className="text-body font-bold text-content-primary">{log.trade_symbol}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-surface-100">
                          <p className="text-caption text-content-tertiary">Side</p>
                          <p className={`text-body font-bold ${log.trade_side === 'BUY' ? 'text-success' : 'text-danger'}`}>
                            {log.trade_side}
                          </p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-surface-100">
                          <p className="text-caption text-content-tertiary">Quantity</p>
                          <p className="text-body font-bold text-content-primary">{log.trade_qty}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-surface-100">
                          <p className="text-caption text-content-tertiary">Price</p>
                          <p className="text-body font-bold text-content-primary">
                            ${log.trade_price?.toFixed(2) || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Function Calls */}
                  {log.function_calls && (
                    <div>
                      <h5 className="text-caption font-semibold text-content-primary mb-2 flex items-center gap-1">
                        <Code className="w-4 h-4" />
                        Function Calls ({(Array.isArray(log.function_calls) ? log.function_calls : (typeof log.function_calls === 'string' ? JSON.parse(log.function_calls) : [])).length})
                      </h5>
                      <div className="space-y-2">
                        {(Array.isArray(log.function_calls) ? log.function_calls : (typeof log.function_calls === 'string' ? JSON.parse(log.function_calls) : [])).map((call, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-lg border border-surface-100">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono bg-brand-50 text-brand-600 px-2 py-0.5 rounded">
                                {call.name}
                              </span>
                            </div>
                            <details className="text-caption">
                              <summary className="cursor-pointer text-content-secondary hover:text-content-primary">
                                View Details
                              </summary>
                              <div className="mt-2 space-y-2">
                                <div>
                                  <p className="text-content-tertiary text-xs mb-1">Arguments:</p>
                                  <pre className="text-xs bg-surface-50 p-2 rounded overflow-x-auto">
                                    {JSON.stringify(call.args, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-content-tertiary text-xs mb-1">Response:</p>
                                  <pre className="text-xs bg-surface-50 p-2 rounded overflow-x-auto max-h-32">
                                    {JSON.stringify(call.response, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </details>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Prompt */}
                  {log.prompt && (
                    <details>
                      <summary className="cursor-pointer text-caption font-semibold text-content-primary flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        View Full Prompt
                      </summary>
                      <pre className="mt-2 text-xs bg-white p-3 rounded-lg border border-surface-100 overflow-x-auto max-h-64 whitespace-pre-wrap">
                        {log.prompt}
                      </pre>
                    </details>
                  )}

                  {/* AI Response */}
                  {log.ai_response && (
                    <details>
                      <summary className="cursor-pointer text-caption font-semibold text-content-primary flex items-center gap-1">
                        <Brain className="w-4 h-4" />
                        View AI Response
                      </summary>
                      <pre className="mt-2 text-xs bg-white p-3 rounded-lg border border-surface-100 overflow-x-auto max-h-64 whitespace-pre-wrap">
                        {log.ai_response || '(No text response - used function calls only)'}
                      </pre>
                    </details>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 pt-2 border-t border-surface-100 text-caption text-content-tertiary">
                    <span>Model: {log.model_used}</span>
                    <span>Bot: {log.bot_id}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
