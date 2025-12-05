'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, TrendingUp, Users, Star, Heart, Award, Shield,
  Play, BarChart3, AlertCircle, CheckCircle, MessageSquare
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function StrategyDetail() {
  const params = useParams();
  const router = useRouter();
  const [strategy, setStrategy] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUseModal, setShowUseModal] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadStrategy();
      loadReviews();
    }
  }, [params.id]);

  const loadStrategy = async () => {
    try {
      const response = await api.get(`/api/strategies/${params.id}`);
      setStrategy(response.data);
    } catch (error) {
      console.error('Failed to load strategy:', error);
      toast.error('Failed to load strategy');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const response = await api.get(`/api/strategies/${params.id}/reviews`);
      setReviews(response.data);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    }
  };

  const handleFavorite = async () => {
    try {
      await api.post(`/api/strategies/${params.id}/favorite`, {
        favorite: !strategy.is_favorited
      });

      setStrategy({
        ...strategy,
        is_favorited: !strategy.is_favorited,
        favorites_count: strategy.favorites_count + (strategy.is_favorited ? -1 : 1)
      });

      toast.success(strategy.is_favorited ? 'Removed from favorites' : 'Added to favorites');
    } catch (error) {
      toast.error('Failed to update favorite');
    }
  };

  const handleUseStrategy = () => {
    // Redirect to experiment creation with this strategy pre-selected
    router.push(`/experiments?strategyId=${params.id}`);
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'Conservative': return 'text-green-600 bg-green-100';
      case 'Moderate': return 'text-blue-600 bg-blue-100';
      case 'Aggressive': return 'text-orange-600 bg-orange-100';
      case 'Very Aggressive': return 'text-red-600 bg-red-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!strategy) {
    return (
      <DashboardLayout>
        <div className="glass-card p-12 text-center">
          <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">Strategy not found</h3>
          <button onClick={() => router.push('/marketplace')} className="btn-primary mt-4">
            Back to Marketplace
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => router.push('/marketplace')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Marketplace
        </button>

        {/* Strategy Header */}
        <div className="glass-card p-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Info */}
            <div className="flex-1">
              <div className="flex items-start gap-4 mb-4">
                <div className="text-6xl">{strategy.category === 'Technology' ? '💻' : strategy.category === 'AI-Powered' ? '🤖' : '📈'}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-slate-900">{strategy.title}</h1>
                    {strategy.is_featured && (
                      <span className="px-3 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        Featured
                      </span>
                    )}
                    {strategy.is_verified && (
                      <span className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-lg mb-4">{strategy.description}</p>

                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getRiskColor(strategy.risk_level)}`}>
                      {strategy.risk_level}
                    </span>
                    <span className="px-3 py-1 rounded-full text-sm font-semibold text-slate-600 bg-slate-100">
                      {strategy.category}
                    </span>
                    {strategy.tags && strategy.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 rounded-full text-sm text-slate-600 bg-slate-100">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Creator */}
              {strategy.creator_name && (
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                  <span>Created by</span>
                  <span className="font-semibold">{strategy.creator_name}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleUseStrategy}
                  className="btn-primary flex items-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Use in Experiment
                </button>
                <button
                  onClick={handleFavorite}
                  className={`btn-secondary flex items-center gap-2 ${
                    strategy.is_favorited ? 'bg-rose-100 text-rose-600 border-rose-300' : ''
                  }`}
                >
                  <Heart className={`w-5 h-5 ${strategy.is_favorited ? 'fill-current' : ''}`} />
                  {strategy.is_favorited ? 'Favorited' : 'Favorite'}
                </button>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="lg:w-80 space-y-4">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  30-Day Performance
                </div>
                <div className="text-4xl font-bold text-green-600">
                  {strategy.performance_30d > 0 ? '+' : ''}{strategy.performance_30d}%
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <Users className="w-5 h-5 text-blue-600 mb-2" />
                  <div className="text-2xl font-bold text-slate-900">{strategy.uses_count.toLocaleString()}</div>
                  <div className="text-xs text-slate-600">Users</div>
                </div>

                <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                  <Heart className="w-5 h-5 text-rose-600 mb-2" />
                  <div className="text-2xl font-bold text-slate-900">{strategy.favorites_count}</div>
                  <div className="text-xs text-slate-600">Favorites</div>
                </div>
              </div>

              {parseFloat(strategy.avg_rating) > 0 && (
                <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-100">
                  <div className="flex items-center gap-2 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${
                          i < Math.floor(parseFloat(strategy.avg_rating))
                            ? 'text-yellow-400 fill-current'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{parseFloat(strategy.avg_rating).toFixed(1)}</div>
                  <div className="text-xs text-slate-600">{strategy.review_count} reviews</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Performance Metrics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {strategy.performance_7d && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">7-Day Return</div>
                <div className={`text-2xl font-bold ${strategy.performance_7d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {strategy.performance_7d > 0 ? '+' : ''}{strategy.performance_7d}%
                </div>
              </div>
            )}
            {strategy.performance_90d && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">90-Day Return</div>
                <div className={`text-2xl font-bold ${strategy.performance_90d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {strategy.performance_90d > 0 ? '+' : ''}{strategy.performance_90d}%
                </div>
              </div>
            )}
            {strategy.win_rate && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">Win Rate</div>
                <div className="text-2xl font-bold text-blue-600">{strategy.win_rate}%</div>
              </div>
            )}
            {strategy.sharpe_ratio && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-sm text-slate-600 mb-1">Sharpe Ratio</div>
                <div className="text-2xl font-bold text-indigo-600">{strategy.sharpe_ratio}</div>
              </div>
            )}
          </div>
        </div>

        {/* Watchlist */}
        {strategy.watchlist && strategy.watchlist.length > 0 && (
          <div className="glass-card p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Default Watchlist</h2>
            <div className="flex flex-wrap gap-3">
              {strategy.watchlist.map(symbol => (
                <span key={symbol} className="px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 font-semibold">
                  {symbol}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            User Reviews ({reviews.length})
          </h2>

          {reviews.length === 0 ? (
            <p className="text-slate-600 text-center py-8">No reviews yet. Be the first to review this strategy!</p>
          ) : (
            <div className="space-y-4">
              {reviews.slice(0, 5).map((review) => (
                <div key={review.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-slate-900">{review.username || 'Anonymous'}</div>
                      <div className="flex items-center gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating ? 'text-yellow-400 fill-current' : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-slate-700">{review.comment}</p>
                  )}
                  {review.profit_achieved && (
                    <div className="mt-2 text-sm text-green-600 font-semibold">
                      Profit: {review.profit_achieved > 0 ? '+' : ''}{review.profit_achieved}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
