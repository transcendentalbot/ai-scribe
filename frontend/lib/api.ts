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
  const token = localStorage.getItem('idToken');
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
          
          debugLog('API', 'Extracted tokens from refresh', { 
            hasTokens: !!tokens, 
            hasAccessToken: !!tokens?.accessToken,
            tokenKeys: tokens ? Object.keys(tokens) : []
          });
          
          if (!tokens?.accessToken) {
            throw new Error('Invalid refresh response structure');
          }
          
          localStorage.setItem('accessToken', tokens.accessToken);
          localStorage.setItem('idToken', tokens.idToken);
          // Keep the existing refresh token since backend doesn't return a new one
          localStorage.setItem('refreshToken', refreshToken);
          
          // Retry original request
          error.config.headers.Authorization = `Bearer ${tokens.idToken}`;
          debugLog('API', 'Retrying request with new token', {
            url: error.config.url,
            hasToken: !!tokens.idToken,
            tokenPrefix: tokens.idToken?.substring(0, 20) + '...'
          });
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
  search: async ({ query, searchType = 'name' }: { query: string; searchType?: 'name' | 'mrn' }) => {
    const { data } = await api.get<{ patients: Patient[] }>(`/patients/search?query=${query}&searchType=${searchType}`);
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

export const recordingApi = {
  uploadAudio: async (encounterId: string, audioBlob: Blob, filename: string) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, filename);
    formData.append('encounterId', encounterId);
    
    return api.post('/recordings/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  getRecording: async (encounterId: string) => {
    return api.get(`/recordings/${encounterId}`);
  },
};

export const encounterApi = {
  getDailyList: async (date?: string, providerId?: string) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (providerId) params.append('providerId', providerId);
    
    const response = await api.get<{ 
      success: boolean;
      data: {
        encounters: Encounter[]; 
        summary: { total: number; byStatus: Record<string, number> } 
      }
    }>(`/encounters/daily?${params}`);
    return response.data.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: { encounter: Encounter } }>(`/encounters/${id}`);
    return response.data.data;
  },
  
  create: async (encounter: {
    patientId?: string;
    patientName?: string;
    patientMRN?: string;
    patientBirthdate?: string;
    type: 'NEW_PATIENT' | 'FOLLOW_UP' | 'SICK_VISIT' | 'WELLNESS_CHECK';
    consentObtained: boolean;
  }) => {
    const response = await api.post<{ success: boolean; data: { encounter: Encounter } }>('/encounters', encounter);
    return response.data.data;
  },
  
  updateStatus: async (id: string, status: EncounterStatus, notes?: string) => {
    const response = await api.put<{ success: boolean; data: { encounter: Encounter } }>(`/encounters/${id}/status`, {
      status,
      notes,
    });
    return response.data.data;
  },
  
  captureConsent: async (id: string, consent: {
    type: ConsentType;
    granted: boolean;
    notes?: string;
  }) => {
    const response = await api.post<{ success: boolean; data: { encounter: Encounter } }>(`/encounters/${id}/consent`, consent);
    return response.data.data;
  },
};