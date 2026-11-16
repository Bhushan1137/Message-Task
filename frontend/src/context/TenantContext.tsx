'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';

interface TenantContextType {
  currentTenantId: string;
  setTenantId: (id: string) => void;
  availableTenants: Array<{ id: string; name: string }>;
}

const AVAILABLE_TENANTS = [
  { id: 'tenant-a', name: 'Tenant A' },
  { id: 'tenant-b', name: 'Tenant B' },
];

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [currentTenantId, setCurrentTenantIdState] = useState<string>('tenant-a');
  const queryClient = useQueryClient();

  useEffect(() => {
    // Read from localStorage if available
    const saved = typeof window !== 'undefined' ? localStorage.getItem('selected_tenant_id') : null;
    if (saved && (saved === 'tenant-a' || saved === 'tenant-b')) {
      setCurrentTenantIdState(saved);
      api.setTenantId(saved);
    } else {
      api.setTenantId('tenant-a');
    }
  }, []);

  const setTenantId = (id: string) => {
    setCurrentTenantIdState(id);
    api.setTenantId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selected_tenant_id', id);
    }
    // Invalidate all queries when tenant switches so data refreshes cleanly
    queryClient.invalidateQueries();
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenantId,
        setTenantId,
        availableTenants: AVAILABLE_TENANTS,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
