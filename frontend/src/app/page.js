'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Login from '@/components/auth/Login';

export default function Home() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            AI Stock Trader
          </h1>
          <p className="text-xl text-slate-300">
            Real-Time Abnormal Volume Detection with Paper Trading
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <Login />
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <FeatureCard
            icon="📊"
            title="Volume Detection"
            description="Real-time abnormal volume detection using statistical analysis"
          />
          <FeatureCard
            icon="🤖"
            title="Auto Trading"
            description="Automated trade execution based on detected opportunities"
          />
          <FeatureCard
            icon="📈"
            title="Performance Analytics"
            description="Track your trading performance with detailed metrics"
          />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}
