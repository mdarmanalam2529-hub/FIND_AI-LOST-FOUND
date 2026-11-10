import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  description,
  accentColor = 'primary', // 'primary' | 'lost' | 'found' | 'warning' | 'violet'
  onClick,
  className = '',
}) {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={`stat-card stat-card-${accentColor} ${isClickable ? 'is-clickable' : ''} ${className}`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        {Icon && (
          <div className={`stat-card-icon-wrap icon-${accentColor}`}>
            <Icon size={20} />
          </div>
        )}
      </div>

      <div className="stat-card-body">
        <div className="stat-card-value">{value ?? '—'}</div>

        {(trend || trendLabel || description) && (
          <div className="stat-card-footer">
            {trend && (
              <span className={`stat-trend ${trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : 'trend-neutral'}`}>
                {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(trend)}%
              </span>
            )}
            {trendLabel && <span className="stat-trend-label">{trendLabel}</span>}
            {description && !trendLabel && <span className="stat-description">{description}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
