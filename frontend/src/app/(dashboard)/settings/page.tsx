'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { Building, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { currentWorkspaceId } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayedWorkspaceId =
    mounted && currentWorkspaceId
      ? currentWorkspaceId
      : '00000000-0000-0000-0000-000000000000';

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage multi-tenant workspace credentials, API access tokens, and security
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="w-4 h-4 text-[#10B981]" /> Workspace Configuration
          </CardTitle>
          <CardDescription>
            Tenant identifier stamped automatically across all database entities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Active Workspace ID</label>
            <Input
              value={displayedWorkspaceId}
              readOnly
              className="font-mono text-xs bg-muted"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Workspace Name</label>
            <Input defaultValue="Production Workspace" />
          </div>
          <Button size="sm">Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#10B981]" /> Tenant Security & Audit Policies
          </CardTitle>
          <CardDescription>
            Audit logging active with TimescaleDB hypertable partitioning
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span>Request-scoped Tenant Propagation</span>
            <span className="text-[#10B981] font-semibold">Enforced (nestjs-cls)</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span>Active Record Entity Inheritance</span>
            <span className="text-[#10B981] font-semibold">TenantBaseEntity</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span>Decoupled Audit Logging</span>
            <span className="text-[#10B981] font-semibold">EventEmitter2 (audit.record)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
