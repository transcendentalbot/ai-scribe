import axios from 'axios';
import { Encounter, Patient, EncounterStatus, ConsentType } from '@/types';
import { debugLog } from '@/utils/debug-logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gy8gxc5m3c.execute-api.us-east-1.amazonaws.com/prod';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    debugLog('API', 'Response error', { status: error.response?.status, url: error.config?.url });
    if (error.response?.status === 401 && !error.config?._retry) {
      debugLog('API', '401 error, attempting token refresh');
      error.config._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          debugLog('API', 'Token refresh response', response.data);
          
          // Handle the wrapped response structure
          const tokens = response.data?.data?.tokens || response.data?.tokens;
          
          if (!tokens?.accessToken) {
            throw new Error('Invalid refresh response structure');
          }
          
          localStorage.setItem('accessToken', tokens.accessToken);
          localStorage.setItem('idToken', tokens.idToken);
          // Keep the existing refresh token since backend doesn't return a new one
          localStorage.setItem('refreshToken', refreshToken);
          
          // Retry original request
          error.config.headers.Authorization = `Bearer ${tokens.accessToken}`;
          return api(error.config);
        }
      } catch (refreshError) {
        debugLog('API', 'Token refresh failed, clearing storage', refreshError);
        // Don't redirect here, let the auth context handle it
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('idToken');
        localStorage.removeItem('user');
      }
    }
    return Promise.reject(error);
  }
);

// API methods
export const patientApi = {
  search: async (query: string) => {
    const { data } = await api.get<{ patients: Patient[] }>(`/patients/search?query=${query}`);
    return data;
  },
  
  getById: async (id: string) => {
    const { data } = await api.get<{ patient: Patient }>(`/patients/${id}`);
    return data;
  },
  
  create: async (patient: Omit<Patient, 'id'>) => {
    const { data } = await api.post<{ patient: Patient }>('/patients', patient);
    return data;
  },
};

export const encounterApi = {
  getDailyList: async (date?: string, providerId?: string) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (providerId) params.append('providerId', providerId);
    
    const { data } = await api.get<{ 
      encounters: Encounter[]; 
      summary: { total: number; byStatus: Record<string, number> } 
    }>(`/encounters/daily?${params}`);
    return data;
  },
  
  getById: async (id: string) => {
    const { data } = await api.get<{ encounter: Encounter }>(`/encounters/${id}`);
    return data;
  },
  
  create: async (encounter: {
    patientId: string;
    scheduledAt: string;
    type: Encounter['type'];
    chiefComplaint?: string;
    reasonForVisit?: string;
  }) => {
    const { data } = await api.post<{ encounter: Encounter }>('/encounters', encounter);
    return data;
  },
  
  updateStatus: async (id: string, status: EncounterStatus, notes?: string) => {
    const { data } = await api.put<{ encounter: Encounter }>(`/encounters/${id}/status`, {
      status,
      notes,
    });
    return data;
  },
  
  captureConsent: async (id: string, consent: {
    type: ConsentType;
    granted: boolean;
    notes?: string;
  }) => {
    const { data } = await api.post<{ encounter: Encounter }>(`/encounters/${id}/consent`, consent);
    return data;
  },
};