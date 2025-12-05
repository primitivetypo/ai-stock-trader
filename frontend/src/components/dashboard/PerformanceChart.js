'use client';

import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import api from '@/lib/api';

const timeRanges = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

export default function PerformanceChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState(30);

  useEffect(() => {
    loadChartData();
  }, [selectedRange]);

  const loadChartData = async () => {
    try {
      const sampleData = generateSampleData(selectedRange);
      setData(sampleData);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSampleData = (days) => {
    const data = [];
    const startValue = 100000;
    let currentValue = startValue;

    for (let i = 0; i < days; i++) {
      const change = (Math.random() - 0.48) * 1000;
      currentValue += change;

      data.push({
        date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        value: Math.round(currentValue),
      });
    }

    return data;
  };

  if (loading) {
    return (
      <div className="chart-container">
        <div className="flex items-center justify-center h-80">
          <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const startValue = data[0]?.value || 0;
  const endValue = data[data.length - 1]?.value || 0;
  const changePercent = ((endValue - startValue) / startValue) * 100;
  const changeAmount = endValue - startValue;
  const isPositive = changePercent >= 0;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-0 border border-surface-200 rounded-lg shadow-lg p-3">
          <p className="text-caption font-medium text-content-secondary mb-1">{label}</p>
          <p className="text-body font-bold text-content-primary tabular-nums">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="section-title">Portfolio Performance</h3>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-heading-lg font-bold text-content-primary tabular-nums">
              {formatCurrency(endValue)}
            </span>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-caption font-semibold ${
              isPositive ? 'bg-success-light text-success-dark' : 'bg-danger-light text-danger-dark'
            }`}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span className="tabular-nums">
                {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
              </span>
              <span className="text-content-tertiary mx-1">|</span>
              <span className="tabular-nums">
                {isPositive ? '+' : ''}{formatCurrency(changeAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="tabs">
          {timeRanges.map((range) => (
            <button
              key={range.days}
              onClick={() => setSelectedRange(range.days)}
              className={selectedRange === range.days ? 'tab-active' : 'tab'}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isPositive ? '#00c853' : '#ff3d57'}
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor={isPositive ? '#00c853' : '#ff3d57'}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e9ecef"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8f9bb3', fontSize: 12 }}
              dy={10}
              interval="preserveStartEnd"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8f9bb3', fontSize: 12 }}
              dx={-10}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              domain={['dataMin - 1000', 'dataMax + 1000']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isPositive ? '#00c853' : '#ff3d57'}
              strokeWidth={2}
              fill="url(#chartGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
