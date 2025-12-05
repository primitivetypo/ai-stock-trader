import { TrendingUp, TrendingDown, Wallet, DollarSign, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function AccountSummary({ accountData, performance }) {
  if (!accountData || !performance) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="metric-card">
            <div className="skeleton h-4 w-24 mb-3" />
            <div className="skeleton h-8 w-32 mb-2" />
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  const portfolioValue = parseFloat(accountData.portfolio_value);
  const buyingPower = parseFloat(accountData.buying_power);
  const cash = parseFloat(accountData.cash);
  const dayReturn = performance.performance.dayReturnPercent;
  const totalReturn = performance.performance.totalReturnPercent;
  const positionsCount = performance.positions.count;
  const positionsValue = performance.positions.totalValue;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const metrics = [
    {
      label: 'Portfolio Value',
      value: formatCurrency(portfolioValue),
      change: dayReturn,
      changeLabel: 'today',
      icon: Wallet,
    },
    {
      label: 'Buying Power',
      value: formatCurrency(buyingPower),
      subtitle: `Cash: ${formatCurrency(cash)}`,
      icon: DollarSign,
    },
    {
      label: 'Total Return',
      value: `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`,
      change: totalReturn,
      changeLabel: 'all time',
      icon: TrendingUp,
      isPercentValue: true,
    },
    {
      label: 'Open Positions',
      value: positionsCount.toString(),
      subtitle: `Value: ${formatCurrency(positionsValue)}`,
      icon: PieChart,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const isPositive = metric.change >= 0;

        return (
          <div key={metric.label} className="metric-card group">
            <div className="flex items-start justify-between mb-3">
              <span className="metric-label">{metric.label}</span>
              <div className="p-2 rounded-lg bg-surface-100 text-content-secondary group-hover:bg-brand-50 group-hover:text-brand-500 transition-colors">
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className={`metric-value tabular-nums ${metric.isPercentValue ? (isPositive ? 'text-success' : 'text-danger') : ''}`}>
              {metric.value}
            </div>

            {metric.change !== undefined && (
              <div className={isPositive ? 'metric-change-up' : 'metric-change-down'}>
                {isPositive ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                <span className="tabular-nums">
                  {isPositive ? '+' : ''}{metric.change.toFixed(2)}%
                </span>
                <span className="text-content-tertiary font-normal ml-1">{metric.changeLabel}</span>
              </div>
            )}

            {metric.subtitle && (
              <p className="text-caption text-content-secondary mt-1">{metric.subtitle}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
