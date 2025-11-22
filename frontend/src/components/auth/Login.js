'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Mail, Lock, User, ArrowRight, Sparkles } from 'lucide-react';
import api from '@/lib/api';

export default function Login() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const data = isLogin
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await api.post(endpoint, data);

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-8 md:p-10 max-w-md w-full animate-slide-in-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-4 shadow-lg shadow-blue-500/30">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-slate-600">
          {isLogin ? 'Sign in to your trading account' : 'Start your trading journey today'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {!isLogin && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-primary pl-11"
                placeholder="John Doe"
                required={!isLogin}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input-primary pl-11"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input-primary pl-11"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white/80 text-slate-600">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="mt-4 text-blue-600 hover:text-blue-700 font-semibold text-sm transition-colors"
        >
          {isLogin ? 'Sign up for free' : 'Sign in instead'}
        </button>
      </div>

      {isLogin && (
        <div className="mt-6 p-4 rounded-xl bg-blue-50/50 border border-blue-100">
          <p className="text-sm text-slate-700 font-medium mb-2">Demo Account</p>
          <p className="text-xs text-slate-600">
            Email: <span className="font-mono font-semibold">demo@demo.com</span><br />
            Password: <span className="font-mono font-semibold">demo123</span>
          </p>
        </div>
      )}
    </div>
  );
}
