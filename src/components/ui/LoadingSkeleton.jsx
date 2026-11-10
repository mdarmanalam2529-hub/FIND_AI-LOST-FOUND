import React from 'react';

export default function LoadingSkeleton({ 
  variant = 'card', // 'card' | 'table-row' | 'stat' | 'text' | 'image'
  count = 1,
  className = '' 
}) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'stat') {
    return (
      <div className="skeleton-grid">
        {items.map((i) => (
          <div key={i} className={`skeleton-stat-card ${className}`}>
            <div className="skeleton-line skeleton-title" style={{ width: '40%' }} />
            <div className="skeleton-line skeleton-value" style={{ width: '60%', height: '28px' }} />
            <div className="skeleton-line skeleton-meta" style={{ width: '50%' }} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <tbody className={className}>
        {items.map((i) => (
          <tr key={i} className="skeleton-row">
            <td><div className="skeleton-line" style={{ width: '50px', height: '50px', borderRadius: '8px' }} /></td>
            <td><div className="skeleton-line" style={{ width: '80%' }} /></td>
            <td><div className="skeleton-line" style={{ width: '60%' }} /></td>
            <td><div className="skeleton-line" style={{ width: '40%' }} /></td>
            <td><div className="skeleton-line" style={{ width: '70%' }} /></td>
            <td><div className="skeleton-line" style={{ width: '60px' }} /></td>
          </tr>
        ))}
      </tbody>
    );
  }

  if (variant === 'card') {
    return (
      <div className="skeleton-card-grid">
        {items.map((i) => (
          <div key={i} className={`skeleton-item-card ${className}`}>
            <div className="skeleton-image" />
            <div className="skeleton-content">
              <div className="skeleton-line skeleton-badge" style={{ width: '30%' }} />
              <div className="skeleton-line skeleton-title" style={{ width: '85%' }} />
              <div className="skeleton-line skeleton-desc" style={{ width: '65%' }} />
              <div className="skeleton-footer">
                <div className="skeleton-line" style={{ width: '40%' }} />
                <div className="skeleton-line" style={{ width: '25%' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`skeleton-wrapper ${className}`}>
      {items.map((i) => (
        <div key={i} className="skeleton-line" />
      ))}
    </div>
  );
}
