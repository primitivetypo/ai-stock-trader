'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';

export default function PerformanceChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChartData();
  }, []);

  const loadChartData = async () => {
    try {
      // In production, you'd fetch historical equity data
      // For now, we'll generate sample data
      const sampleData = generateSampleData();
      setData(sampleData);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSampleData = () => {
    const data = [];
    const startValue = 100000;
    let currentValue = startValue;

    for (let i = 0; i < 30; i++) {
      const change = (Math.random() - 0.48) * 1000; // Slight upward bias
      currentValue += change;

      data.push({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
        value: Math.round(currentValue)
      });
    }

    return data;
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
        <div className="text-white">Loading chart...</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">Performance (30 Days)</h2>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
          <YAxis stroke="#94a3b8" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px'
            }}
            labelStyle={{ color: '#f1f5f9' }}
            itemStyle={{ color: '#0ea5e9' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
