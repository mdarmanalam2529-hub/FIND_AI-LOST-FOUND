import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Users,
  RefreshCw,
  ArrowRight,
  Database,
  ArrowLeft,
  Loader2,
  Info,
} from 'lucide-react';

export default function AdminImportStudents() {
  const { user, session, loading: authLoading } = useAuth();

  // Admin access state
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [accessError, setAccessError] = useState(null);

  // Stats state
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // File upload & preview state
  const [csvFile, setCsvFile] = useState(null);
  const [csvContent, setCsvContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState(null);

  // Import options & execution state
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);

  const fileInputRef = useRef(null);

  // 1. Verify admin privileges on mount (waits for AuthContext to finish restoring session)
  useEffect(() => {
    let isMounted = true;

    async function verifyAdminAccess() {
      if (authLoading) {
        return; // Session restoration still in progress
      }

      if (!session?.access_token) {
        if (isMounted) {
          setCheckingAccess(false);
          setIsAuthorized(false);
          setAccessError('Authentication required: please log in with an administrator account.');
        }
        return;
      }

      try {
        const response = await fetch('/api/admin/student-registry/check-access', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setIsAuthorized(Boolean(data.authorized));
            setCheckingAccess(false);
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          if (isMounted) {
            setIsAuthorized(false);
            setAccessError(errData.message || 'Access denied: Administrator privileges required.');
            setCheckingAccess(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsAuthorized(false);
          setAccessError(err?.message || 'Could not verify administrative credentials with the server.');
          setCheckingAccess(false);
        }
      }
    }

    verifyAdminAccess();

    return () => {
      isMounted = false;
    };
  }, [authLoading, session?.access_token]);

  // 2. Fetch current registry stats
  const fetchStats = useCallback(async () => {
    if (!session?.access_token || !isAuthorized) return;
    setLoadingStats(true);
    try {
      const response = await fetch('/api/admin/student-registry/stats', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch {
      // Non-critical background stats error
    } finally {
      setLoadingStats(false);
    }
  }, [session?.access_token, isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      fetchStats();
    }
  }, [isAuthorized, fetchStats]);

  // Handle File Drag / Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setPreviewError('Please select a valid CSV (.csv) file.');
      return;
    }

    setCsvFile(file);
    setPreviewError(null);
    setPreviewData(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target?.result || '');
    };
    reader.readAsText(file);
  };

  // Trigger preview analysis
  const handleAnalyzeCsv = async () => {
    if (!csvContent.trim()) {
      setPreviewError('Please choose a CSV file with student records.');
      return;
    }

    if (!session?.access_token) {
      setPreviewError('Authentication session not ready. Please try again.');
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    setImportResult(null);

    try {
      const response = await fetch('/api/admin/student-registry/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ csvContent }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        // Fallback when response is non-JSON or HTML
      }

      if (!response.ok) {
        setPreviewError(
          data?.message ||
          (response.status === 413
            ? 'The selected CSV file exceeds the server payload size limit.'
            : `Failed to analyze CSV format (HTTP ${response.status}).`)
        );
      } else if (!data) {
        setPreviewError('Invalid server response format received.');
      } else {
        setPreviewData(data);
      }
    } catch (err) {
      setPreviewError(err?.message || 'An error occurred communicating with the verification server.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Safe cancellation path
  const handleCancelPreview = () => {
    setPreviewData(null);
    setPreviewError(null);
    setCsvFile(null);
    setCsvContent('');
    setOverwriteExisting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Confirm and Execute Import
  const handleExecuteImport = async () => {
    if (!csvContent.trim()) return;

    if (!session?.access_token) {
      setImportError('Authentication session not ready. Please try again.');
      return;
    }

    setImportLoading(true);
    setImportError(null);

    try {
      const response = await fetch('/api/admin/student-registry/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          csvContent,
          overwriteExisting,
        }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        // Fallback when response is non-JSON
      }

      if (!response.ok) {
        setImportError(data?.message || `Failed to import student registry (HTTP ${response.status}).`);
      } else if (!data) {
        setImportError('Invalid server response format received.');
      } else {
        setImportResult(data);
        setPreviewData(null);
        fetchStats();
      }
    } catch (err) {
      setImportError(err?.message || 'Network error during import. Please check connection and retry.');
    } finally {
      setImportLoading(false);
    }
  };

  // If checking access or restoring session
  if (checkingAccess || authLoading) {
    return (
      <div className="container" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <Loader2 size={32} className="spin" style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
        <span style={{ color: 'var(--text-muted)' }}>Verifying administrative security credentials...</span>
      </div>
    );
  }

  // If unauthorized
  if (!isAuthorized) {
    return (
      <div className="container" style={{ maxWidth: '640px', margin: '4rem auto', textAlign: 'center' }}>
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '3rem 2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
            <ShieldAlert size={32} color="var(--danger, #ef4444)" />
          </div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>Administrative Access Restricted</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            {accessError || 'This page requires verified university administrator or security reviewer privileges.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/dashboard" className="btn btn-secondary">
              <ArrowLeft size={16} /> Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '1000px', margin: '2rem auto 4rem auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              Student Registry <span className="gradient-text">Import</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem', fontSize: '0.95rem' }}>
              Official University 2nd Year CSE Cohort Registry Management
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', color: '#60a5fa' }}>
            <ShieldCheck size={16} /> Admin Session Verified ({user?.email})
          </div>
        </div>
      </div>

      {/* Registry Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span>Registry Database</span>
            <Database size={16} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--text-main)' }}>
            {loadingStats ? '...' : (stats?.totalRegistryStudents ?? '—')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Eligible student records
          </div>
        </div>

        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span>Active Student Profiles</span>
            <Users size={16} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: '#10b981' }}>
            {loadingStats ? '...' : (stats?.activeStudentProfiles ?? '—')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Fully verified student accounts
          </div>
        </div>

        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span>Pending Verifications</span>
            <RefreshCw size={16} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: '#f59e0b' }}>
            {loadingStats ? '...' : (stats?.pendingStudentProfiles ?? '—')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Awaiting email or identity review
          </div>
        </div>
      </div>

      {/* Import Result Notification */}
      {importResult && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#10b981', marginBottom: '0.75rem' }}>
            <CheckCircle2 size={24} />
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Registry Import Succeeded!</h3>
          </div>
          <p style={{ color: 'var(--text-main)', margin: '0 0 1rem 0' }}>
            {importResult.message}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>New Records Inserted</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{importResult.counts?.importedCount ?? 0}</div>
            </div>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Existing Records Updated</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>{importResult.counts?.updatedCount ?? 0}</div>
            </div>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Duplicates / Skipped</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>{importResult.counts?.skippedCount ?? 0}</div>
            </div>
            <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Rows Processed</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{importResult.counts?.totalParsedRows ?? 0}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCancelPreview}
            style={{ marginTop: '1.25rem' }}
          >
            Import Another File
          </button>
        </div>
      )}

      {/* Main Upload Box */}
      {!previewData && !importResult && (
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UploadCloud size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Select Student Registry CSV</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                Upload the official list containing CSE 2nd Year student records
              </p>
            </div>
          </div>

          {/* Required Fields Spec Banner */}
          <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.35rem' }}>
              <Info size={16} /> Required CSV Columns:
            </div>
            <code style={{ background: 'var(--bg-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
              registration_number, student_name, section, academic_year, branch
            </code>
            <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Common header variations (e.g., <em>reg_no, full_name, name, year, dept</em>) are automatically mapped.
            </p>
          </div>

          {/* File Picker Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border-subtle)',
              borderRadius: '12px',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              background: csvFile ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              id="student-csv-input"
            />
            {csvFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={36} color="var(--primary)" />
                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>{csvFile.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {(csvFile.size / 1024).toFixed(1)} KB • Click to change file
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <UploadCloud size={36} color="var(--text-muted)" />
                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                  Click to select CSV file from your computer
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Supported format: .csv (UTF-8 encoded)
                </div>
              </div>
            )}
          </div>

          {previewError && (
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} />
              <span>{previewError}</span>
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!csvFile || previewLoading}
              onClick={handleAnalyzeCsv}
              id="analyze-csv-btn"
            >
              {previewLoading ? (
                <>
                  <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Analyzing File...
                </>
              ) : (
                <>
                  Analyze & Preview Records <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Preview & Validation Confirmation State */}
      {previewData && (
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} color="#10b981" /> CSV Validation & Import Preview
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Review validation results before committing records to the registry.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCancelPreview}
              disabled={importLoading}
            >
              Cancel Preview (Safe Exit)
            </button>
          </div>

          {/* Validation Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', padding: '0.85rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Rows</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{previewData.summary.totalRows}</div>
            </div>
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', padding: '0.85rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>New to Insert</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{previewData.summary.newRecordsCount}</div>
            </div>
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', padding: '0.85rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Already in DB</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: previewData.summary.duplicateInDbCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                {previewData.summary.duplicateInDbCount}
              </div>
            </div>
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', padding: '0.85rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In-CSV Duplicates</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: previewData.summary.duplicateInCsvCount > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                {previewData.summary.duplicateInCsvCount}
              </div>
            </div>
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', padding: '0.85rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Invalid Rows</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: previewData.summary.invalidRowsCount > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                {previewData.summary.invalidRowsCount}
              </div>
            </div>
          </div>

          {/* Duplicates Alert Banner */}
          {previewData.summary.duplicateInCsvCount > 0 && (
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#ef4444' }}>
              <strong>Notice:</strong> {previewData.summary.duplicateInCsvCount} duplicate registration numbers were detected within the CSV. The importer will automatically keep only the first valid occurrence.
            </div>
          )}

          {/* Sample Records Table */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              Sample Records Preview ({previewData.sampleRows?.length} of {previewData.summary.totalRows}):
            </h4>
            <div className="table-responsive" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left', minWidth: '580px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Reg. Number</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Student Name</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Sec</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Year</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Branch</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.sampleRows?.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace', fontWeight: 600 }}>{row.registration_number}</td>
                      <td style={{ padding: '0.6rem 0.85rem' }}>{row.student_name}</td>
                      <td style={{ padding: '0.6rem 0.85rem' }}>{row.section}</td>
                      <td style={{ padding: '0.6rem 0.85rem' }}>{row.academic_year}</td>
                      <td style={{ padding: '0.6rem 0.85rem' }}>{row.branch}</td>
                      <td style={{ padding: '0.6rem 0.85rem' }}>
                        {row.existsInDb ? (
                          <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                            Exists in DB
                          </span>
                        ) : (
                          <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                            New Record
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overwrite Safeguard Toggle */}
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
                style={{ marginTop: '0.25rem' }}
                id="overwrite-toggle"
              />
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                  Overwrite Existing Database Records (Optional)
                </span>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  By default, records already present in the database are safely skipped to avoid silent overwrites. Check this only if you intend to update existing student names, sections, or cohorts.
                </p>
              </div>
            </label>
          </div>

          {importError && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <XCircle size={16} />
              <span>{importError}</span>
            </div>
          )}

          {/* Confirmation Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCancelPreview}
              disabled={importLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={importLoading}
              onClick={handleExecuteImport}
              id="confirm-import-btn"
            >
              {importLoading ? (
                <>
                  <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Importing Records...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Confirm & Import {previewData.summary.newRecordsCount + (overwriteExisting ? previewData.summary.duplicateInDbCount : 0)} Records
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
