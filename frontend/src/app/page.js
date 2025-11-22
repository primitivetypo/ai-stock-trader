'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Bot, BarChart3, Shield, Zap, Target, Sparkles } from 'lucide-react';
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
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100/60 backdrop-blur-sm border border-blue-200/60 mb-6">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">AI-Powered Trading Platform</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6">
            <span className="gradient-text">Smart Trading,</span>
            <br />
            <span className="text-slate-900">Smarter Decisions</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Real-time abnormal volume detection with AI-powered paper trading.
            Practice without risk, master the market.
          </p>
        </div>

        {/* Login Card */}
        <div className="max-w-md mx-auto mb-20">
          <Login />
        </div>

        {/* Features Grid */}
        <div className="mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Everything you need to succeed
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Powerful features designed to help you make informed trading decisions
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={<TrendingUp className="w-7 h-7" />}
              title="Volume Detection"
              description="Advanced statistical analysis identifies abnormal trading volumes in real-time"
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Bot className="w-7 h-7" />}
              title="Auto Trading"
              description="Automated execution based on intelligent signal detection and market patterns"
              gradient="from-indigo-500 to-purple-500"
            />
            <FeatureCard
              icon={<BarChart3 className="w-7 h-7" />}
              title="Analytics Dashboard"
              description="Comprehensive performance metrics and insights to track your trading success"
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={<Shield className="w-7 h-7" />}
              title="Risk-Free Trading"
              description="Practice with paper trading on real market data without financial risk"
              gradient="from-emerald-500 to-teal-500"
            />
            <FeatureCard
              icon={<Zap className="w-7 h-7" />}
              title="Real-Time Data"
              description="Live market data streaming with WebSocket technology for instant updates"
              gradient="from-amber-500 to-orange-500"
            />
            <FeatureCard
              icon={<Target className="w-7 h-7" />}
              title="Smart Signals"
              description="AI-powered support and resistance level detection for optimal entry points"
              gradient="from-rose-500 to-red-500"
            />
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-24 mb-12">
          <div className="glass-card p-10 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <StatItem label="Active Traders" value="1,200+" />
              <StatItem label="Daily Trades" value="50K+" />
              <StatItem label="Success Rate" value="94%" />
              <StatItem label="Avg. Return" value="+28%" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-slate-600">
            <p className="text-sm">
              © 2024 AI Stock Trader. For educational purposes only.
            </p>
            <p className="text-xs mt-2 text-slate-500">
              Trading involves substantial risk. Practice with paper trading before real investments.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}


function FeatureCard({ icon, title, description, gradient }) {
  return (
    <div className="glass-card p-6 group hover:shadow-xl transition-all duration-300">
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
        <div className="text-white">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function StatItem({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">
        {value}
      </div>
      <div className="text-sm text-slate-600 font-medium">
        {label}
      </div>
    </div>
  );
}
