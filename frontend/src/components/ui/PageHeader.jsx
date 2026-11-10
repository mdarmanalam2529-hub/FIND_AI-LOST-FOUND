import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PageHeader({
  title,
  subtitle,
  badge,
  breadcrumbs = [],
  actions,
  className = '',
}) {
  return (
    <div className={`page-header ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight size={14} className="breadcrumb-separator" />}
              {crumb.href ? (
                <Link to={crumb.href} className="breadcrumb-link">
                  {crumb.label}
                </Link>
              ) : (
                <span className="breadcrumb-current">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="page-header-content">
        <div className="page-header-titles">
          <div className="title-row">
            <h1 className="page-title">{title}</h1>
            {badge && <span className="page-title-badge">{badge}</span>}
          </div>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>

        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </div>
  );
}
