import { supabase } from '../lib/supabase';
import { itemsService } from './itemsService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Strips phone numbers and email patterns embedded in descriptions or locations.
 */
function redactPrivateText(text) {
  if (!text || typeof text !== 'string') return text || '';
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
    .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
}

/**
 * Formats full name into privacy-safe display format: "First L."
 */
function formatPublicName(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'Student';
  const parts = rawName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Student';
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  }
  const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

export const communityService = {
  /**
   * Fetches paginated community feed items.
   * Tries backend /api/community/items first, with direct Supabase client fallback.
   */
  async fetchCommunityItems({
    page = 1,
    limit = 12,
    type = 'all',
    category = 'all',
    status = 'all_active',
    date = 'all',
    sort = 'newest',
    search = '',
  } = {}) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const currentUserId = sessionData?.session?.user?.id || null;

    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      type,
      category,
      status,
      date,
      sort,
      search,
    });

    if (token) {
      try {
        const res = await fetch(`${API_BASE_URL}/community/items?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (res.ok) {
          const data = await res.json();
          return {
            items: data.items || [],
            pagination: data.pagination || { page, limit, total: 0, totalPages: 1 },
            stats: data.stats || null,
          };
        }
      } catch (networkErr) {
        console.warn('[communityService] Backend API not reachable, falling back to direct Supabase query:', networkErr.message);
      }
    }

    // Direct Supabase Fallback (Respecting RLS & Status)
    let query = supabase
      .from('items')
      .select('id, user_id, item_type, title, description, category, color, location_description, incident_date, image_path, status, created_at, updated_at', { count: 'exact' });

    if (status === 'resolved') {
      query = query.in('status', ['returned', 'matched']);
    } else if (status === 'all') {
      query = query.in('status', ['open', 'returned', 'matched']);
    } else {
      query = query.eq('status', 'open');
    }

    if (type !== 'all') {
      query = query.eq('item_type', type);
    }
    if (category !== 'all') {
      query = query.eq('category', category);
    }

    if (date !== 'all') {
      const now = new Date();
      let cutoff = null;
      if (date === 'today') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (date === 'week') {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (date === 'month') {
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      if (cutoff) {
        query = query.gte('created_at', cutoff);
      }
    }

    query = query.order('created_at', { ascending: sort === 'oldest' });

    const { data: rawItems, error } = await query;
    if (error) {
      console.error('[communityService] Supabase fallback query error:', error);
      throw new Error(error.message || 'Failed to load community items.');
    }

    let itemsPool = rawItems || [];

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      itemsPool = itemsPool.filter((item) => {
        return (
          (item.title || '').toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q) ||
          (item.location_description || '').toLowerCase().includes(q)
        );
      });
    }

    const totalMatching = itemsPool.length;
    const offset = (page - 1) * limit;
    const paginated = itemsPool.slice(offset, offset + limit);

    // Batch fetch student profiles for public display name
    const userIds = [...new Set(paginated.map((i) => i.user_id).filter(Boolean))];
    const profileMap = new Map();
    if (userIds.length > 0) {
      try {
        const { data: profiles } = await supabase
          .from('student_profiles')
          .select('user_id, student_name')
          .in('user_id', userIds);
        if (profiles) {
          for (const p of profiles) {
            profileMap.set(p.user_id, p.student_name);
          }
        }
      } catch (profErr) {
        console.warn('[communityService] Profile lookup fallback notice:', profErr.message);
      }
    }

    const itemsWithSignedUrls = await Promise.all(
      paginated.map(async (item) => {
        let signedUrl = null;
        if (item.image_path) {
          try {
            signedUrl = await itemsService.getSignedImageUrl(item.image_path);
          } catch {
            // Ignore signing error
          }
        }
        return {
          id: item.id,
          item_type: item.item_type,
          title: item.title,
          description: redactPrivateText(item.description),
          category: item.category,
          color: item.color,
          location_description: redactPrivateText(item.location_description),
          incident_date: item.incident_date,
          status: item.status,
          created_at: item.created_at,
          updated_at: item.updated_at,
          signed_image_url: signedUrl,
          reporter_name: formatPublicName(profileMap.get(item.user_id)),
          is_own_listing: Boolean(currentUserId && item.user_id === currentUserId),
        };
      })
    );

    // Compute stats
    const [openLostRes, openFoundRes, resolvedRes] = await Promise.all([
      supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('item_type', 'lost'),
      supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('item_type', 'found'),
      supabase.from('items').select('*', { count: 'exact', head: true }).in('status', ['returned', 'matched']),
    ]);

    const stats = {
      totalActive: (openLostRes.count || 0) + (openFoundRes.count || 0),
      totalLost: openLostRes.count || 0,
      totalFound: openFoundRes.count || 0,
      totalResolved: resolvedRes.count || 0,
    };

    return {
      items: itemsWithSignedUrls,
      pagination: {
        page,
        limit,
        total: totalMatching,
        totalPages: Math.max(1, Math.ceil(totalMatching / limit)),
      },
      stats,
    };
  },

  /**
   * Fetches community live statistics.
   */
  async fetchCommunityStats() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (token) {
      try {
        const res = await fetch(`${API_BASE_URL}/community/stats`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          return data.stats;
        }
      } catch (err) {
        console.warn('[communityService] Stats API notice:', err.message);
      }
    }

    const [openLostRes, openFoundRes, resolvedRes] = await Promise.all([
      supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('item_type', 'lost'),
      supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('item_type', 'found'),
      supabase.from('items').select('*', { count: 'exact', head: true }).in('status', ['returned', 'matched']),
    ]);

    return {
      totalActive: (openLostRes.count || 0) + (openFoundRes.count || 0),
      totalLost: openLostRes.count || 0,
      totalFound: openFoundRes.count || 0,
      totalResolved: resolvedRes.count || 0,
    };
  },

  /**
   * Submits an abuse/complaint report for a community listing.
   */
  async reportListing({ itemId, reason, details = '', evidence = '' }) {
    if (!itemId) throw new Error('Listing ID is required.');
    if (!reason) throw new Error('Please select a report reason.');

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const user = sessionData?.session?.user;

    if (!user || !token) {
      throw new Error('You must be signed in to report a listing.');
    }

    // Try backend API first
    try {
      const res = await fetch(`${API_BASE_URL}/community/items/${itemId}/report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
          details,
          evidence,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error || 'Failed to submit report.');
      }
      return body;
    } catch (apiErr) {
      // If error is a user-facing 400/409 error from API, re-throw it
      if (apiErr.message.includes('already reported') || apiErr.message.includes('own listing') || apiErr.message.includes('closed')) {
        throw apiErr;
      }
      console.warn('[communityService] Backend API report notice, attempting Supabase fallback:', apiErr.message);
    }

    // Direct Supabase Fallback
    try {
      // Check duplicate
      const { data: existingReport } = await supabase
        .from('community_item_reports')
        .select('id')
        .eq('item_id', itemId)
        .eq('reporter_id', user.id)
        .maybeSingle();

      if (existingReport) {
        throw new Error('You have already reported this listing. Our campus moderation team has been notified.');
      }

      const { error: insertErr } = await supabase
        .from('community_item_reports')
        .insert([{
          item_id: itemId,
          reporter_id: user.id,
          reason,
          details: details?.trim() || null,
          evidence: evidence?.trim() || null,
          status: 'pending',
        }]);

      if (insertErr) {
        if (insertErr.code === '23505') {
          throw new Error('You have already reported this listing.');
        }
        throw new Error(insertErr.message);
      }

      return {
        success: true,
        message: 'Thank you for keeping our campus safe. Our moderation team has been notified.',
      };
    } catch (fallbackErr) {
      throw new Error(fallbackErr.message || 'Failed to submit report.');
    }
  },
};

