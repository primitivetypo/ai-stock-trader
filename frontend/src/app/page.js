'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Login from '@/components/auth/Login';
import { TrendingUp, BarChart3, Zap, Shield, FlaskConical, ArrowRight } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

const features = [
  {
    icon: TrendingUp,
    title: 'Real-Time Trading',
    description: 'Execute paper trades with live market data and instant order fills'
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    description: 'Track your portfolio performance with comprehensive charts and metrics'
  },
  {
    icon: Zap,
    title: 'Volume Detection',
    description: 'Get real-time alerts for unusual volume spikes and market anomalies'
  },
  {
    icon: FlaskConical,
    title: 'Trading Experiments',
    description: 'Test automated strategies with virtual portfolios before going live'
  }
];

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-surface-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-0/80 backdrop-blur-md border-b border-surface-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-heading font-bold text-content-primary">TradeAI</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-body text-content-secondary hover:text-content-primary transition-colors">
                Features
              </a>
              <a href="#about" className="text-body text-content-secondary hover:text-content-primary transition-colors">
                About
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-16">
        <section className="relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-surface-50 to-surface-50" />
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(12, 135, 235, 0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Hero Content */}
              <div className="text-center lg:text-left animate-fade-in">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 mb-6">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-caption font-medium text-brand-600">Paper Trading Platform</span>
                </div>

                <h1 className="text-display font-bold text-content-primary mb-6 tracking-tight">
                  Master trading with <span className="text-gradient">AI-powered</span> insights
                </h1>

                <p className="text-body-lg text-content-secondary mb-8 max-w-xl mx-auto lg:mx-0">
                  Practice trading strategies risk-free with real market data. Get volume alerts,
                  support/resistance levels, and run automated experiments.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                  <a href="#login" className="btn-primary btn-lg">
                    Get Started Free
                    <ArrowRight className="w-5 h-5" />
                  </a>
                  <a href="#features" className="btn-secondary btn-lg">
                    Learn More
                  </a>
                </div>

                {/* Stats */}
                <div className="mt-12 grid grid-cols-3 gap-8 max-w-md mx-auto lg:mx-0">
                  <div>
                    <p className="text-heading-lg font-bold text-content-primary">$100K</p>
                    <p className="text-caption text-content-tertiary">Virtual Capital</p>
                  </div>
                  <div>
                    <p className="text-heading-lg font-bold text-content-primary">5+</p>
                    <p className="text-caption text-content-tertiary">Strategies</p>
                  </div>
                  <div>
                    <p className="text-heading-lg font-bold text-content-primary">Real</p>
                    <p className="text-caption text-content-tertiary">Market Data</p>
                  </div>
                </div>
              </div>

              {/* Login Form */}
              <div id="login" className="flex justify-center lg:justify-end">
                <Login />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-surface-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-display font-bold text-content-primary mb-4">
                Everything you need to trade smarter
              </h2>
              <p className="text-body-lg text-content-secondary max-w-2xl mx-auto">
                Built for traders who want to practice and refine their strategies without financial risk
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="card-elevated p-6 text-center group">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 text-brand-500 mb-4 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-heading font-semibold text-content-primary mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-body text-content-secondary">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-20 bg-surface-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-display font-bold text-content-primary mb-6">
                  Why paper trading matters
                </h2>
                <p className="text-body-lg text-content-secondary mb-6">
                  Paper trading lets you test strategies, learn market dynamics, and build confidence
                  before risking real capital. Our platform provides real market data so your simulated
                  trades reflect actual market conditions.
                </p>
                <ul className="space-y-4">
                  {[
                    'Practice with live market data from Alpaca',
                    'Test multiple strategies simultaneously',
                    'Get AI-powered volume and pattern alerts',
                    'Track performance with detailed analytics'
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-body text-content-secondary">
                      <div className="w-5 h-5 rounded-full bg-success-light flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-success" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-elevated p-8">
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="w-6 h-6 text-brand-500" />
                  <h3 className="text-heading font-semibold text-content-primary">
                    Risk-Free Learning
                  </h3>
                </div>
                <p className="text-body text-content-secondary mb-6">
                  Every account starts with $100,000 in virtual capital. Make trades, test strategies,
                  and learn from your decisions without any financial risk.
                </p>
                <div className="p-4 bg-surface-50 rounded-lg border border-surface-200">
                  <p className="text-caption text-content-tertiary">
                    Powered by Alpaca Markets for authentic paper trading experience
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-brand-500">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-display font-bold text-white mb-4">
              Ready to start trading?
            </h2>
            <p className="text-body-lg text-white/80 mb-8">
              Create your free account and get $100,000 in virtual capital to practice with.
            </p>
            <a href="#login" className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-white text-brand-600 font-semibold hover:bg-surface-50 transition-colors shadow-lg">
              Get Started Now
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 bg-surface-0 border-t border-surface-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <span className="text-body font-semibold text-content-primary">TradeAI</span>
              </div>
              <p className="text-caption text-content-tertiary">
                Paper trading platform. Not financial advice.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
