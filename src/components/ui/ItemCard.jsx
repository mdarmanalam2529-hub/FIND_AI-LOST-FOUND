import React from 'react';
import { MapPin, Calendar, Tag, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import ItemImage from '../ItemImage';
import StatusBadge from './StatusBadge';

export default function ItemCard({
  item,
  onClaim,
  onFindMatches,
  onViewDetails,
  showActions = true,
  className = '',
}) {
  if (!item) return null;

  const isLost = item.type === 'lost';
  const categoryLabel = (item.category || 'General').toUpperCase();
  const formattedDate = item.incident_date
    ? new Date(item.incident_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Unknown Date';

  return (
    <div className={`institution-item-card ${isLost ? 'type-lost' : 'type-found'} ${className}`}>
      {/* Visual Image Preview */}
      <div className="item-card-image-wrap">
        <ItemImage
          imagePath={item.image_url}
          altText={item.title}
          className="item-card-image"
          aspectRatio="16/10"
        />
        <div className="item-card-badges">
          <StatusBadge type={item.type} size="sm" />
          {item.status && item.status !== 'open' && (
            <StatusBadge status={item.status} size="sm" />
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="item-card-content">
        <div className="item-card-meta-top">
          <span className="item-category-tag">
            <Tag size={12} /> {categoryLabel}
          </span>
          {item.color && (
            <span className="item-color-tag">
              <span className="color-swatch" style={{ backgroundColor: item.color.toLowerCase() }} />
              {item.color}
            </span>
          )}
        </div>

        <h3 className="item-card-title" title={item.title}>
          {item.title}
        </h3>

        {item.description && (
          <p className="item-card-description">
            {item.description}
          </p>
        )}

        {/* Location & Date Footer */}
        <div className="item-card-details">
          <div className="detail-item" title={item.location_description || 'Campus Area'}>
            <MapPin size={13} className="detail-icon" />
            <span className="truncate">{item.location_description || 'Campus Area'}</span>
          </div>
          <div className="detail-item">
            <Calendar size={13} className="detail-icon" />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="item-card-actions">
            {!isLost && onClaim && (
              <button
                type="button"
                onClick={() => onClaim(item)}
                className="btn btn-sm btn-found w-full"
                id={`claim-btn-${item.id}`}
              >
                <ShieldCheck size={14} /> Claim This Item
              </button>
            )}

            {isLost && onFindMatches && (
              <button
                type="button"
                onClick={() => onFindMatches(item)}
                className="btn btn-sm btn-primary w-full"
                id={`match-btn-${item.id}`}
              >
                <Sparkles size={14} /> Find Matches
              </button>
            )}

            {onViewDetails && (
              <button
                type="button"
                onClick={() => onViewDetails(item)}
                className="btn btn-sm btn-secondary"
                aria-label="View Details"
              >
                Details <ArrowRight size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
