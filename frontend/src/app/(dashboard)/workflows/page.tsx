'use client';

import React, { useState } from 'react';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function WorkflowsPage() {
  const [workflows] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Automated Workflows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build event-driven message sequences, keyword triggers, and auto-responders
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Create Workflow
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search workflows..." className="pl-9" />
        </div>
      </div>

      {workflows.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="flex flex-col items-center justify-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center text-[#10B981] mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg">No Workflows Configured</CardTitle>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Design automated pipelines that react immediately to incoming Meta webhooks,
              tag contacts, reply with AI, or assign human agents.
            </p>
            <Button size="sm" className="mt-6 gap-2">
              <Plus className="w-4 h-4" /> Create First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
