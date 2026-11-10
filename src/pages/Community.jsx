import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { communityService } from '../services/communityService';
import { itemsService } from '../services/itemsService';
import CommunityItemDetailModal from '../components/CommunityItemDetailModal';
import ReportListingModal from '../components/ReportListingModal';
import ClaimModal from '../components/ClaimModal';
import HeroAnimatedBackground from '../components/HeroAnimatedBackground';
import {
  Search,
  RefreshCw,
  Filter,
  Package,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Calendar,
  Tag,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  FileQuestion,
  Users,
  Compass,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'keys-wallets', label: 'Keys & Wallets' },
  { id: 'clothing', label: 'Clothing & Apparel' },
  { id: 'documents', label: 'Documents & IDs' },
  { id: 'jewelry', label: 'Jewelry & Watches' },
  { id: 'other', label: 'Other Items' },
];

export default function Community() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Primary list state
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    totalActive: 0,
    totalLost: 0,
    totalFound: 0,
    totalResolved: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters state
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'lost' | 'found'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all_active'); // 'all_active' | 'resolved' | 'all'
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month'
  const [sortFilter, setSortFilter] = useState('newest'); // 'newest' | 'oldest'
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modals state
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [reportingAbuseItem, setReportingAbuseItem] = useState(null);
  const [claimingFoundItem, setClaimingFoundItem] = useState(null);
  const [userReports, setUserReports] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  const isFilterActive =
    typeFilter !== 'all' ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all_active' ||
    dateFilter !== 'all' ||
    sortFilter !== 'newest' ||
    debouncedSearch.length > 0;

  // Show temporary toast feedback
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load user's own reports for ClaimModal linking
  useEffect(() => {
    if (user?.id) {
      itemsService
        .getUserReports(user.id)
        .then((reports) => setUserReports(reports || []))
        .catch((err) => console.warn('[Community] User reports fetch notice:', err.message));
    }
  }, [user]);

  // Load community feed items
  const loadCommunityFeed = useCallback(
    async (pageNumber = 1, isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await communityService.fetchCommunityItems({
          page: pageNumber,
          limit: pagination.limit,
          type: typeFilter,
          category: categoryFilter,
          status: statusFilter,
          date: dateFilter,
          sort: sortFilter,
          search: debouncedSearch,
        });

        setItems(data.items || []);
        setPagination(data.pagination || { page: pageNumber, limit: 12, total: 0, totalPages: 1 });
        if (data.stats) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error('[Community Feed] Error loading items:', err);
        setError(err.message || 'Unable to connect to campus feed. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pagination.limit, typeFilter, categoryFilter, statusFilter, dateFilter, sortFilter, debouncedSearch]
  );

  useEffect(() => {
    loadCommunityFeed(pagination.page);
  }, [loadCommunityFeed, pagination.page]);

  const handleResetFilters = () => {
    setTypeFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all_active');
    setDateFilter('all');
    setSortFilter('newest');
    setSearchQuery('');
    setDebouncedSearch('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleOpenClaim = (foundItem) => {
    setClaimingFoundItem(foundItem);
  };

  const handleClaimSubmitted = () => {
    showToast('Claim submitted successfully! Check "My Claims" in your workspace to track progress.');
    loadCommunityFeed(pagination.page);
  };

  const handleReportAbuseSuccess = () => {
    showToast('Listing reported to campus moderation. Thank you for keeping our community safe.');
  };

  return (
    <>
      <HeroAnimatedBackground variant="ambient" />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
          {/* Toast Notification */}
          {toastMessage && (
            <div
              style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 1400,
                background: 'var(--text-main, #0f172a)',
                color: '#ffffff',
                padding: '0.85rem 1.25rem',
                borderRadius: '10px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                fontSize: '0.9rem',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <CheckCircle2 size={18} color="#10b981" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Header Section */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1.25rem',
              marginBottom: '1.75rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'var(--primary-subtle, rgba(37, 99, 235, 0.08))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary, #2563eb)',
                  }}
                >
                  <Users size={20} />
                </div>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: 'var(--text-main, #0f172a)', letterSpacing: '-0.02em' }}>
                  Campus Community
                </h1>
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted, #64748b)' }}>
                Discover lost and found items reported by your campus community.
              </p>
            </div>

            {/* Refresh Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => loadCommunityFeed(pagination.page, true)}
                disabled={loading || refreshing}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.88rem',
                  padding: '0.55rem 0.95rem',
                }}
                title="Refresh feed"
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Live Statistics Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1.75rem',
            }}
          >
            {/* Total Active */}
            <div
              className="glass-card"
              style={{
                padding: '1.15rem 1.25rem',
                borderRadius: '12px',
                background: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(37, 99, 235, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary, #2563eb)',
                  flexShrink: 0,
                }}
              >
                <Compass size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
                  Active Reports
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                  {stats.totalActive}
                </div>
              </div>
            </div>

            {/* Lost Items */}
            <div
              className="glass-card"
              style={{
                padding: '1.15rem 1.25rem',
                borderRadius: '12px',
                background: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'var(--lost-subtle, rgba(239, 68, 68, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--lost-accent, #ef4444)',
                  flexShrink: 0,
                }}
              >
                <Search size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
                  Lost Items
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--lost-accent, #ef4444)' }}>
                  {stats.totalLost}
                </div>
              </div>
            </div>

            {/* Found Items */}
            <div
              className="glass-card"
              style={{
                padding: '1.15rem 1.25rem',
                borderRadius: '12px',
                background: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'var(--found-subtle, rgba(16, 185, 129, 0.08))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--found-accent, #10b981)',
                  flexShrink: 0,
                }}
              >
                <Package size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
                  Found Items
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--found-accent, #10b981)' }}>
                  {stats.totalFound}
                </div>
              </div>
            </div>

            {/* Resolved */}
            <div
              className="glass-card"
              style={{
                padding: '1.15rem 1.25rem',
                borderRadius: '12px',
                background: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6366f1',
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
                  Reunited / Resolved
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#6366f1' }}>
                  {stats.totalResolved}
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Controls Bar */}
          <div
            className="glass-card"
            style={{
              padding: '1.25rem',
              borderRadius: '14px',
              background: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              marginBottom: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Top row: Search Bar & Type Tabs */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.85rem',
              }}
            >
              {/* Type Tabs */}
              <div
                style={{
                  display: 'inline-flex',
                  background: 'var(--bg-subtle, #f1f5f9)',
                  padding: '3px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                }}
              >
                {[
                  { id: 'all', label: 'All Items' },
                  { id: 'lost', label: 'Lost Items' },
                  { id: 'found', label: 'Found Items' },
                ].map((tab) => {
                  const isActive = typeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setTypeFilter(tab.id);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      style={{
                        padding: '0.45rem 1rem',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: isActive ? '#ffffff' : 'transparent',
                        color: isActive ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Search Input */}
              <div
                style={{
                  position: 'relative',
                  flex: '1 1 300px',
                  maxWidth: '520px',
                }}
              >
                <Search
                  size={17}
                  color="var(--text-muted, #94a3b8)"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item, description, category, or location..."
                  style={{
                    width: '100%',
                    padding: '0.55rem 2.2rem 0.55rem 2.4rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, #cbd5e1)',
                    fontSize: '0.88rem',
                    background: 'var(--bg-surface, #ffffff)',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted, #94a3b8)',
                      display: 'flex',
                    }}
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Row: Granular Filters & Sorting */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.85rem',
              }}
            >
              {/* Category Dropdown */}
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  background: 'var(--bg-surface, #ffffff)',
                  fontSize: '0.85rem',
                  color: 'var(--text-main, #334155)',
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>

              {/* Status Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  background: 'var(--bg-surface, #ffffff)',
                  fontSize: '0.85rem',
                  color: 'var(--text-main, #334155)',
                }}
              >
                <option value="all_active">Active Items Only</option>
                <option value="resolved">Resolved / Reunited Only</option>
                <option value="all">All Statuses (Active & Resolved)</option>
              </select>

              {/* Date Filter */}
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  background: 'var(--bg-surface, #ffffff)',
                  fontSize: '0.85rem',
                  color: 'var(--text-main, #334155)',
                }}
              >
                <option value="all">Any Date</option>
                <option value="today">Reported Today</option>
                <option value="week">Past 7 Days</option>
                <option value="month">Past 30 Days</option>
              </select>

              {/* Sort Order */}
              <select
                value={sortFilter}
                onChange={(e) => {
                  setSortFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  background: 'var(--bg-surface, #ffffff)',
                  fontSize: '0.85rem',
                  color: 'var(--text-main, #334155)',
                }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>

              {/* Reset Filters Pill */}
              {isFilterActive && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    background: 'rgba(239, 68, 68, 0.05)',
                    color: '#ef4444',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  <X size={14} />
                  <span>Reset Filters</span>
                </button>
              )}

              {/* Matching count indicator */}
              <div style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted, #64748b)' }}>
                Showing <strong>{items.length}</strong> of <strong>{pagination.total}</strong> listings
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              className="glass-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                marginBottom: '1.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => loadCommunityFeed(pagination.page)}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading Skeletons */}
          {loading && !refreshing && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem',
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div
                  key={idx}
                  className="glass-card"
                  style={{
                    height: '320px',
                    borderRadius: '14px',
                    background: 'var(--bg-surface, #ffffff)',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    opacity: 0.6,
                  }}
                >
                  <div style={{ height: '140px', background: 'var(--bg-subtle, #f1f5f9)', borderRadius: '10px' }} />
                  <div style={{ height: '20px', width: '70%', background: 'var(--bg-subtle, #f1f5f9)', borderRadius: '4px' }} />
                  <div style={{ height: '14px', width: '90%', background: 'var(--bg-subtle, #f1f5f9)', borderRadius: '4px' }} />
                  <div style={{ height: '14px', width: '50%', background: 'var(--bg-subtle, #f1f5f9)', borderRadius: '4px' }} />
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && items.length === 0 && (
            <div
              className="glass-card"
              style={{
                textAlign: 'center',
                padding: '3.5rem 1.5rem',
                borderRadius: '16px',
                background: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                margin: '2rem 0',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--bg-subtle, #f1f5f9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-dim, #94a3b8)',
                  margin: '0 auto 1.25rem',
                }}
              >
                <FileQuestion size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main, #0f172a)', marginBottom: '0.5rem' }}>
                No community listings found
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-muted, #64748b)', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
                {isFilterActive
                  ? 'No items matched your current filter criteria. Try clearing search keywords or resetting filters.'
                  : 'There are currently no active public reports on the campus community board.'}
              </p>
              {isFilterActive ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <RefreshCw size={15} />
                  <span>Clear All Filters</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/report-lost')}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <Search size={16} />
                  <span>Report a Lost Item</span>
                </button>
              )}
            </div>
          )}

          {/* Community Cards Grid */}
          {!loading && items.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem',
              }}
            >
              {items.map((item) => {
                const isLost = item.item_type === 'lost';
                const isResolved = item.status === 'returned' || item.status === 'matched';
                const formattedDate = item.incident_date
                  ? new Date(item.incident_date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Recent';

                return (
                  <div
                    key={item.id}
                    className="glass-card"
                    style={{
                      borderRadius: '14px',
                      background: 'var(--bg-surface, #ffffff)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderTop: isLost ? '3px solid var(--lost-accent, #ef4444)' : '3px solid var(--found-accent, #10b981)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    {/* Item Thumbnail */}
                    <div
                      style={{
                        position: 'relative',
                        height: '160px',
                        background: 'var(--bg-subtle, #f8fafc)',
                        cursor: 'pointer',
                        overflow: 'hidden',
                      }}
                      onClick={() => setSelectedDetailItem(item)}
                    >
                      {item.signed_image_url ? (
                        <img
                          src={item.signed_image_url}
                          alt={item.title}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-dim, #94a3b8)',
                            gap: '0.35rem',
                          }}
                        >
                          <Package size={36} />
                          <span style={{ fontSize: '0.75rem' }}>No photo available</span>
                        </div>
                      )}

                      {/* Badge Overlay */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '10px',
                          left: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span
                          className={isLost ? 'badge badge-lost' : 'badge badge-found'}
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', fontWeight: 600 }}
                        >
                          {isLost ? 'Lost' : 'Found'}
                        </span>
                        {isResolved && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '12px',
                              background: 'rgba(16, 185, 129, 0.9)',
                              color: '#ffffff',
                              fontWeight: 600,
                            }}
                          >
                            Resolved
                          </span>
                        )}
                      </div>

                      {/* Own listing marker */}
                      {item.is_own_listing && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            fontSize: '0.72rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '12px',
                            background: 'rgba(99, 102, 241, 0.9)',
                            color: '#ffffff',
                            fontWeight: 600,
                          }}
                        >
                          You
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      {/* Title */}
                      <h3
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          margin: '0 0 0.45rem 0',
                          color: 'var(--text-main, #0f172a)',
                          lineHeight: 1.35,
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedDetailItem(item)}
                      >
                        {item.title}
                      </h3>

                      {/* Short Description */}
                      <p
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-muted, #64748b)',
                          margin: '0 0 0.85rem 0',
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          flex: 1,
                        }}
                      >
                        {item.description || 'No detailed description.'}
                      </p>

                      {/* Metadata Details */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted, #64748b)',
                          marginBottom: '0.85rem',
                          borderTop: '1px solid var(--border-subtle, #f1f5f9)',
                          paddingTop: '0.65rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <MapPin size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.location_description || 'Campus Grounds'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Calendar size={14} color="#10b981" />
                            <span>{formattedDate}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim, #94a3b8)' }}>
                            by {item.reporter_name || 'Student'}
                          </span>
                        </div>
                      </div>

                      {/* Action Row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                          paddingTop: '0.85rem',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedDetailItem(item)}
                          className="btn btn-secondary"
                          style={{
                            flex: 1,
                            fontSize: '0.82rem',
                            padding: '0.45rem 0.65rem',
                            justifyContent: 'center',
                          }}
                        >
                          View Details
                        </button>

                        {/* Direct Claim action for Found items */}
                        {!isLost && !item.is_own_listing && !isResolved && (
                          <button
                            type="button"
                            onClick={() => handleOpenClaim(item)}
                            className="btn btn-primary"
                            style={{
                              fontSize: '0.82rem',
                              padding: '0.45rem 0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                            title="Claim this found item"
                          >
                            <ShieldCheck size={14} />
                            <span>Claim</span>
                          </button>
                        )}

                        {/* Report listing flag */}
                        {!item.is_own_listing && (
                          <button
                            type="button"
                            onClick={() => setReportingAbuseItem(item)}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border-subtle, #e2e8f0)',
                              borderRadius: '8px',
                              padding: '0.45rem 0.55rem',
                              color: 'var(--text-muted, #94a3b8)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="Report listing to moderators"
                          >
                            <ShieldAlert size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                marginTop: '1.5rem',
              }}
            >
              <button
                type="button"
                onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page <= 1 || loading}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>

              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted, #64748b)' }}>
                Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
              </span>

              <button
                type="button"
                onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

      {/* Item Detail Modal */}
      {selectedDetailItem && (
        <CommunityItemDetailModal
          item={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
          onOpenClaim={(foundItem) => handleOpenClaim(foundItem)}
          onOpenAiMatches={(targetItem) => {
            navigate(`/dashboard?tab=ai-matches&targetId=${targetItem.id}`);
          }}
          onOpenReportAbuse={(targetItem) => setReportingAbuseItem(targetItem)}
          onNavigateToMyReports={() => navigate('/dashboard?tab=my-reports')}
        />
      )}

      {/* Report Abuse Modal */}
      {reportingAbuseItem && (
        <ReportListingModal
          item={reportingAbuseItem}
          onClose={() => setReportingAbuseItem(null)}
          onReportSuccess={handleReportAbuseSuccess}
        />
      )}

      {/* Secure Claim Modal (Reusing FindAI claim & handover workflow) */}
      {claimingFoundItem && (
        <ClaimModal
          foundItem={claimingFoundItem}
          userReports={userReports}
          onClose={() => setClaimingFoundItem(null)}
          onClaimSubmitted={handleClaimSubmitted}
        />
      )}
    </>
  );
}

