'use client';

import { useState, useEffect } from 'react';
import { Search, TrendingUp, Users, Star, Heart, Sparkles, Award, Shield, Filter } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

const categories = [
  { value: 'all', label: 'All Strategies' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Dividend', label: 'Dividend' },
  { value: 'AI-Powered', label: 'AI-Powered' },
  { value: 'Technical', label: 'Technical' },
  { value: 'Diversified', label: 'Diversified' }
];

const riskLevels = [
  { value: '', label: 'All Risk Levels' },
  { value: 'Conservative', label: 'Conservative' },
  { value: 'Moderate', label: 'Moderate' },
  { value: 'Aggressive', label: 'Aggressive' },
  { value: 'Very Aggressive', label: 'Very Aggressive' }
];

const sortOptions = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'performance', label: 'Best Performance' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Highest Rated' }
];

export default function StrategyMarketplace() {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [risk, setRisk] = useState('');
  const [sort, setSort] = useState('popular');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadStrategies();
  }, [category, risk, sort, search]);

  const loadStrategies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ sort, limit: 50 });

      if (category !== 'all') params.append('category', category);
      if (risk) params.append('risk', risk);
      if (search) params.append('search', search);

      const response = await api.get(`/api/strategies?${params}`);
      setStrategies(response.data.strategies || []);
    } catch (error) {
      console.error('Failed to load strategies:', error);
      toast.error('Failed to load strategies');
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async (strategyId, currentlyFavorited) => {
    try {
      await api.post(`/api/strategies/${strategyId}/favorite`, {
        favorite: !currentlyFavorited
      });

      setStrategies(strategies.map(s =>
        s.id === strategyId
          ? { ...s, is_favorited: !currentlyFavorited, favorites_count: s.favorites_count + (currentlyFavorited ? -1 : 1) }
          : s
      ));

      toast.success(currentlyFavorited ? 'Removed from favorites' : 'Added to favorites');
    } catch (error) {
      toast.error('Failed to update favorite');
    }
  };

  const getRiskBadge = (risk) => {
    switch (risk) {
      case 'Conservative': return 'badge-success';
      case 'Moderate': return 'badge-brand';
      case 'Aggressive': return 'badge-warning';
      case 'Very Aggressive': return 'badge-danger';
      default: return 'badge-default';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-brand-500" />
            Marketplace
          </h1>
          <p className="page-subtitle">Discover and use community-shared trading strategies</p>
        </div>

        {/* Search and Filters */}
        <div className="card-elevated p-5">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search strategies..."
                className="input input-with-icon"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="select"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>

              <select
                value={risk}
                onChange={(e) => setRisk(e.target.value)}
                className="select"
              >
                {riskLevels.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="select"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Strategies Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="card-elevated p-5">
                <div className="skeleton h-6 w-3/4 mb-3" />
                <div className="skeleton h-4 w-full mb-2" />
                <div className="skeleton h-4 w-2/3 mb-4" />
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="skeleton h-16 rounded-lg" />
                  <div className="skeleton h-16 rounded-lg" />
                </div>
                <div className="skeleton h-10 rounded-lg" />
              </div>
            ))}
          </div>
        ) : strategies.length === 0 ? (
          <div className="card-elevated p-6">
            <div className="empty-state py-12">
              <div className="empty-state-icon">
                <Sparkles className="w-7 h-7 text-content-tertiary" />
              </div>
              <p className="empty-state-title">No strategies found</p>
              <p className="empty-state-text">Try adjusting your search or filters</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((strategy) => (
              <div key={strategy.id} className="card-interactive p-5 group">
                {/* Header with badges */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {strategy.is_verified && (
                      <span className="badge-brand flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                    {strategy.is_featured && (
                      <span className="badge-warning flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        Featured
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleFavorite(strategy.id, strategy.is_favorited);
                    }}
                    className={`p-2 rounded-lg transition-all ${
                      strategy.is_favorited
                        ? 'bg-danger-light text-danger'
                        : 'bg-surface-100 text-content-tertiary hover:bg-danger-light hover:text-danger'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${strategy.is_favorited ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Title & Description */}
                <h3 className="text-heading font-bold text-content-primary mb-2 line-clamp-1">
                  {strategy.title}
                </h3>
                <p className="text-caption text-content-secondary mb-4 line-clamp-2">
                  {strategy.description}
                </p>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-success-light/50 border border-success/10">
                    <div className="flex items-center gap-1 text-tiny text-content-tertiary mb-1">
                      <TrendingUp className="w-3 h-3" />
                      30d Return
                    </div>
                    <div className={`text-body font-bold tabular-nums ${
                      strategy.performance_30d >= 0 ? 'text-success' : 'text-danger'
                    }`}>
                      {strategy.performance_30d > 0 ? '+' : ''}{strategy.performance_30d}%
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-brand-50 border border-brand-100">
                    <div className="flex items-center gap-1 text-tiny text-content-tertiary mb-1">
                      <Users className="w-3 h-3" />
                      Users
                    </div>
                    <div className="text-body font-bold text-brand-600 tabular-nums">
                      {strategy.uses_count.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className={getRiskBadge(strategy.risk_level)}>
                    {strategy.risk_level}
                  </span>
                  <span className="badge-default">{strategy.category}</span>
                </div>

                {/* Rating */}
                {parseFloat(strategy.avg_rating) > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < Math.floor(parseFloat(strategy.avg_rating))
                              ? 'text-warning fill-current'
                              : 'text-surface-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-caption text-content-secondary">
                      {parseFloat(strategy.avg_rating).toFixed(1)} ({strategy.review_count})
                    </span>
                  </div>
                )}

                {/* Action Button */}
                <Link
                  href={`/marketplace/${strategy.id}`}
                  className="btn-primary w-full btn-sm"
                >
                  View Details
                  <TrendingUp className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
