export default function AccountSummary({ accountData, performance }) {
  if (!accountData || !performance) return null;

  const cards = [
    {
      title: 'Portfolio Value',
      value: `$${parseFloat(accountData.portfolio_value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: performance.performance.dayReturnPercent,
      icon: '💼'
    },
    {
      title: 'Buying Power',
      value: `$${parseFloat(accountData.buying_power).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: `Cash: $${parseFloat(accountData.cash).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: '💰'
    },
    {
      title: 'Total Return',
      value: `${performance.performance.totalReturnPercent >= 0 ? '+' : ''}${performance.performance.totalReturnPercent.toFixed(2)}%`,
      change: performance.performance.totalReturnPercent,
      icon: '📈'
    },
    {
      title: 'Open Positions',
      value: performance.positions.count.toString(),
      subtitle: `Value: $${performance.positions.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: '📊'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">{card.title}</span>
            <span className="text-2xl">{card.icon}</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{card.value}</div>
          {card.change !== undefined && (
            <div
              className={`text-sm font-medium ${
                card.change >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {card.change >= 0 ? '+' : ''}{card.change.toFixed(2)}% today
            </div>
          )}
          {card.subtitle && (
            <div className="text-sm text-slate-400">{card.subtitle}</div>
          )}
        </div>
      ))}
    </div>
  );
}
