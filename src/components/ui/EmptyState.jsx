import React from 'react';
import { Search } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Search,
  title = 'No items found',
  description = 'There are currently no records matching your criteria.',
  action,
  className = '',
}) {
  return (
    <div className={`empty-state-box ${className}`}>
      <div className="empty-state-icon">
        <Icon size={32} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
