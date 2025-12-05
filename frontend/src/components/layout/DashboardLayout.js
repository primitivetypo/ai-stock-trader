'use client';

import { useState, useEffect } from 'react';
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
  Sparkles,
  Settings,
  Bell,
  Search,
  ChevronRight
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Trading', href: '/trading', icon: TrendingUp },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Watchlist', href: '/watchlist', icon: Eye },
  { name: 'Experiments', href: '/experiments', icon: FlaskConical },
  { name: 'Marketplace', href: '/marketplace', icon: Sparkles },
];

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState({ name: 'User', email: 'user@example.com' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      if (userData.name) {
        setUser(userData);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-content-primary/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-surface-0 border-r border-surface-200 transform transition-transform duration-300 ease-smooth ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center px-5 border-b border-surface-100">
            <Link href="/dashboard" className="flex items-center gap-3" onClick={closeSidebar}>
              <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-heading font-bold text-content-primary">TradeAI</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={closeSidebar}
                  className={isActive ? 'nav-item-active' : 'nav-item'}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-3 border-t border-surface-100">
            <Link
              href="/settings"
              onClick={closeSidebar}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                pathname === '/settings'
                  ? 'bg-brand-50 text-brand-600'
                  : 'hover:bg-surface-50'
              }`}
            >
              <div className="avatar-sm">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium text-content-primary truncate">
                  {user.name}
                </p>
                <p className="text-caption text-content-tertiary truncate">
                  {user.email}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-content-tertiary" />
            </Link>

            <button
              onClick={handleLogout}
              className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-lg text-body font-medium text-content-secondary hover:bg-danger-light hover:text-danger transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-surface-0/80 backdrop-blur-md border-b border-surface-100">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden btn-icon"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Search (Desktop) */}
            <div className="hidden md:flex items-center flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
                <input
                  type="text"
                  placeholder="Search symbols, features..."
                  className="input input-with-icon py-2 text-caption"
                />
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <button className="btn-icon relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
              </button>

              <div className="hidden sm:block pl-2 border-l border-surface-200 ml-2">
                <div className="flex items-center gap-3 px-2">
                  <div className="text-right">
                    <p className="text-caption font-medium text-content-primary">{user.name}</p>
                    <p className="text-tiny text-content-tertiary">Paper Trading</p>
                  </div>
                  <div className="avatar-sm">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6 min-h-[calc(100vh-4rem)]">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
