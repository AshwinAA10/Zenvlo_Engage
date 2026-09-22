'use client';

import React, { useState } from 'react';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function CampaignsPage() {
  const [campaigns] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Broadcast Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Launch targeted WhatsApp & Instagram broadcast campaigns at scale
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Create Campaign
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search campaigns..." className="pl-9" />
        </div>
      </div>

      {campaigns.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="flex flex-col items-center justify-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center text-[#10B981] mb-4">
              <Send className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg">No Campaigns Yet</CardTitle>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Create your first scheduled or instant broadcast campaign to reach contacts
              with pre-approved WhatsApp templates and interactive messages.
            </p>
            <Button size="sm" className="mt-6 gap-2">
              <Plus className="w-4 h-4" /> New Campaign
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
