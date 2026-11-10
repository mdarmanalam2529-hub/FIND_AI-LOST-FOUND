import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Search, 
  UploadCloud, 
  Sparkles,
  ShieldAlert,
  Handshake,
  Check
} from 'lucide-react';

export default function StatusBadge({ status, type, size = 'md', className = '' }) {
  const normStatus = (status || '').toLowerCase();
  const normType = (type || '').toLowerCase();

  // If specific report type is requested (lost / found)
  if (normType === 'lost') {
    return (
      <span className={`badge badge-lost badge-${size} ${className}`}>
        <Search size={size === 'sm' ? 12 : 14} /> Lost
      </span>
    );
  }

  if (normType === 'found') {
    return (
      <span className={`badge badge-found badge-${size} ${className}`}>
        <UploadCloud size={size === 'sm' ? 12 : 14} /> Found
      </span>
    );
  }

  // Claim & Handover statuses
  switch (normStatus) {
    case 'open':
    case 'active':
      return (
        <span className={`badge badge-primary badge-${size} ${className}`}>
          <Clock size={size === 'sm' ? 12 : 14} /> Open
        </span>
      );

    case 'pending':
    case 'under_review':
    case 'under review':
      return (
        <span className={`badge badge-warning badge-${size} ${className}`}>
          <Clock size={size === 'sm' ? 12 : 14} /> Pending Review
        </span>
      );

    case 'approved':
    case 'accepted':
      return (
        <span className={`badge badge-found badge-${size} ${className}`}>
          <CheckCircle2 size={size === 'sm' ? 12 : 14} /> Approved
        </span>
      );

    case 'rejected':
    case 'denied':
      return (
        <span className={`badge badge-lost badge-${size} ${className}`}>
          <XCircle size={size === 'sm' ? 12 : 14} /> Rejected
        </span>
      );

    case 'completed':
    case 'resolved':
    case 'returned':
      return (
        <span className={`badge badge-found badge-${size} ${className}`}>
          <Check size={size === 'sm' ? 12 : 14} /> Returned
        </span>
      );

    case 'scheduled':
    case 'meeting_scheduled':
      return (
        <span className={`badge badge-primary badge-${size} ${className}`}>
          <Handshake size={size === 'sm' ? 12 : 14} /> Handover Scheduled
        </span>
      );

    case 'suspended':
    case 'flagged':
    case 'critical':
      return (
        <span className={`badge badge-lost badge-${size} ${className}`}>
          <ShieldAlert size={size === 'sm' ? 12 : 14} /> Flagged
        </span>
      );

    case 'ai_matched':
    case 'matched':
      return (
        <span className={`badge badge-primary badge-${size} ${className}`}>
          <Sparkles size={size === 'sm' ? 12 : 14} /> AI Matched
        </span>
      );

    default:
      return (
        <span className={`badge badge-neutral badge-${size} ${className}`}>
          {status || 'Unknown'}
        </span>
      );
  }
}
