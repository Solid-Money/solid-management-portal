import axios from 'axios';
import { auth } from './firebase';
import { toast } from 'sonner';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL || 'http://localhost:5009',
});

// Add Firebase ID token to all requests
api.interceptors.request.use(
  async (config) => {
    if (auth) {
      const user = auth.currentUser;
      if (user) {
        try {
          console.log('[API] Getting Firebase ID token for request...');
          const token = await user.getIdToken();
          config.headers.Authorization = `Bearer ${token}`;
          console.log('[API] Token attached to request');
        } catch (error) {
          console.error('[API] Failed to get ID token:', error);
        }
      } else {
        console.warn('[API] No user signed in, request will be sent without auth');
      }
    }
    return config;
  },
  (error) => {
    console.error('[API] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('[API] Unauthorized request - token may be invalid or expired');
      toast.error('Session expired. Please sign in again.');
    } else {
      const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export default api;
