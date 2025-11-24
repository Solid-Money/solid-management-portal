import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SOLID_API_BASE_URL || 'http://localhost:3000',
});

// Auth interceptor removed for public access
// api.interceptors.request.use(async (config) => { ... });

export default api;
