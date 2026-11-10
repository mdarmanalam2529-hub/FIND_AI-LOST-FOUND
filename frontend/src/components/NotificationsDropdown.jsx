import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Clock, ShieldAlert, CheckCircle2, X } from 'lucide-react';
import { claimsService } from '../services/claimsService';

export default function NotificationsDropdown() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const loadNotifications = async () => {
    try {
      const data = await claimsService.fetchNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleMarkRead = async (notif) => {
    if (notif.read_at) return;
    try {
      await claimsService.markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Non-fatal
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '50%',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: unreadCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
          cursor: 'pointer',
          position: 'relative',
        }}
        title="Notifications"
        id="btn-notifications-bell"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              background: 'var(--lost-accent)',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg-surface)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="glass-card"
          style={{
            position: 'absolute',
            top: '46px',
            right: 0,
            width: '340px',
            maxWidth: '90vw',
            padding: '1rem',
            zIndex: 160,
            boxShadow: 'var(--shadow-lg)',
            maxHeight: '400px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            background: 'var(--bg-surface)',
          }}
          id="notifications-panel"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Activity Notifications</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{unreadCount} unread</span>
          </div>

          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No notifications yet. You will be alerted when claims or handovers update.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleMarkRead(n)}
                style={{
                  background: n.read_at ? 'var(--bg-subtle)' : 'var(--primary-subtle)',
                  border: n.read_at ? '1px solid var(--border-subtle)' : '1px solid var(--primary-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 0.75rem',
                  fontSize: '0.82rem',
                  cursor: n.read_at ? 'default' : 'pointer',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                }}
              >
                {!n.read_at && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)', marginTop: '5px', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ color: n.read_at ? 'var(--text-secondary)' : 'var(--text-main)', fontWeight: n.read_at ? 400 : 600, lineHeight: 1.4, marginBottom: '0.2rem' }}>
                    {n.message}
                  </p>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                    {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
