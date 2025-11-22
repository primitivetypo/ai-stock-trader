import { Wallet, DollarSign, TrendingUp, Package } from 'lucide-react';

export default function AccountSummary({ accountData, performance }) {
  if (!accountData || !performance) return null;

  const cards = [
    {
      title: 'Portfolio Value',
      value: `$${parseFloat(accountData.portfolio_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: performance.performance.dayReturnPercent,
      icon: Wallet,
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Buying Power',
      value: `$${parseFloat(accountData.buying_power).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: `Cash: $${parseFloat(accountData.cash).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      gradient: 'from-emerald-500 to-teal-500'
    },
    {
      title: 'Total Return',
      value: `${performance.performance.totalReturnPercent >= 0 ? '+' : ''}${performance.performance.totalReturnPercent.toFixed(2)}%`,
      change: performance.performance.totalReturnPercent,
      icon: TrendingUp,
      gradient: 'from-indigo-500 to-purple-500'
    },
    {
      title: 'Open Positions',
      value: performance.positions.count.toString(),
      subtitle: `Value: $${performance.positions.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Package,
      gradient: 'from-amber-500 to-orange-500'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="stats-card group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="stats-label">{card.title}</span>
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="stats-value mb-2">{card.value}</div>
            {card.change !== undefined && (
              <div
                className={`text-sm font-semibold flex items-center gap-1 ${
                  card.change >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                <span>{card.change >= 0 ? '↑' : '↓'}</span>
                <span>{card.change >= 0 ? '+' : ''}{card.change.toFixed(2)}% today</span>
              </div>
            )}
            {card.subtitle && (
              <div className="text-sm text-slate-600 font-medium">{card.subtitle}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
