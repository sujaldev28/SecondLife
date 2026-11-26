'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, clearStoredTokens, getStoredToken, setStoredTokens } from '@/lib/api';

export interface UserOrg {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  orgType: string;
  role: string;
  isPersonal: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  headline?: string | null;
  bio?: string | null;
  primaryRole: string;
  emailVerified: boolean;
  isDemoAccount?: boolean;
  authProvider?: string;
  notificationPrefs?: {
    emailDeals: boolean;
    emailVerification: boolean;
    emailMarketing: boolean;
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  activeOrganizationId: string | null;
  activeWorkspaceId: string | null;
  permissions: string[];
  organizations: UserOrg[];
  loading: boolean;
  refreshUser: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [organizations, setOrganizations] = useState<UserOrg[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{
        user: AuthUser;
        activeOrganizationId: string | null;
        activeWorkspaceId: string | null;
        permissions: string[];
        organizations: UserOrg[];
      }>('/auth/me');
      setUser(data.user);
      setActiveOrganizationId(data.activeOrganizationId);
      setActiveWorkspaceId(data.activeWorkspaceId);
      setPermissions(data.permissions);
      setOrganizations(data.organizations);
    } catch {
      if (getStoredToken()) {
        clearStoredTokens();
      }
      setUser(null);
      setPermissions([]);
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const switchOrganization = async (organizationId: string) => {
    const res = await apiFetch<{
      accessToken: string;
      activeOrganizationId: string;
      activeWorkspaceId: string | null;
    }>('/organizations/switch', {
      method: 'POST',
      body: JSON.stringify({ organizationId }),
    });
    setStoredTokens(res.accessToken);
    await refreshUser();
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout network failures
    }
    clearStoredTokens();
    setUser(null);
    setPermissions([]);
    setOrganizations([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeOrganizationId,
        activeWorkspaceId,
        permissions,
        organizations,
        loading,
        refreshUser,
        switchOrganization,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
