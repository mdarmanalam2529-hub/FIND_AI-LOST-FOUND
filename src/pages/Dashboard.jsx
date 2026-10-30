
import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Search,
  UploadCloud,
  Tag,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Mail,
  Edit3,
  Trash2,
  AlertCircle,
  Loader2,
  MapPin,
  Calendar,
  X,
  Layers,
  Globe,
  Camera,
  RefreshCw,
  GraduationCap,
  Users,
  FileText,
  Handshake,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { itemsService } from '../services/itemsService';
import ItemImage from '../components/ItemImage';
import ClaimsManager from '../components/ClaimsManager';
import ClaimModal from '../components/ClaimModal';
import TiltCard from '../components/TiltCard';
import AiMatchingVisualizer from '../components/AiMatchingVisualizer';
import HeroAnimatedBackground from '../components/HeroAnimatedBackground';
import { adminService } from '../services/adminService';
import { isAdminUser, isStaffOrAdminUser, isPrimaryAdminUser, getUserRoleTitle } from '../lib/roleHelpers';


export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  // isConfigured indicates if Supabase credentials are present

  const [activeTab, setActiveTab] = useState('my-reports'); // 'my-reports' | 'ai-matches' | 'community-feed' | 'claims'
  const [claimingFoundItem, setClaimingFoundItem] = useState(null);
  const [preselectedLostItem, setPreselectedLostItem] = useState(null);
  const [userReports, setUserReports] = useState([]);
  const [communityReports, setCommunityReports] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [tableError, setTableError] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState(null);

  // Zoom / Lightbox State
  const [zoomImageUrl, setZoomImageUrl] = useState(null);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    status: 'open',
    color: '',
    location_description: '',
  });
  const [newImageFile, setNewImageFile] = useState(null);
  const [newImagePreview, setNewImagePreview] = useState(null);
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const [editImageError, setEditImageError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // AI Matching State
  const [selectedMatchItem, setSelectedMatchItem] = useState(null);
  const [matchingTarget, setMatchingTarget] = useState(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingError, setMatchingError] = useState(null);
  const [matchResults, setMatchResults] = useState([]);
  const [matchesCache, setMatchesCache] = useState({});
  const [expandedBreakdowns, setExpandedBreakdowns] = useState({});

  const isPrimaryAdmin = isPrimaryAdminUser(user);
  const isAdmin = isAdminUser(user);
  const isStaffOrAdmin = isStaffOrAdminUser(user);
  const roleTitle = getUserRoleTitle(user);

  const fullName = user?.user_metadata?.full_name 
    || (isPrimaryAdmin ? 'Primary Administrator' : isAdmin ? 'System Administrator' : isStaffOrAdmin ? 'Staff Member' : user?.email?.split('@')[0])
    || 'Community Member';
  const email = user?.email || 'N/A';
  const isEmailVerified = Boolean(user?.email_confirmed_at);
  const memberSince = user?.created_at 
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Recent';

  // Load items from Supabase
  const loadData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setTableError(null);

    try {
      const [userItems, openItems] = await Promise.all([
        itemsService.getUserReports(user.id),
        itemsService.getOpenReports(),
      ]);
      setUserReports(userItems);
      setCommunityReports(openItems);
    } catch (err) {
      console.error('[Dashboard] Error loading items:', err);
      if (err.message?.includes('relation "public.items" does not exist') || err.code === '42P01') {
        setTableError('Database table "items" has not been created yet. Please execute the migration SQL in your Supabase SQL Editor.');
      } else {
        setTableError(err.message || 'Failed to fetch items from Supabase.');
      }
    } finally {
      setDataLoading(false);
    }
  }, [user]);


  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load admin dashboard statistics (authorized admins only)
  const fetchAdminStats = useCallback(async () => {
    if (!isAdmin) {
      setAdminLoading(false);
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    try {
      const data = await adminService.fetchDashboard();
      setAdminStats(data);
    } catch (err) {
      console.error('[Dashboard] Admin stats load error:', err);
      setAdminError(err.message || 'Failed to load admin statistics.');
    } finally {
      setAdminLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminStats();
    }
  }, [isAdmin, fetchAdminStats]);

  // Handle AI Matching
  const handleFindMatches = useCallback(async (item, forceRefresh = false) => {
    if (!item) return;
    setSelectedMatchItem(item);
    setMatchingTarget(item);
    setMatchingError(null);

    // If already cached and not force refreshing, use cached results
    if (!forceRefresh && matchesCache[item.id]) {
      setMatchResults(matchesCache[item.id]);
      return;
    }

    setMatchingLoading(true);
    setMatchResults([]);
    setExpandedBreakdowns({});

    try {
      const data = await itemsService.findMatches(item.id, { limit: 10 });
      const results = data.matches || [];
      setMatchResults(results);
      setMatchesCache((prev) => ({ ...prev, [item.id]: results }));
    } catch (err) {
      console.error('[Dashboard] Error finding matches:', err);
      setMatchingError(err.message || 'Failed to calculate candidate matches.');
    } finally {
      setMatchingLoading(false);
    }
  }, [matchesCache]);

  // Auto-select first open report when switching to ai-matches tab if none selected
  useEffect(() => {
    if (activeTab === 'ai-matches' && !selectedMatchItem && userReports.length > 0) {
      const firstOpen = userReports.find((r) => r.status === 'open') || userReports[0];
      if (firstOpen) {
        handleFindMatches(firstOpen);
      }
    }
  }, [activeTab, userReports, selectedMatchItem, handleFindMatches]);

  const toggleBreakdown = (candidateId) => {
    setExpandedBreakdowns((prev) => ({
      ...prev,
      [candidateId]: !prev[candidateId],
    }));
  };

  // Handle Delete Item and its associated image safely
  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete the report "${item.title}"? This action will also remove any attached image.`)) {
      return;
    }

    setDeletingId(item.id);
    try {
      await itemsService.deleteReportAndImage(item.id, item.image_path);
      setUserReports((prev) => prev.filter((i) => i.id !== item.id));
      setCommunityReports((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      console.error('[Dashboard] Error deleting item:', err);
      alert(err.message || 'Failed to delete report.');
    } finally {
      setDeletingId(null);
    }
  };

  // Open Edit Modal
  const startEdit = (item) => {
    setEditingItem(item);
    setEditFormData({
      title: item.title,
      description: item.description,
      status: item.status,
      color: item.color || '',
      location_description: item.location_description,
    });
    setNewImageFile(null);
    setNewImagePreview(null);
    setRemoveCurrentImage(false);
    setEditImageError(null);
  };

  const handleNewImageChange = (e) => {
    setEditImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = itemsService.validateImage(file);
    if (!validation.valid) {
      setEditImageError(validation.error);
      e.target.value = '';
      return;
    }

    setNewImageFile(file);
    setRemoveCurrentImage(false);
    if (newImagePreview) {
      URL.revokeObjectURL(newImagePreview);
    }
    setNewImagePreview(URL.createObjectURL(file));
  };

  // Submit Edit Modal
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    setUpdating(true);
    try {
      const updated = await itemsService.updateReportWithImage({
        itemId: editingItem.id,
        userId: user.id,
        updates: {
          title: editFormData.title.trim(),
          description: editFormData.description.trim(),
          status: editFormData.status,
          color: editFormData.color.trim() || null,
          location_description: editFormData.location_description.trim(),
        },
        newImageFile,
        removeCurrentImage,
        currentImagePath: editingItem.image_path,
      });

      setUserReports((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setCommunityReports((prev) => {
        if (updated.status === 'open') {
          return prev.map((item) => (item.id === updated.id ? updated : item));
        }
        return prev.filter((item) => item.id !== updated.id);
      });

      if (newImagePreview) {
        URL.revokeObjectURL(newImagePreview);
      }
      setEditingItem(null);
    } catch (err) {
      console.error('[Dashboard] Error updating item:', err);
      alert(err.message || 'Failed to update item.');
    } finally {
      setUpdating(false);
    }
  };

  // Metrics
  const activeLostCount = userReports.filter((i) => i.item_type === 'lost' && i.status === 'open').length;
  const foundItemsCount = userReports.filter((i) => i.item_type === 'found').length;
  const resolvedCount = userReports.filter((i) => i.status === 'returned' || i.status === 'matched').length;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 140px)' }}>
      {/* Softly animated background for authenticated dashboard */}
      <HeroAnimatedBackground variant="ambient" />

      <div className="container" style={{ position: 'relative', zIndex: 1, padding: '3rem 1.5rem 5rem' }} id="dashboard-page">
      
      {/* Table Missing Notice Alert */}
      {tableError && (
        <div 
          className="glass-card" 
          style={{ 
            marginBottom: '2rem', 
            borderColor: 'rgba(234, 179, 8, 0.4)', 
            background: 'rgba(234, 179, 8, 0.08)', 
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: '1rem' 
          }}
          id="dashboard-table-missing-alert"
        >
          <AlertCircle size={24} color="var(--warning-accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ color: 'var(--warning-accent)', fontSize: '1.05rem', marginBottom: '0.35rem' }}>
              Action Required: Database Migration Pending
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              {tableError}
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Run the SQL file located at <code>supabase/migrations/20261018100000_create_items_table.sql</code> in your Supabase SQL Editor.
            </p>
          </div>
        </div>
      )}

      {/* Authenticated User Status Card */}
      <div 
        className="glass-card" 
        style={{ 
          marginBottom: '2rem', 
          borderColor: 'var(--border-subtle)', 
          background: 'var(--bg-surface)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '1.5rem',
          flexWrap: 'wrap',
          boxShadow: 'var(--shadow-sm)'
        }}
        id="dashboard-user-card"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div 
            style={{ 
              width: '52px', 
              height: '52px', 
              borderRadius: 'var(--radius-md)', 
              background: 'var(--primary)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '1.35rem',
              fontWeight: 800,
              color: '#ffffff',
            }}
          >
            {fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.35rem', color: 'var(--text-main)', margin: 0 }}>Welcome, {fullName}</h2>
              {isPrimaryAdmin ? (
                <span className="badge" style={{ background: '#7c3aed', color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }} id="role-badge-primary-admin">
                  <ShieldAlert size={14} /> Primary Administrator
                </span>
              ) : isAdmin ? (
                <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }} id="role-badge-admin">
                  <ShieldCheck size={14} /> Administrator
                </span>
              ) : isStaffOrAdmin ? (
                <span className="badge badge-found" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }} id="role-badge-staff">
                  <Shield size={14} /> Staff Member
                </span>
              ) : user?.user_metadata?.registration_number ? (
                <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }} id="role-badge-student">
                  <GraduationCap size={14} /> Student ({user.user_metadata.registration_number})
                </span>
              ) : (
                <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }} id="role-badge-community">
                  <User size={14} /> Community Member
                </span>
              )}
              {isEmailVerified ? (
                <span className="badge badge-found" title="Email verified in Supabase">
                  <ShieldCheck size={14} /> Verified Account
                </span>
              ) : (
                <span className="badge badge-warning" title="Email confirmation pending">
                  <Mail size={14} /> Unconfirmed Email
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
              <span>{email}</span>
              <span>•</span>
              <span>Member since {memberSince}</span>
            </div>
          </div>
        </div>
        <div className="dashboard-action-buttons" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {isStaffOrAdmin && (
            <a 
              href="#admin-panel-section"
              className="btn btn-primary btn-sm"
              id="dashboard-admin-panel-btn"
              style={{ background: '#7c3aed', borderColor: '#7c3aed', color: '#fff' }}
            >
              <ShieldCheck size={16} /> Admin Panel
            </a>
          )}
          <button 
            type="button" 
            onClick={() => {
              setActiveTab('ai-matches');
              if (!selectedMatchItem && userReports.length > 0) {
                const firstOpen = userReports.find((r) => r.status === 'open') || userReports[0];
                if (firstOpen) {
                  handleFindMatches(firstOpen);
                }
              }
            }}
            className={`btn ${activeTab === 'ai-matches' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            id="dashboard-ai-matches-btn"
          >
            <Sparkles size={16} /> AI Matches
          </button>
          <button 
            type="button" 
            onClick={() => setActiveTab('claims')}
            className="btn btn-secondary btn-sm"
            id="dashboard-claims-tab-btn"
          >
            <ShieldCheck size={16} color="var(--primary)" /> Claims &amp; Returns
          </button>
          <Link to="/report-lost" className="btn btn-lost btn-sm" id="dashboard-report-lost">
            <Search size={16} /> Report Lost Item
          </Link>
          <Link to="/report-found" className="btn btn-found btn-sm" id="dashboard-report-found">
            <UploadCloud size={16} /> Report Found Item
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="dashboard-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <TiltCard maxTilt={2}>
          <div className="glass-card" style={{ padding: '1.35rem', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>Active Lost Reports</span>
              <span className="badge badge-lost">{activeLostCount} Active</span>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{activeLostCount}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              Awaiting found matches
            </div>
          </div>
        </TiltCard>

        <TiltCard maxTilt={2}>
          <div className="glass-card" style={{ padding: '1.35rem', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>Found Items Contributed</span>
              <span className="badge badge-found">{foundItemsCount} Items</span>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{foundItemsCount}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              Helping the community
            </div>
          </div>
        </TiltCard>

        <TiltCard maxTilt={2}>
          <div className="glass-card" style={{ padding: '1.35rem', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>Community Open Feed</span>
              <span className="badge badge-primary">{communityReports.length} Open</span>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--primary)' }}>{communityReports.length}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              Public listings registered
            </div>
          </div>
        </TiltCard>

        <TiltCard maxTilt={2}>
          <div className="glass-card" style={{ padding: '1.35rem', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>Resolved &amp; Returned</span>
              <CheckCircle2 size={18} color="var(--found-accent)" />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{resolvedCount}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              Reunited cases
            </div>
          </div>
        </TiltCard>
      </div>

      {/* Admin Panel Section (Authorized Admins & Staff Only) */}
      {isStaffOrAdmin && (
        <section 
          id="admin-panel-section" 
          className="glass-card" 
          style={{ 
            marginBottom: '2.5rem', 
            padding: '1.75rem', 
            border: '1px solid rgba(124, 58, 237, 0.3)', 
            background: 'linear-gradient(180deg, rgba(124, 58, 237, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
            boxShadow: 'var(--shadow-md)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-md, 8px)', background: 'rgba(124, 58, 237, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={24} color="#8b5cf6" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Admin Panel
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, background: isPrimaryAdmin ? '#7c3aed' : 'var(--primary)', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    {roleTitle}
                  </span>
                </h3>
                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Centralized administrative controls, identity management, and moderation systems
                </p>
              </div>
            </div>

            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              onClick={fetchAdminStats}
              disabled={adminLoading}
              id="admin-panel-refresh-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RefreshCw size={14} className={adminLoading ? 'spin' : ''} />
              {adminLoading ? 'Refreshing...' : 'Refresh Metrics'}
            </button>
          </div>

          {/* Aggregated Statistics Bar */}
          {adminError ? (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid var(--warning-accent)', borderRadius: 'var(--radius-md, 8px)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={18} color="var(--warning-accent)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{adminError}</span>
            </div>
          ) : adminStats ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem', background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-lg, 12px)', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Students</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>{adminStats.totalStudents ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Lost Reports</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--lost-accent)' }}>{adminStats.totalLostReports ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Found Reports</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--found-accent)' }}>{adminStats.totalFoundReports ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Open Claims</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>{adminStats.totalClaims ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Handovers</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#06b6d4' }}>{adminStats.totalHandovers ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Incidents</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f59e0b' }}>{adminStats.totalIncidents ?? 0}</div>
              </div>
            </div>
          ) : null}

          {/* 5 Visible Management Action Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* 1. Manage Students */}
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <GraduationCap size={20} color="#3b82f6" />
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>Manage Students</h4>
                  </div>
                  <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>Registry</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4', margin: '0 0 1rem' }}>
                  Search students by registration number or name, inspect institutional eligibility, and activate or suspend student portal accounts.
                </p>
              </div>
              <Link to="/admin/students" className="btn btn-primary btn-sm" id="admin-panel-manage-students-btn" style={{ justifyContent: 'center' }}>
                Manage Students &rarr;
              </Link>
            </div>

            {/* 2. Manage Admins */}
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={20} color="#8b5cf6" />
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>Manage Admins</h4>
                  </div>
                  <span className="badge" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#8b5cf6', fontSize: '0.7rem', fontWeight: 600 }}>
                    {isPrimaryAdmin ? 'Primary Admin' : 'Admin'}
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4', margin: '0 0 1rem' }}>
                  List staff and administrators, invite or appoint administrative roles through the primary admin, and deactivate or revoke access safely.
                </p>
              </div>
              <Link to="/admin/management" className="btn btn-secondary btn-sm" id="admin-panel-manage-admins-btn" style={{ justifyContent: 'center' }}>
                Manage Admins &rarr;
              </Link>
            </div>

            {/* 3. Manage Reports */}
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={20} color="#eab308" />
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>Manage Reports</h4>
                  </div>
                  <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Moderation</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4', margin: '0 0 1rem' }}>
                  Review, verify, and moderate reported lost and found items. Handle flagged listings, inspect AI match scores, and resolve duplicates.
                </p>
              </div>
              <Link to="/admin/reports" className="btn btn-secondary btn-sm" id="admin-panel-manage-reports-btn" style={{ justifyContent: 'center' }}>
                Manage Reports &rarr;
              </Link>
            </div>

            {/* 4. Manage Claims */}
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={20} color="#10b981" />
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>Manage Claims</h4>
                  </div>
                  <span className="badge badge-found" style={{ fontSize: '0.7rem' }}>Verification</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4', margin: '0 0 1rem' }}>
                  Review ownership claims, verify claimant proof, approve returns, place claims on administrative hold, and resolve ownership disputes.
                </p>
              </div>
              <Link to="/admin/claims" className="btn btn-secondary btn-sm" id="admin-panel-manage-claims-btn" style={{ justifyContent: 'center' }}>
                Manage Claims &rarr;
              </Link>
            </div>

            {/* 5. Manage Handovers */}
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Handshake size={20} color="#06b6d4" />
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>Manage Handovers</h4>
                  </div>
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Custody</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4', margin: '0 0 1rem' }}>
                  Supervise physical handovers, generate secure handover tokens, track verified item transfers, and manage security custody holds.
                </p>
              </div>
              <Link to="/admin/handovers" className="btn btn-secondary btn-sm" id="admin-panel-manage-handovers-btn" style={{ justifyContent: 'center' }}>
                Manage Handovers &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Tabs: My Reports vs AI Matches vs Community Open Feed vs Claims */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('my-reports')}
          style={{
            background: activeTab === 'my-reports' ? 'var(--primary-subtle)' : 'transparent',
            border: 'none',
            color: activeTab === 'my-reports' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.94rem',
            cursor: 'pointer',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
          id="tab-my-reports"
        >
          <Layers size={17} /> My Reports ({userReports.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('ai-matches');
            if (!selectedMatchItem && userReports.length > 0) {
              const firstOpen = userReports.find((r) => r.status === 'open') || userReports[0];
              if (firstOpen) {
                handleFindMatches(firstOpen);
              }
            }
          }}
          style={{
            background: activeTab === 'ai-matches' ? 'var(--primary-subtle)' : 'transparent',
            border: 'none',
            color: activeTab === 'ai-matches' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.94rem',
            cursor: 'pointer',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
          id="tab-ai-matches"
        >
          <Sparkles size={17} color={activeTab === 'ai-matches' ? 'var(--primary)' : 'currentColor'} /> AI Matches
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('community-feed')}
          style={{
            background: activeTab === 'community-feed' ? 'var(--primary-subtle)' : 'transparent',
            border: 'none',
            color: activeTab === 'community-feed' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.94rem',
            cursor: 'pointer',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
          id="tab-community-feed"
        >
          <Globe size={17} /> Community Open Feed ({communityReports.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('claims')}
          style={{
            background: activeTab === 'claims' ? 'var(--primary-subtle)' : 'transparent',
            border: 'none',
            color: activeTab === 'claims' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.94rem',
            cursor: 'pointer',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
          id="tab-claims-returns"
        >
          <ShieldCheck size={17} color={activeTab === 'claims' ? 'var(--primary)' : 'currentColor'} /> Claims &amp; Returns
        </button>
      </div>

      {/* Main Content Area */}
      {(authLoading || dataLoading) ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Loader2 size={32} className="spin" style={{ margin: '0 auto 1rem', color: 'var(--primary-light)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Fetching live items from Supabase...</p>
        </div>
      ) : activeTab === 'claims' ? (
        <ClaimsManager
          userReports={userReports}
          onOpenClaimModal={(foundItem, lostItem) => {
            setClaimingFoundItem(foundItem);
            setPreselectedLostItem(lostItem || null);
          }}
        />
      ) : activeTab === 'my-reports' ? (
        /* MY REPORTS LIST */
        userReports.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-subtle)', border: '1px solid var(--primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <Sparkles size={24} color="var(--primary)" />
            </div>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>You have not reported any items yet</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
              Submit a report when you lose or find an item. Your records, photos, and AI matches will be displayed here.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/report-lost" className="btn btn-lost btn-sm">
                <Search size={15} /> Report Lost Item
              </Link>
              <Link to="/report-found" className="btn btn-found btn-sm">
                <UploadCloud size={15} /> Report Found Item
              </Link>
            </div>
          </div>
        ) : (
          <div className="reports-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: '1.25rem' }}>
            {userReports.map((item) => (
              <div 
                key={item.id} 
                className="glass-card" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  padding: 0,
                  overflow: 'hidden',
                  borderTop: item.item_type === 'lost' ? '3px solid var(--lost-accent)' : '3px solid var(--found-accent)'
                }}
              >
                {/* Image Section */}
                <ItemImage 
                  imagePath={item.image_path} 
                  alt={item.title} 
                  onClick={(url) => setZoomImageUrl(url)}
                />

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {/* Card Top Strip */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <span className={item.item_type === 'lost' ? 'badge badge-lost' : 'badge badge-found'}>
                      {item.item_type === 'lost' ? 'Lost Item' : 'Found Item'}
                    </span>
                    <span 
                      className={`badge ${item.status === 'open' ? 'badge-primary' : 'badge-found'}`}
                    >
                      Status: {item.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.18rem', marginBottom: '0.45rem', color: 'var(--text-main)' }}>{item.title}</h3>
                  
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.15rem', flex: 1, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                    {item.description}
                  </p>

                  {/* Details Footer */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={14} color="var(--lost-accent)" />
                      <span>{item.location_description}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Calendar size={14} /> {item.incident_date}
                      </span>
                      {item.color && (
                        <span>Color: {item.color}</span>
                      )}
                    </div>
                  </div>

                  {/* Find AI Matches Button for Eligible Open Reports */}
                  {item.status === 'open' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMatchItem(item);
                        setActiveTab('ai-matches');
                        handleFindMatches(item);
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}
                      id={`btn-match-${item.id}`}
                    >
                      <Sparkles size={15} /> Find AI Matches
                    </button>
                  )}

                  {/* Controls: Edit & Delete */}
                  <div style={{ display: 'flex', gap: '0.6rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--lost-accent)', borderColor: 'var(--lost-border)' }}
                      title="Delete report"
                    >
                      {deletingId === item.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'ai-matches' ? (
        /* AI MATCHES & MATCHING ACTIVITY SECTION */
        <div className="ai-matches-section-container" id="dashboard-ai-matches-section">
          {/* Header */}
          <div 
            className="glass-card" 
            style={{ 
              marginBottom: '1.75rem', 
              padding: '1.5rem', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              gap: '1rem', 
              flexWrap: 'wrap',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)' 
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span className="badge badge-primary">
                  <Sparkles size={13} /> Multimodal Intelligence
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Authenticated Vector Matching
                </span>
              </div>
              <h3 style={{ fontSize: '1.35rem', color: 'var(--text-main)', fontWeight: 700 }}>
                AI Matches &amp; Matching Activity
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.25rem 0 0', maxWidth: '640px', lineHeight: 1.5 }}>
                Our backend embeddings compare your item descriptions, categories, and photographs with open community reports to surface candidate similarities.
              </p>
            </div>

            {selectedMatchItem && (
              <button
                type="button"
                onClick={() => handleFindMatches(selectedMatchItem, true)}
                className="btn btn-secondary btn-sm"
                disabled={matchingLoading}
                id="btn-refresh-ai-matches"
                title="Re-run matching search against latest open reports"
              >
                <RefreshCw size={14} className={matchingLoading ? 'spin' : ''} /> {matchingLoading ? 'Scanning...' : 'Refresh Matches'}
              </button>
            )}
          </div>

          {/* User has NO reports at all */}
          {userReports.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-subtle)', border: '1px solid var(--primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <Sparkles size={26} color="var(--primary)" />
              </div>
              <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-main)', fontWeight: 700 }}>
                No Active Reports to Match
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.55 }}>
                Our AI matching engine requires an active lost or found item to analyze semantic and visual similarities. Report an item to begin receiving automated match recommendations.
              </p>
              <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/report-lost" className="btn btn-lost btn-sm" id="ai-matches-empty-report-lost">
                  <Search size={15} /> Report Lost Item
                </Link>
                <Link to="/report-found" className="btn btn-found btn-sm" id="ai-matches-empty-report-found">
                  <UploadCloud size={15} /> Report Found Item
                </Link>
              </div>
            </div>
          ) : userReports.filter((r) => r.status === 'open').length === 0 ? (
            /* User has reports, but none are open */
            <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--found-subtle)', border: '1px solid var(--found-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <CheckCircle2 size={26} color="var(--found-accent)" />
              </div>
              <h4 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-main)', fontWeight: 700 }}>
                All Current Reports Are Resolved
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.55 }}>
                You have no currently open reports waiting for matches. When you file a new lost or found report, candidate matches will automatically appear here.
              </p>
              <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/report-lost" className="btn btn-lost btn-sm">
                  <Search size={15} /> Report Lost Item
                </Link>
                <Link to="/report-found" className="btn btn-found btn-sm">
                  <UploadCloud size={15} /> Report Found Item
                </Link>
              </div>
            </div>
          ) : (
            /* User has open reports: Show Report Selector and AiMatchingVisualizer */
            <div>
              {/* Report Selection Pills */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.65rem', 
                  overflowX: 'auto', 
                  paddingBottom: '0.75rem', 
                  marginBottom: '1.25rem' 
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  Analyze Report:
                </span>
                {userReports
                  .filter((r) => r.status === 'open')
                  .map((item) => {
                    const isSelected = selectedMatchItem?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleFindMatches(item)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.45rem 0.85rem',
                          borderRadius: 'var(--radius-full)',
                          background: isSelected ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                          color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                          fontSize: '0.85rem',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                        id={`select-match-report-${item.id}`}
                      >
                        <span className={item.item_type === 'lost' ? 'badge badge-lost' : 'badge badge-found'} style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                          {item.item_type === 'lost' ? 'Lost' : 'Found'}
                        </span>
                        <span>{item.title}</span>
                      </button>
                    );
                  })}
              </div>

              {/* Target Report Context Bar */}
              {selectedMatchItem && (
                <div 
                  className="glass-card" 
                  style={{ 
                    padding: '1rem 1.25rem', 
                    marginBottom: '1.5rem', 
                    background: 'var(--bg-subtle)', 
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span className={selectedMatchItem.item_type === 'lost' ? 'badge badge-lost' : 'badge badge-found'}>
                      {selectedMatchItem.item_type === 'lost' ? 'Lost Report' : 'Found Report'}
                    </span>
                    <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>{selectedMatchItem.title}</strong>
                    {selectedMatchItem.category && (
                      <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                        <Tag size={11} /> {selectedMatchItem.category}
                      </span>
                    )}
                    {selectedMatchItem.location_description && (
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <MapPin size={13} color="var(--primary)" /> {selectedMatchItem.location_description}
                      </span>
                    )}
                  </div>

                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    Scanning candidate open {selectedMatchItem.item_type === 'lost' ? 'found' : 'lost'} items across community
                  </span>
                </div>
              )}

              {/* Matching Error Banner */}
              {matchingError ? (
                <div 
                  style={{ 
                    background: 'var(--lost-subtle)', 
                    border: '1px solid var(--lost-border)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '1.25rem', 
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    color: 'var(--lost-accent)'
                  }}
                >
                  <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>Matching Error</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '0.85rem', color: 'var(--text-secondary)' }}>
                      {matchingError}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleFindMatches(selectedMatchItem, true)}
                      className="btn btn-secondary btn-sm"
                    >
                      <RefreshCw size={14} /> Retry Search
                    </button>
                  </div>
                </div>
              ) : (
                /* Reusing the production AiMatchingVisualizer */
                <AiMatchingVisualizer
                  isLoading={matchingLoading}
                  results={matchResults}
                  expandedBreakdowns={expandedBreakdowns}
                  onToggleBreakdown={toggleBreakdown}
                  renderCandidateActions={(candidate) => (
                    <>
                      {selectedMatchItem?.item_type === 'lost' && candidate.user_id !== user?.id && candidate.item_type === 'found' && (
                        <button
                          type="button"
                          onClick={() => {
                            setClaimingFoundItem(candidate);
                            setPreselectedLostItem(selectedMatchItem);
                          }}
                          className="btn btn-primary btn-sm"
                          id={`ai-match-claim-${candidate.id}`}
                        >
                          <ShieldCheck size={14} /> Claim This Item
                        </button>
                      )}
                    </>
                  )}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        /* COMMUNITY OPEN FEED */
        communityReports.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-subtle)', border: '1px solid var(--primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <Globe size={24} color="var(--primary)" />
            </div>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No open community reports right now</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto' }}>
              All currently submitted reports have been resolved or matched. New community submissions will appear here live.
            </p>
          </div>
        ) : (
          <div className="reports-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: '1.25rem' }}>
            {communityReports.map((item) => (
              <div 
                key={item.id} 
                className="glass-card" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  padding: 0,
                  overflow: 'hidden',
                  borderTop: item.item_type === 'lost' ? '3px solid var(--lost-accent)' : '3px solid var(--found-accent)'
                }}
              >
                {/* Image Section */}
                <ItemImage 
                  imagePath={item.image_path} 
                  alt={item.title} 
                  onClick={(url) => setZoomImageUrl(url)}
                />

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <span className={item.item_type === 'lost' ? 'badge badge-lost' : 'badge badge-found'}>
                      {item.item_type === 'lost' ? 'Lost Item' : 'Found Item'}
                    </span>
                    <span className="badge badge-primary">
                      Open
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.18rem', marginBottom: '0.45rem', color: 'var(--text-main)' }}>{item.title}</h3>
                  
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.15rem', flex: 1, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                    {item.description}
                  </p>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={14} color={item.item_type === 'lost' ? 'var(--lost-accent)' : 'var(--found-accent)'} />
                      <span>{item.location_description}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Calendar size={14} /> {item.incident_date}
                      </span>
                      {item.color && (
                        <span>Color: {item.color}</span>
                      )}
                    </div>
                  </div>

                  {item.user_id === user.id && (
                    <div style={{ marginTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                        Your Report
                      </span>
                      <button
                        type="button"
                        onClick={() => handleFindMatches(item)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                      >
                        <Sparkles size={13} /> Matches
                      </button>
                    </div>
                  )}

                  {item.user_id !== user.id && item.item_type === 'found' && item.status === 'open' && (
                    <div style={{ marginTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setClaimingFoundItem(item);
                          setPreselectedLostItem(null);
                        }}
                        className="btn btn-primary btn-sm"
                        style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}
                        id={`community-claim-${item.id}`}
                      >
                        <ShieldCheck size={14} /> Claim This Found Item
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* AI MATCHING RESULTS MODAL */}
      {matchingTarget && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.45)', 
            backdropFilter: 'blur(8px)', 
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 150, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '1.5rem' 
          }}
          id="ai-matches-modal"
        >
          <div 
            className="glass-card" 
            style={{ 
              width: '100%', 
              maxWidth: '780px', 
              padding: '2rem', 
              maxHeight: '90vh', 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden',
              background: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-modal)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <div className="brand-icon-wrap" style={{ width: '28px', height: '28px' }}>
                    <Sparkles size={16} color="#fff" />
                  </div>
                  <h3 style={{ fontSize: '1.3rem', color: 'var(--text-main)' }}>AI Match Intelligence</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  <span>Matching for:</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{matchingTarget.title}</span>
                  <span className={matchingTarget.item_type === 'lost' ? 'badge badge-lost' : 'badge badge-found'} style={{ fontSize: '0.75rem' }}>
                    {matchingTarget.item_type === 'lost' ? 'Lost Item' : 'Found Item'}
                  </span>
                  <span>• Scanning candidate <strong>{matchingTarget.item_type === 'lost' ? 'found' : 'lost'}</strong> reports</span>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => setMatchingTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                aria-label="Close matches modal"
                id="btn-close-matches"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.4rem' }}>
              {matchingError ? (
                <div 
                  style={{ 
                    background: 'var(--lost-subtle)', 
                    border: '1px solid var(--lost-border)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '1.25rem', 
                    margin: '1.25rem 0',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    color: 'var(--lost-accent)'
                  }}
                  id="matching-error-banner"
                >
                  <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>Matching Service Error</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '0.85rem', color: 'var(--text-secondary)' }}>
                      {matchingError}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleFindMatches(matchingTarget)}
                      className="btn btn-secondary btn-sm"
                    >
                      <RefreshCw size={14} /> Retry Search
                    </button>
                  </div>
                </div>
              ) : (
                <AiMatchingVisualizer
                  isLoading={matchingLoading}
                  results={matchResults}
                  expandedBreakdowns={expandedBreakdowns}
                  onToggleBreakdown={toggleBreakdown}
                  renderCandidateActions={(candidate) => (
                    <>
                      {matchingTarget?.item_type === 'lost' && candidate.user_id !== user?.id && candidate.item_type === 'found' && (
                        <button
                          type="button"
                          onClick={() => {
                            setClaimingFoundItem(candidate);
                            setPreselectedLostItem(matchingTarget);
                            setMatchingTarget(null);
                          }}
                          className="btn btn-primary btn-sm"
                          id={`ai-match-claim-${candidate.id}`}
                        >
                          <ShieldCheck size={14} /> Claim This Item
                        </button>
                      )}
                    </>
                  )}
                />
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setMatchingTarget(null)}
                className="btn btn-secondary btn-sm"
              >
                Close Match View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal (with Image Replacement & Removal) */}
      {editingItem && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.45)', 
            backdropFilter: 'blur(8px)', 
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 100, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '1.5rem' 
          }}
        >
          <div 
            className="glass-card" 
            style={{ 
              width: '100%', 
              maxWidth: '520px', 
              padding: '2rem', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-modal)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>Edit Report</h3>
              <button 
                type="button" 
                onClick={() => setEditingItem(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                aria-label="Close edit dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label className="form-label">Item Title</label>
                <input
                  type="text"
                  required
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="form-select"
                  >
                    <option value="open">Open</option>
                    <option value="matched">Matched</option>
                    <option value="returned">Returned</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Color</label>
                  <input
                    type="text"
                    value={editFormData.color}
                    onChange={(e) => setEditFormData({ ...editFormData, color: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Location Description</label>
                <input
                  type="text"
                  required
                  value={editFormData.location_description}
                  onChange={(e) => setEditFormData({ ...editFormData, location_description: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Description</label>
                <textarea
                  rows={3}
                  required
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="form-textarea"
                />
              </div>

              {/* Image Management Section in Edit Modal */}
              <div className="form-group" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '1rem' }}>
                <label className="form-label">Photo Management</label>

                {/* Existing Image */}
                {editingItem.image_path && !removeCurrentImage && !newImagePreview && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden' }}>
                      <ItemImage imagePath={editingItem.image_path} style={{ height: '80px' }} />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setRemoveCurrentImage(true)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--lost-accent)', borderColor: 'var(--lost-border)' }}
                      >
                        <Trash2 size={14} /> Remove Current Photo
                      </button>
                    </div>
                  </div>
                )}

                {/* Removed notice */}
                {removeCurrentImage && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--lost-subtle)', border: '1px solid var(--lost-border)', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--lost-accent)' }}>
                    <span>Current photo will be deleted on save.</span>
                    <button
                      type="button"
                      onClick={() => setRemoveCurrentImage(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Undo
                    </button>
                  </div>
                )}

                {/* New Image Replacement Preview */}
                {newImagePreview ? (
                  <div style={{ position: 'relative', display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                    <img src={newImagePreview} alt="New upload" style={{ width: '80px', height: '80px', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(newImagePreview);
                        setNewImageFile(null);
                        setNewImagePreview(null);
                      }}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: 'rgba(244, 63, 94, 0.9)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      padding: '0.6rem 0.9rem', 
                      border: '1px dashed var(--border-subtle)', 
                      borderRadius: '8px', 
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <Camera size={16} />
                    <span>Upload replacement image (Max 5 MB)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleNewImageChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}

                {editImageError && (
                  <div className="form-error" style={{ marginTop: '0.4rem' }}>
                    <AlertCircle size={14} /> {editImageError}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="btn btn-secondary"
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updating}
                >
                  {updating ? <><Loader2 size={16} className="spin" /> Updating...</> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {zoomImageUrl && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0, 0, 0, 0.88)', 
            backdropFilter: 'blur(10px)', 
            zIndex: 200, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '2rem' 
          }}
          onClick={() => setZoomImageUrl(null)}
        >
          <div style={{ position: 'relative', maxWidth: '85vw', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            <img 
              src={zoomImageUrl} 
              alt="Item photo zoomed" 
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }} 
            />
            <button
              type="button"
              onClick={() => setZoomImageUrl(null)}
              style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Close zoom"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Claim Submission Modal */}
      {claimingFoundItem && (
        <ClaimModal
          foundItem={claimingFoundItem}
          preselectedLostItem={preselectedLostItem}
          userReports={userReports}
          onClose={() => {
            setClaimingFoundItem(null);
            setPreselectedLostItem(null);
          }}
          onClaimCreated={() => {
            setClaimingFoundItem(null);
            setPreselectedLostItem(null);
            setActiveTab('claims');
            loadData();
          }}
        />
      )}

      </div>
    </div>
  );
}
