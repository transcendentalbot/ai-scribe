'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { debugLog } from '@/utils/debug-logger';

interface User {
  id: string;
  email: string;
  name?: string;
  providerId?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Temporary CORS proxy while backend deployment is in progress
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cors-anywhere.herokuapp.com/https://41h7fp3vk7.execute-api.us-east-1.amazonaws.com/prod';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) throw new Error('No refresh token');

      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      const responseData = response.data.data || response.data;
      const tokens = responseData.tokens;
      
      if (!tokens?.accessToken) {
        throw new Error('Invalid refresh response');
      }
      
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', refreshToken); // Keep existing refresh token
      localStorage.setItem('idToken', tokens.idToken);
      
      // Refresh doesn't return user data, so keep existing user
      const existingUser = localStorage.getItem('user');
      if (existingUser) {
        setUser(JSON.parse(existingUser));
      }
    } catch (error) {
      localStorage.clear();
      setUser(null);
      throw error;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        const storedUser = localStorage.getItem('user');
        
        // If we have a stored user, use it immediately
        if (storedUser && accessToken) {
          debugLog('AUTH', 'Found stored user and token, setting user state', { user: storedUser });
          setUser(JSON.parse(storedUser));
          setIsLoading(false);
          
          // Verify token in background
          axios.get(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).then((response) => {
            debugLog('AUTH', 'Background token verification successful');
            const userData = response.data.data?.user || response.data.user || response.data;
            if (userData && userData.id) {
              localStorage.setItem('user', JSON.stringify(userData));
            }
          }).catch(async (error) => {
            debugLog('AUTH', 'Token verification failed', { status: error.response?.status, error });
            if (error.response?.status === 401) {
              try {
                await refreshToken();
              } catch {
                localStorage.clear();
                setUser(null);
                router.push('/login');
              }
            }
          });
          return;
        }
        
        if (accessToken) {
          // No stored user, fetch it
          const response = await axios.get(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          debugLog('AUTH', '/auth/me response', response.data);
          const userData = response.data.data?.user || response.data.user || response.data;
          if (userData && userData.id) {
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          } else {
            throw new Error('Invalid user data received');
          }
        }
      } catch (error) {
        debugLog('AUTH', 'Auth init failed', error);
        localStorage.clear();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    debugLog('AUTH', 'Starting auth initialization');
    initAuth();
  }, [refreshToken, router]);

  const login = async (email: string, password: string) => {
    debugLog('AUTH', 'Login attempt started');
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      const { tokens, user } = response.data.data;
      debugLog('AUTH', 'Login successful, storing tokens and user', user);
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      localStorage.setItem('idToken', tokens.idToken);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      debugLog('AUTH', 'User state updated, navigating to home');
      // Small delay to ensure state updates propagate
      setTimeout(() => {
        router.push('/');
      }, 100);
    } catch (error) {
      debugLog('AUTH', 'Login failed', error);
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Login failed');
      }
      throw new Error('Login failed');
    }
  };

  const signup = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        email,
        password,
        firstName,
        lastName,
      });

      // Registration successful, but user needs to verify email
      // For now, redirect to login page
      router.push('/login?message=Please check your email for verification code');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.message || 'Signup failed');
      }
      throw new Error('Signup failed');
    }
  };

  const logout = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        // Call backend logout endpoint to invalidate tokens
        await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => {
          // Even if the backend call fails, proceed with local logout
          debugLog('AUTH', 'Backend logout failed, proceeding with local logout');
        });
      }
    } catch (error) {
      debugLog('AUTH', 'Logout error', error);
    } finally {
      // Always clear local storage and redirect
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('idToken');
      localStorage.removeItem('user');
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}