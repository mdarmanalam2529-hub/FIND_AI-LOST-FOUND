import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { itemsService } from '../services/itemsService';
import { Search, LogIn, ArrowRight, CheckCircle2, X, Camera, AlertCircle, ShieldCheck, Loader2, Palette, MapPin } from 'lucide-react';
import HeroAnimatedBackground from '../components/HeroAnimatedBackground';

export default function ReportLost() {
  const { user, loading: authLoading } = useAuth();

  // Helper to get today's date in YYYY-MM-DD format
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState(() => ({
    title: '',
    category: 'electronics',
    color: '',
    location: '',
    incidentDate: getTodayDate(),
    description: '',
  }));

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState(null);

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [createdItem, setCreatedItem] = useState(null);

  const handleImageChange = (e) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = itemsService.validateImage(file);
    if (!validation.valid) {
      setImageError(validation.error);
      e.target.value = '';
      return;
    }

    setImageFile(file);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required.';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters.';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location description is required.';
    } else if (formData.location.trim().length < 2) {
      newErrors.location = 'Please provide a clearer location.';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Detailed description is required.';
    } else if (formData.description.trim().length < 5) {
      newErrors.description = 'Description must be at least 5 characters.';
    }

    if (!formData.incidentDate) {
      newErrors.incidentDate = 'Date is required.';
    }

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (serverError) {
      setServerError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!user) {
      setServerError('You must be signed in to submit a report.');
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);

    try {
      // Safe creation: creates item in DB first, uploads image, rolls back if image upload fails
      const newItem = await itemsService.createReportWithImage({
        itemData: {
          userId: user.id,
          itemType: 'lost',
          title: formData.title,
          description: formData.description,
          category: formData.category,
          color: formData.color,
          locationDescription: formData.location,
          incidentDate: formData.incidentDate,
        },
        imageFile,
      });

      setCreatedItem(newItem);
    } catch (err) {
      console.error('[ReportLost] Error submitting report:', err);
      if (err.message?.includes('relation "public.items" does not exist') || err.code === '42P01') {
        setServerError('Database table "items" does not exist yet. Please run the provided migration SQL in your Supabase SQL Editor first.');
      } else if (err.message?.includes('Bucket not found') || err.message?.includes('bucket')) {
        setServerError('Storage bucket "item-images" not found. Please run the storage migration in your Supabase SQL Editor.');
      } else {
        setServerError(err.message || 'Failed to submit report. Please verify your connection.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCreatedItem(null);
    setFormData({
      title: '',
      category: 'electronics',
      color: '',
      location: '',
      incidentDate: new Date().toISOString().split('T')[0],
      description: '',
    });
    handleRemoveImage();
    setErrors({});
    setServerError(null);
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 140px)' }}>
      <HeroAnimatedBackground variant="minimal" />
      <div className="container" style={{ position: 'relative', zIndex: 1, padding: '3.5rem 1.5rem 5rem' }} id="report-lost-page">
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="badge badge-lost" style={{ marginBottom: '0.75rem' }}>
            <Search size={14} /> Lost Item Registry
          </div>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>Report a Lost Item</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Submit item details directly to our registry. The AI matching pipeline will index your description and reference image.
          </p>
        </div>

        {/* Unauthenticated User Warning */}
        {!authLoading && !user && (
          <div 
            className="glass-card" 
            style={{ 
              marginBottom: '2rem', 
              borderColor: 'var(--lost-border)', 
              background: 'var(--lost-subtle)',
              textAlign: 'center',
              padding: '2rem'
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(225, 29, 72, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <LogIn size={22} color="var(--lost-accent)" />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Authentication Required</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
              To ensure safety and allow you to edit or mark your items returned, you must be logged in to file a report.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <Link to="/login" className="btn btn-primary btn-sm">
                <LogIn size={16} /> Sign In
              </Link>
              <Link to="/signup" className="btn btn-secondary btn-sm">
                Create Account
              </Link>
            </div>
          </div>
        )}

        {/* Success View */}
        {createdItem ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--found-subtle)', border: '1px solid var(--found-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <CheckCircle2 size={32} color="var(--found-accent)" />
            </div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Lost Report Registered!</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '460px', margin: '0 auto 1.5rem' }}>
              Your report for "<strong>{createdItem.title}</strong>" has been safely recorded in Supabase PostgreSQL
              {createdItem.image_path ? ' with its secure reference photo' : ''}.
            </p>

            {/* Thumbnail Preview if attached */}
            {imagePreview && (
              <div style={{ marginBottom: '1.5rem' }}>
                <img 
                  src={imagePreview} 
                  alt={createdItem.title} 
                  style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }} 
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/dashboard" className="btn btn-primary" id="view-dashboard-btn">
                View in Dashboard <ArrowRight size={16} />
              </Link>
              <button className="btn btn-secondary" onClick={handleReset} id="submit-another-btn">
                Submit Another Report
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <div className="glass-card report-form-card">
            {serverError && (
              <div 
                style={{ 
                  background: 'var(--lost-subtle)', 
                  border: '1px solid var(--lost-border)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '0.85rem 1rem', 
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  color: 'var(--lost-accent)',
                  fontSize: '0.88rem'
                }}
                id="lost-server-error"
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate id="report-lost-form">
              {/* Item Title */}
              <div className="form-group">
                <label className="form-label" htmlFor="lost-title">Item Title / Name *</label>
                <input
                  id="lost-title"
                  name="title"
                  type="text"
                  placeholder="e.g. Space Gray MacBook Air M2 or Blue Hydro Flask"
                  className={`form-input ${errors.title ? 'is-invalid' : ''}`}
                  value={formData.title}
                  onChange={handleChange}
                  disabled={submitting || !user}
                />
                {errors.title && <div className="form-error"><AlertCircle size={14} /> {errors.title}</div>}
              </div>

              {/* Category & Color Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="lost-category">Category *</label>
                  <select
                    id="lost-category"
                    name="category"
                    className="form-select"
                    value={formData.category}
                    onChange={handleChange}
                    disabled={submitting || !user}
                  >
                    <option value="electronics">Electronics & Gadgets</option>
                    <option value="keys-wallets">Keys, Wallets & IDs</option>
                    <option value="clothing">Bags, Clothing & Accessories</option>
                    <option value="documents">Books & Documents</option>
                    <option value="jewelry">Jewelry & Watches</option>
                    <option value="other">Other Belongings</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="lost-color">Primary Color (Optional)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="lost-color"
                      name="color"
                      type="text"
                      placeholder="e.g. Silver / Navy Blue"
                      className="form-input"
                      style={{ paddingLeft: '2.5rem' }}
                      value={formData.color}
                      onChange={handleChange}
                      disabled={submitting || !user}
                    />
                    <Palette size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                </div>
              </div>

              {/* Date & Location Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="lost-date">Estimated Date Lost *</label>
                  <input
                    id="lost-date"
                    name="incidentDate"
                    type="date"
                    className={`form-input ${errors.incidentDate ? 'is-invalid' : ''}`}
                    value={formData.incidentDate}
                    onChange={handleChange}
                    disabled={submitting || !user}
                  />
                  {errors.incidentDate && <div className="form-error"><AlertCircle size={14} /> {errors.incidentDate}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="lost-location">Last Seen Location *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="lost-location"
                      name="location"
                      type="text"
                      placeholder="e.g. Main Library 3rd floor"
                      className={`form-input ${errors.location ? 'is-invalid' : ''}`}
                      style={{ paddingLeft: '2.5rem' }}
                      value={formData.location}
                      onChange={handleChange}
                      disabled={submitting || !user}
                    />
                    <MapPin size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                  {errors.location && <div className="form-error"><AlertCircle size={14} /> {errors.location}</div>}
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label" htmlFor="lost-desc">Detailed Description (Crucial for AI Matching) *</label>
                <textarea
                  id="lost-desc"
                  name="description"
                  rows={4}
                  placeholder="Include distinct marks, stickers, engravings, serial hints, or specific contents."
                  className={`form-textarea ${errors.description ? 'is-invalid' : ''}`}
                  value={formData.description}
                  onChange={handleChange}
                  disabled={submitting || !user}
                />
                {errors.description && <div className="form-error"><AlertCircle size={14} /> {errors.description}</div>}
              </div>

              {/* Image Upload Control with Preview */}
              <div className="form-group">
                <label className="form-label" htmlFor="lost-image-input">
                  Reference Photo (Optional — Max 5 MB, JPEG/PNG/WebP)
                </label>
                
                {imagePreview ? (
                  <div 
                    style={{ 
                      position: 'relative', 
                      display: 'inline-flex', 
                      borderRadius: 'var(--radius-md)', 
                      overflow: 'hidden', 
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-subtle)',
                      padding: '0.5rem'
                    }}
                  >
                    <img 
                      src={imagePreview} 
                      alt="Upload preview" 
                      style={{ width: '140px', height: '140px', objectFit: 'cover', borderRadius: '8px' }} 
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={submitting}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'rgba(244, 63, 94, 0.9)',
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                      title="Remove image"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label 
                    htmlFor="lost-image-input" 
                    style={{ 
                      display: 'block',
                      border: '2px dashed var(--border-subtle)', 
                      borderRadius: 'var(--radius-md)', 
                      padding: '2rem 1rem', 
                      textAlign: 'center', 
                      background: 'var(--bg-subtle)', 
                      cursor: submitting || !user ? 'not-allowed' : 'pointer',
                      transition: 'border-color 0.2s'
                    }}
                  >
                    <Camera size={28} color="var(--text-dim)" style={{ marginBottom: '0.5rem' }} />
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      Click to choose an image or drag & drop
                    </p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Supports JPEG, PNG, WebP up to 5 MB
                    </span>
                    <input
                      id="lost-image-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      disabled={submitting || !user}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}

                {imageError && (
                  <div className="form-error" style={{ marginTop: '0.5rem' }}>
                    <AlertCircle size={14} /> {imageError}
                  </div>
                )}
              </div>

              {/* Privacy Safeguard Notice */}
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.65rem', alignItems: 'flex-start', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <ShieldCheck size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: 'var(--text-main)' }}>Privacy Safeguard:</strong> Your phone number, email, and sensitive identifiers are never published publicly. Only when an item is claimed or matched can a private, secure handover be coordinated.
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className="btn btn-lost" 
                style={{ width: '100%', marginTop: '1rem', padding: '0.85rem' }} 
                id="lost-submit-btn"
                disabled={submitting || !user}
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="spin" /> Submitting Report & Uploading Image...
                  </>
                ) : (
                  <>
                    <Search size={18} /> Submit Lost Report
                  </>
                )}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  </div>
  );
}
