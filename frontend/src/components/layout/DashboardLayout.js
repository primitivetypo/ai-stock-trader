'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  Eye,
  FlaskConical,
  LogOut,
  Menu,
  X,
  Sparkles
} from 'lucide-react';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Trading', href: '/trading', icon: TrendingUp },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Watchlist', href: '/watchlist', icon: Eye },
    { name: 'Experiments', href: '/experiments', icon: FlaskConical },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-white/80 backdrop-blur-sm shadow-lg border border-slate-200 text-slate-700 hover:bg-white transition-all"
      >
        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 w-72 h-screen transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="h-full px-4 py-6 bg-white/60 backdrop-blur-xl border-r border-slate-200/60 flex flex-col">
          {/* Logo */}
          <div className="mb-8 px-2">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">AI Trader</h2>
                <p className="text-xs text-slate-600 font-medium">Paper Trading</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1.5">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                      : 'text-slate-700 hover:bg-white/80 hover:shadow-sm'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Profile Section */}
          <div className="pt-4 border-t border-slate-200">
            <div className="mb-3 px-4 py-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                  {typeof window !== 'undefined' && JSON.parse(localStorage.getItem('user') || '{}').name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {typeof window !== 'undefined' && JSON.parse(localStorage.getItem('user') || '{}').name || 'User'}
                  </p>
                  <p className="text-xs text-slate-600 truncate">
                    {typeof window !== 'undefined' && JSON.parse(localStorage.getItem('user') || '{}').email || 'user@example.com'}
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-all duration-200 font-medium"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-72">
        <main className="p-4 lg:p-8 min-h-screen">
          {children}
        </main>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
