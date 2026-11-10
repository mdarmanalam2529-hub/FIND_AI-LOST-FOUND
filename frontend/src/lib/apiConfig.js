/**
 * Centralized API endpoint resolution for FindAI.
 * 
 * - In local development: VITE_API_URL is typically empty, so requests resolve to
 *   relative paths (e.g. '/api/matches') which are proxied by Vite to http://localhost:3001.
 * - In production (e.g. deployed on Vercel): VITE_API_URL points to the Render backend
 *   (e.g. 'https://findai-api.onrender.com'), so requests resolve to full absolute URLs.
 */

const RAW_API_URL = typeof import.meta !== 'undefined' && import.meta.env
  ? (import.meta.env.VITE_API_URL || '')
  : '';

// Remove trailing slash if present, and remove trailing '/api' if included in the env variable
// to guarantee clean endpoint concatenation.
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '').replace(/\/api$/, '');

/**
 * Returns the fully-qualified or proxy-relative URL for an API endpoint.
 *
 * @param {string} endpoint - Path such as '/api/matches' or 'api/auth/student-login'
 * @returns {string} Target URL
 */
export function getApiUrl(endpoint) {
  if (!endpoint) return '';
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // If absolute URL is already passed, return as-is
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

export default getApiUrl;

