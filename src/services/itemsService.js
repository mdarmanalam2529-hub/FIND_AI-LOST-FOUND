import { supabase } from '../lib/supabase';

/**
 * Service for interacting with the Supabase `items` table and the private `item-images` storage bucket.
 * All mutations rely on Supabase Row Level Security (RLS) to enforce user ownership.
 */

export const BUCKET_NAME = 'item-images';
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const itemsService = {
  /**
   * Client-side image validation helper
   */
  validateImage(file) {
    if (!file) {
      return { valid: false, error: 'No file selected.' };
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file format. Only JPEG, PNG, and WebP images are allowed.',
      };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size exceeds the 5 MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(2)} MB.`,
      };
    }
    return { valid: true };
  },

  /**
   * Upload an image to the private 'item-images' storage bucket.
   * Path convention: {userId}/{itemId}/{timestamp}.{ext}
   */
  async uploadItemImage({ userId, itemId, file }) {
    if (!supabase) throw new Error('Supabase client is not initialized.');

    const validation = this.validateImage(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const extension = file.name.split('.').pop().toLowerCase() || 'jpg';
    const cleanExt = ['jpg', 'jpeg', 'png', 'webp'].includes(extension) ? extension : 'jpg';
    const filePath = `${userId}/${itemId}/${Date.now()}.${cleanExt}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[itemsService] Error uploading image to Supabase Storage:', error);
      throw error;
    }

    return data.path;
  },

  /**
   * Remove an image from the private storage bucket
   */
  async deleteItemImage(imagePath) {
    if (!supabase || !imagePath) return;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([imagePath]);

    if (error) {
      console.error('[itemsService] Error deleting image from storage:', error);
      // Non-fatal, continue so DB deletion does not stall
    }
  },

  /**
   * Generate a short-lived signed URL for a private image
   */
  async getSignedImageUrl(imagePath, expiresIn = 3600) {
    if (!supabase || !imagePath) return null;

    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(imagePath, expiresIn);

      if (error) {
        console.warn(`[itemsService] Could not generate signed URL for ${imagePath}:`, error.message);
        return null;
      }
      return data?.signedUrl || null;
    } catch (err) {
      console.warn('[itemsService] Unexpected error getting signed URL:', err);
      return null;
    }
  },

  /**
   * Create a new item report (with safe image upload rollback handling)
   * Safe workflow:
   * 1. Create item record in PostgreSQL first (returns generated item UUID).
   * 2. If an image is provided, upload to storage at {userId}/{itemId}/{timestamp}.ext.
   * 3. Update the item record with the image_path.
   * 4. If upload fails, safely delete the created item so no broken or orphaned records remain.
   */
  async createReportWithImage({ itemData, imageFile }) {
    if (!supabase) throw new Error('Supabase client is not initialized.');

    // 1. Create item record first
    const newItem = await this.createItem({
      ...itemData,
      imagePath: null,
    });

    // If no image was attached, return immediately
    if (!imageFile) {
      return newItem;
    }

    // 2. Upload image
    let uploadedPath = null;
    try {
      uploadedPath = await this.uploadItemImage({
        userId: itemData.userId,
        itemId: newItem.id,
        file: imageFile,
      });

      // 3. Update item with storage path
      const updatedItem = await this.updateItem(newItem.id, {
        image_path: uploadedPath,
      });

      return updatedItem;
    } catch (uploadError) {
      console.error('[itemsService] Image upload failed. Rolling back item record:', uploadError);
      // Rollback item record to avoid broken / incomplete records
      try {
        await this.deleteItem(newItem.id);
      } catch (rollbackError) {
        console.error('[itemsService] Rollback error:', rollbackError);
      }

      // If the file was partially uploaded somehow, clean up
      if (uploadedPath) {
        await this.deleteItemImage(uploadedPath);
      }

      throw new Error(`Report cancelled: Failed to upload image (${uploadError.message}). Please try again.`);
    }
  },

  /**
   * Base database insert
   */
  async createItem({
    userId,
    itemType,
    title,
    description,
    category,
    color,
    locationDescription,
    incidentDate,
    imagePath = null,
  }) {
    if (!supabase) throw new Error('Supabase client is not initialized.');

    const payload = {
      user_id: userId,
      item_type: itemType,
      title: title.trim(),
      description: description.trim(),
      category,
      color: color ? color.trim() : null,
      location_description: locationDescription.trim(),
      incident_date: incidentDate || new Date().toISOString().split('T')[0],
      image_path: imagePath,
      status: 'open',
    };

    const { data, error } = await supabase
      .from('items')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[itemsService] Error creating item:', error);
      throw error;
    }

    return data;
  },

  /**
   * Fetch all open reports
   */
  async getOpenReports(itemType = null) {
    if (!supabase) throw new Error('Supabase client is not initialized.');

    let query = supabase
      .from('items')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (itemType) {
      query = query.eq('item_type', itemType);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[itemsService] Error fetching open reports:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Fetch user-specific reports
   */
  async getUserReports(userId) {
    if (!supabase) throw new Error('Supabase client is not initialized.');
    if (!userId) return [];

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[itemsService] Error fetching user reports:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * Update report and handle image replacement or removal
   */
  async updateReportWithImage({
    itemId,
    userId,
    updates,
    newImageFile = null,
    removeCurrentImage = false,
    currentImagePath = null,
  }) {
    if (!supabase) throw new Error('Supabase client is not initialized.');

    let finalImagePath = currentImagePath;

    // Case 1: User requested removing current image
    if (removeCurrentImage && currentImagePath) {
      await this.deleteItemImage(currentImagePath);
      finalImagePath = null;
    }

    // Case 2: User uploaded a new replacement image
    if (newImageFile) {
      const newPath = await this.uploadItemImage({
        userId,
        itemId,
        file: newImageFile,
      });

      // Remove old image after successful upload of new one
      if (currentImagePath && currentImagePath !== newPath) {
        await this.deleteItemImage(currentImagePath);
      }
      finalImagePath = newPath;
    }

    const itemUpdates = {
      ...updates,
      image_path: finalImagePath,
    };

    return this.updateItem(itemId, itemUpdates);
  },

  /**
   * Base database update
   */
  async updateItem(itemId, updates) {
    if (!supabase) throw new Error('Supabase client is not initialized.');

    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('[itemsService] Error updating item:', error);
      throw error;
    }
    return data;
  },

  /**
   * Delete report and any associated image from storage
   */
  async deleteReportAndImage(itemId, imagePath = null) {
    if (!supabase) throw new Error('Supabase client is not initialized.');

    // 1. Delete record from database
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('[itemsService] Error deleting item:', error);
      throw error;
    }

    // 2. Delete storage object if present
    if (imagePath) {
      await this.deleteItemImage(imagePath);
    }

    return true;
  },

  /**
   * Request AI candidate matches for a target report from backend API
   */
  async findMatches(targetItemId, { limit = 10 } = {}) {
    if (!supabase) throw new Error('Supabase client is not initialized.');

    // 1. Obtain current user session access token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      throw new Error('Authentication required: please log in to search for matches.');
    }

    // 2. Call backend /api/matches via Vite proxy
    try {
      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetItemId, limit }),
      });

      if (!response.ok) {
        let errJson = null;
        try {
          errJson = await response.json();
        } catch {
          // non-JSON
        }

        if (response.status === 401) {
          throw new Error('Your session has expired. Please refresh the page and sign in again.');
        }
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          throw new Error('The AI matching backend is currently unreachable. Make sure "npm run server" is running on port 3001.');
        }

        throw new Error(errJson?.message || `Matching request failed (HTTP ${response.status}).`);
      }

      return await response.json();
    } catch (fetchErr) {
      if (fetchErr.name === 'TypeError' && fetchErr.message?.includes('fetch')) {
        throw new Error('Could not connect to the AI matching service. Please ensure the backend is running ("npm run server" on port 3001).');
      }
      throw fetchErr;
    }
  },

  /**
   * Base database delete
   */
  async deleteItem(itemId) {
    if (!supabase) throw new Error('Supabase client is not initialized.');

    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('[itemsService] Error deleting item:', error);
      throw error;
    }
    return true;
  },
};
