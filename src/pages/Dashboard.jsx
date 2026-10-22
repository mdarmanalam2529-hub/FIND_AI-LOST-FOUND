import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { itemsService } from '../services/itemsService';
import ItemImage from '../components/ItemImage';
import ClaimsManager from '../components/ClaimsManager';
import ClaimModal from '../components/ClaimModal';
import TiltCard from '../components/TiltCard';
import { 
  LayoutDashboard, 
  Sparkles, 
  Search, 
  UploadCloud, 
  Clock, 
  Tag, 
  CheckCircle2, 
  ShieldCheck, 
  ShieldAlert,
  UserCheck, 
  Mail, 
  Fingerprint, 
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
  ImageIcon, 
  Maximize2,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  Activity
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('my-reports'); // 'my-reports' | 'community-feed' | 'claims'
  const [claimingFoundItem, setClaimingFoundItem] = useState(null);
  const [preselectedLostItem, setPreselectedLostItem] = useState(null);
  const [userReports, setUserReports] = useState([]);
  const [communityReports, setCommunityReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState(null);

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

  // AI Matching Modal State
  const [matchingTarget, setMatchingTarget] = useState(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingError, setMatchingError] = useState(null);
  const [matchResults, setMatchResults] = useState([]);
  const [expandedBreakdowns, setExpandedBreakdowns] = useState({});

  const fullName = user?.user_metadata?.full_name || 'Community Member';
  const email = user?.email || 'N/A';
  const isEmailVerified = Boolean(user?.email_confirmed_at);
  const memberSince = user?.created_at 
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Recent';

  // Load items from Supabase
  const loadData = async () => {
    if (!user) return;
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Handle AI Matching
  const handleFindMatches = async (item) => {
    setMatchingTarget(item);
    setMatchingLoading(true);
    setMatchingError(null);
    setMatchResults([]);
    setExpandedBreakdowns({});

    try {
      const data = await itemsService.findMatches(item.id, { limit: 10 });
      setMatchResults(data.matches || []);
    } catch (err) {
      console.error('[Dashboard] Error finding matches:', err);
      setMatchingError(err.message || 'Failed to calculate candidate matches.');
    } finally {
      setMatchingLoading(false);
    }
  };

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
    <div className="container" style={{ padding: '3rem 1.5rem 5rem' }} id="dashboard-page">
      
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
          <AlertCircle size={24} color="#facc15" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ color: '#fef08a', fontSize: '1.05rem', marginBottom: '0.35rem' }}>
              Action Required: Database Migration Pending
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              {tableError}
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Run the SQL file located at <code>supabase/migrations/20261018_create_items_table.sql</code> in your Supabase SQL Editor.
            </p>
          </div>
        </div>
      )}

      {/* Authenticated User Status Card */}
      <div 
        className="glass-card" 
        style={{ 
          marginBottom: '2.5rem', 
          borderColor: 'rgba(99, 102, 241, 0.3)', 
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '1.5rem',
          flexWrap: 'wrap'
        }}
        id="dashboard-user-card"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div 
            style={{ 
              width: '54px', 
              height: '54px', 
              borderRadius: '16px', 
              background: 'var(--primary-gradient)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#ffffff',
              boxShadow: 'var(--shadow-glow)'
            }}
          >
            {fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.35rem' }}>Welcome, {fullName}</h2>
              {isEmailVerified ? (
                <span className="badge badge-found" title="Email verified in Supabase">
                  <ShieldCheck size={14} /> Verified
                </span>
              ) : (
                <span className="badge badge-lost" title="Email confirmation pending">
                  <Mail size={14} /> Unconfirmed Email
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
              <span>{email}</span>
              <span>•</span>
              <span>Member since {memberSince}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={() => setActiveTab('claims')}
            className="btn btn-secondary btn-sm"
            id="dashboard-claims-tab-btn"
          >
            <ShieldCheck size={16} color="var(--primary-light)" /> Claims & Returns
          </button>
          <Link to="/report-lost" className="btn btn-lost btn-sm" id="dashboard-report-lost">
            <Search size={16} /> Report Lost Item
          </Link>
          <Link to="/report-found" className="btn btn-found btn-sm" id="dashboard-report-found">
            <UploadCloud size={16} /> Report Found Item
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid with 3D Hover Tilt */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <TiltCard maxTilt={5}>
          <div className="glass-card" style={{ padding: '1.5rem', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Active Lost Reports</span>
              <span className="badge badge-lost">{activeLostCount} Active</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{activeLostCount}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              Awaiting found matches
            </div>
          </div>
        </TiltCard>

        <TiltCard maxTilt={5}>
          <div className="glass-card" style={{ padding: '1.5rem', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Found Items Contributed</span>
              <span className="badge badge-found">{foundItemsCount} Items</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{foundItemsCount}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              Helping the community
            </div>
          </div>
        </TiltCard>

        <TiltCard maxTilt={5}>
          <div className="glass-card" style={{ padding: '1.5rem', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Community Open Feed</span>
              <span className="badge badge-primary">{communityReports.length} Open</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }} className="gradient-text">{communityReports.length}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              Public listings registered
            </div>
          </div>
        </TiltCard>

        <TiltCard maxTilt={5}>
          <div className="glass-card" style={{ padding: '1.5rem', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Resolved & Returned</span>
              <CheckCircle2 size={18} color="#10b981" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{resolvedCount}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              Reunited cases
            </div>
          </div>
        </TiltCard>
      </div>

      {/* Tabs: My Reports vs Community Open Feed */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('my-reports')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'my-reports' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            padding: '0.4rem 0.8rem',
            borderBottom: activeTab === 'my-reports' ? '2px solid var(--primary)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          id="tab-my-reports"
        >
          <Layers size={18} /> My Reports ({userReports.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('community-feed')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'community-feed' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            padding: '0.4rem 0.8rem',
            borderBottom: activeTab === 'community-feed' ? '2px solid var(--primary)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          id="tab-community-feed"
        >
          <Globe size={18} /> Community Open Feed ({communityReports.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('claims')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'claims' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            padding: '0.4rem 0.8rem',
            borderBottom: activeTab === 'claims' ? '2px solid var(--primary)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          id="tab-claims-returns"
        >
          <ShieldCheck size={18} color="var(--primary-light)" /> Claims & Returns
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
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
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <Sparkles size={24} color="var(--primary-light)" />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
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
                      className="badge" 
                      style={{ 
                        background: item.status === 'open' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: item.status === 'open' ? 'var(--primary-light)' : '#34d399',
                        border: '1px solid currentColor'
                      }}
                    >
                      Status: {item.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{item.title}</h3>
                  
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.2rem', flex: 1, whiteSpace: 'pre-wrap' }}>
                    {item.description}
                  </p>

                  {/* Details Footer */}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={14} color="#f43f5e" />
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
                      onClick={() => handleFindMatches(item)}
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
                      style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
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
      ) : (
        /* COMMUNITY OPEN FEED */
        communityReports.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <Globe size={24} color="var(--primary-light)" />
            </div>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No open community reports right now</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto' }}>
              All currently submitted reports have been resolved or matched. New community submissions will appear here live.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
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

                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{item.title}</h3>
                  
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.2rem', flex: 1, whiteSpace: 'pre-wrap' }}>
                    {item.description}
                  </p>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={14} color="#f43f5e" />
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
            background: 'rgba(0, 0, 0, 0.85)', 
            backdropFilter: 'blur(10px)', 
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
              overflow: 'hidden' 
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <div className="brand-icon-wrap" style={{ width: '28px', height: '28px' }}>
                    <Sparkles size={16} color="#fff" />
                  </div>
                  <h3 style={{ fontSize: '1.35rem' }}>AI Match Intelligence</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  <span>Matching for:</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{matchingTarget.title}</span>
                  <span className={matchingTarget.item_type === 'lost' ? 'badge badge-lost' : 'badge badge-found'} style={{ fontSize: '0.75rem' }}>
                    {matchingTarget.item_type === 'lost' ? 'Lost' : 'Found'}
                  </span>
                  <span>• Scanning candidate <strong>{matchingTarget.item_type === 'lost' ? 'found' : 'lost'}</strong> items</span>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => setMatchingTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.2rem' }}
                aria-label="Close matches modal"
                id="btn-close-matches"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Content Scroll Area */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.4rem' }}>
              
              {/* State 1: 3D Holographic Radar Scanning State */}
              {matchingLoading && (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                  {/* Holographic 3D Radar Scanner */}
                  <div 
                    style={{
                      position: 'relative',
                      width: '130px',
                      height: '130px',
                      margin: '0 auto 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      perspective: '600px',
                    }}
                  >
                    <div 
                      style={{
                        position: 'absolute',
                        inset: '-15%',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, rgba(99, 102, 241, 0.1) 60%, transparent 80%)',
                        filter: 'blur(16px)',
                        pointerEvents: 'none',
                      }}
                    />
                    <div 
                      className="radar-ring-outer"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        border: '2px dashed rgba(6, 182, 212, 0.45)',
                        animation: 'radarSpin3D 6s linear infinite',
                      }}
                    />
                    <div 
                      className="radar-ring-middle"
                      style={{
                        position: 'absolute',
                        inset: '14px',
                        borderRadius: '50%',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        transform: 'rotateX(55deg)',
                        animation: 'counterSpin3D 8s linear infinite',
                      }}
                    />
                    <div 
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'var(--primary-gradient)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 25px rgba(6, 182, 212, 0.6)',
                        zIndex: 3,
                      }}
                    >
                      <Activity size={24} color="#ffffff" className="spin-pulse" />
                    </div>
                    <div 
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '60px',
                        height: '2px',
                        background: 'linear-gradient(90deg, #06b6d4, transparent)',
                        transformOrigin: '0 0',
                        animation: 'radarSweep 2.2s linear infinite',
                        boxShadow: '0 0 8px #06b6d4',
                      }}
                    />
                  </div>

                  {/* Target Item Scanning Card with Laser Line */}
                  <div 
                    className="glass-card" 
                    style={{ 
                      maxWidth: '460px', 
                      margin: '0 auto 1.5rem', 
                      padding: '1rem 1.25rem', 
                      textAlign: 'left', 
                      position: 'relative', 
                      overflow: 'hidden',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                    }}
                  >
                    <div className="scanner-laser-bar" />
                    <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                      Active Scanner Target
                    </div>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>{matchingTarget.title}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {matchingTarget.description}
                    </div>
                  </div>

                  <h4 style={{ fontSize: '1.2rem', marginBottom: '0.4rem', color: '#fff' }}>Extracting Semantic & Visual Embeddings...</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto' }}>
                    Comparing descriptions using 384-dimensional text vectors, evaluating CLIP visual similarity for attached photos, and scoring category, color, date, and location overlap.
                  </p>
                </div>
              )}

              {/* State 2: Error */}
              {!matchingLoading && matchingError && (
                <div 
                  style={{ 
                    background: 'rgba(244, 63, 94, 0.12)', 
                    border: '1px solid rgba(244, 63, 94, 0.3)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '1.5rem', 
                    margin: '1.5rem 0',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    color: '#fb7185'
                  }}
                  id="matching-error-banner"
                >
                  <AlertCircle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', color: '#fff' }}>Matching Service Error</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1rem' }}>
                      {matchingError}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleFindMatches(matchingTarget)}
                      className="btn btn-secondary btn-sm"
                      style={{ color: '#fff' }}
                    >
                      <RefreshCw size={14} /> Retry Search
                    </button>
                  </div>
                </div>
              )}

              {/* State 3: Empty Candidate Results */}
              {!matchingLoading && !matchingError && matchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                    <Search size={24} color="var(--primary-light)" />
                  </div>
                  <h4 style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>No Candidate Matches Found</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '460px', margin: '0 auto 1rem' }}>
                    We scanned all active {matchingTarget.item_type === 'lost' ? 'found' : 'lost'} reports in the database, but none currently show strong correlation with your item.
                  </p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    Tip: As other users submit matching reports, they will become discoverable here.
                  </span>
                </div>
              )}

              {/* State 4: Ranked Candidates List */}
              {!matchingLoading && !matchingError && matchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
                  
                  {/* Results Count Summary Banner */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Identified <strong style={{ color: '#fff' }}>{matchResults.length}</strong> ranked candidate {matchingTarget.item_type === 'lost' ? 'found' : 'lost'} reports
                    </span>
                    <button 
                      type="button" 
                      onClick={() => handleFindMatches(matchingTarget)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
                    >
                      <RefreshCw size={13} /> Refresh
                    </button>
                  </div>

                  {/* Candidate Cards with 3D Tilt & Staggered Reveal */}
                  {matchResults.map((candidate, idx) => {
                    const isExpanded = Boolean(expandedBreakdowns[candidate.id]);
                    const score = candidate.score;
                    const badgeStyle = score >= 70 
                      ? { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.35)' }
                      : score >= 50 
                      ? { bg: 'rgba(99, 102, 241, 0.15)', text: 'var(--primary-light)', border: 'rgba(99, 102, 241, 0.35)' }
                      : { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15', border: 'rgba(234, 179, 8, 0.35)' };

                    const radius = 20;
                    const circumference = 2 * Math.PI * radius;
                    const strokeDashoffset = circumference - (score / 100) * circumference;

                    return (
                      <TiltCard
                        key={candidate.id}
                        maxTilt={4}
                        scale={1.01}
                        style={{
                          animation: `cardFadeInUp 0.4s ease-out ${idx * 0.08}s both`,
                        }}
                      >
                        <div 
                          style={{ 
                            background: 'rgba(18, 24, 38, 0.85)', 
                            border: '1px solid var(--border-subtle)', 
                            borderRadius: 'var(--radius-md)', 
                            padding: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          {score >= 70 && (
                            <div 
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '3px',
                                height: '100%',
                                background: 'linear-gradient(180deg, #10b981 0%, #06b6d4 100%)',
                                boxShadow: '0 0 10px #10b981',
                              }}
                            />
                          )}

                          {/* Candidate Card Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                              {/* SVG Radial Confidence Meter */}
                              <div style={{ position: 'relative', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
                                  <circle
                                    cx="24"
                                    cy="24"
                                    r={radius}
                                    fill="transparent"
                                    stroke="rgba(255, 255, 255, 0.08)"
                                    strokeWidth="3.5"
                                  />
                                  <circle
                                    cx="24"
                                    cy="24"
                                    r={radius}
                                    fill="transparent"
                                    stroke={badgeStyle.text}
                                    strokeWidth="3.5"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <span style={{ position: 'absolute', fontSize: '0.78rem', fontWeight: 800, color: badgeStyle.text }}>
                                  {score}%
                                </span>
                              </div>

                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                  <span 
                                    style={{ 
                                      padding: '0.2rem 0.6rem', 
                                      borderRadius: 'var(--radius-full)', 
                                      fontSize: '0.8rem', 
                                      fontWeight: 700, 
                                      background: badgeStyle.bg, 
                                      color: badgeStyle.text,
                                      border: `1px solid ${badgeStyle.border}`,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem'
                                    }}
                                  >
                                    <Sparkles size={12} /> {score}% Similarity
                                  </span>
                                  <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                    #{idx + 1} Candidate
                                  </span>
                                </div>
                                <h4 style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 600 }}>
                                  {candidate.title}
                                </h4>
                              </div>
                            </div>

                            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Calendar size={13} /> Incident Date: {candidate.incident_date}
                            </span>
                          </div>

                          {/* Description */}
                          <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                              {candidate.description}
                            </p>
                          </div>

                          {/* Metadata line */}
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <MapPin size={13} color="#f43f5e" />
                              <span>{candidate.location_description}</span>
                            </div>
                            {candidate.color && (
                              <div>Color: <span style={{ color: '#fff' }}>{candidate.color}</span></div>
                            )}
                            <div>Category: <span style={{ color: '#fff' }}>{candidate.category}</span></div>
                          </div>

                          {/* Explanation Summary */}
                          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span><strong>Key Signals:</strong> {candidate.explanation}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {matchingTarget?.item_type === 'lost' && candidate.user_id !== user?.id && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setClaimingFoundItem(candidate);
                                    setPreselectedLostItem(matchingTarget);
                                    setMatchingTarget(null);
                                  }}
                                  className="btn btn-primary btn-sm"
                                  style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                  id={`ai-match-claim-${candidate.id}`}
                                >
                                  <ShieldCheck size={13} /> Claim Item
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleBreakdown(candidate.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem' }}
                              >
                                {isExpanded ? <>Hide Details <ChevronUp size={14} /></> : <>Score Details <ChevronDown size={14} /></>}
                              </button>
                            </div>
                          </div>

                          {/* Expandable Multi-Factor Breakdown */}
                          {isExpanded && candidate.breakdown && (
                            <div 
                              style={{ 
                                background: 'rgba(0, 0, 0, 0.3)', 
                                border: '1px solid var(--border-subtle)', 
                                borderRadius: '8px', 
                                padding: '1rem', 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                                gap: '0.75rem',
                                fontSize: '0.82rem'
                              }}
                            >
                              <div>
                                <div style={{ color: 'var(--text-dim)' }}>Semantic Text Match</div>
                                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{candidate.breakdown.textSimilarityPct}%</div>
                              </div>
                              {candidate.breakdown.imageEvaluated && typeof candidate.breakdown.imageSimilarityPct === 'number' && (
                                <div>
                                  <div style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Camera size={13} color="var(--primary-light)" />
                                    <span>Visual / Photo Match</span>
                                  </div>
                                  <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.95rem' }}>
                                    {candidate.breakdown.imageSimilarityPct}%
                                  </div>
                                </div>
                              )}
                              <div>
                                <div style={{ color: 'var(--text-dim)' }}>Category Match</div>
                                <div style={{ fontWeight: 700, color: candidate.breakdown.categoryMatch ? '#34d399' : '#fb7185', fontSize: '0.95rem' }}>
                                  {candidate.breakdown.categoryMatch ? 'Exact Match (100%)' : 'Mismatch (0%)'}
                                </div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-dim)' }}>Color Score</div>
                                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{candidate.breakdown.colorScorePct}%</div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-dim)' }}>Date Proximity</div>
                                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{candidate.breakdown.dateProximityPct}%</div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-dim)' }}>Location Overlap</div>
                                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{candidate.breakdown.locationSimilarityPct}%</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </TiltCard>
                    );
                  })}

                  {/* Safety Disclaimer Banner */}
                  <div 
                    style={{ 
                      background: 'rgba(99, 102, 241, 0.08)', 
                      border: '1px solid rgba(99, 102, 241, 0.25)', 
                      borderRadius: 'var(--radius-md)', 
                      padding: '1rem 1.25rem', 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '0.85rem',
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      marginTop: '0.5rem'
                    }}
                  >
                    <ShieldAlert size={22} color="var(--primary-light)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: '#fff' }}>Verification Notice & Safety Policy:</strong>
                      <p style={{ marginTop: '0.2rem' }}>
                        Similarity scores are statistical algorithmic estimates provided to assist human review. A suggested match does NOT prove legal ownership.
                        Reports are never automatically marked as returned or closed. Both parties must independently verify unique identifiers (serial hints, markings, distinctive scratches) before handoff.
                      </p>
                    </div>
                  </div>

                </div>
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
            background: 'rgba(0, 0, 0, 0.75)', 
            backdropFilter: 'blur(8px)', 
            zIndex: 100, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '1.5rem' 
          }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.3rem' }}>Edit Report</h3>
              <button 
                type="button" 
                onClick={() => setEditingItem(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
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
                        style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                      >
                        <Trash2 size={14} /> Remove Current Photo
                      </button>
                    </div>
                  </div>
                )}

                {/* Removed notice */}
                {removeCurrentImage && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#fb7185' }}>
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
  );
}
