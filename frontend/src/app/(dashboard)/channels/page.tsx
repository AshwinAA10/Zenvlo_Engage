'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Radio, ExternalLink, Plus } from 'lucide-react';

export default function ChannelsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Connected Channels</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Integrate WhatsApp Cloud API (WABA) and Instagram Graph API
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(16,185,129,0.15)] border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base">WhatsApp Business Cloud</CardTitle>
                  <CardDescription className="text-xs">Official Meta Cloud API</CardDescription>
                </div>
              </div>
              <Badge variant="secondary">Not Connected</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Connect your verified Meta Business Manager account to send interactive messages,
              receive high-volume webhooks, and trigger automatic responses.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Connect WABA
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                Meta Docs <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Instagram Graph API</CardTitle>
                  <CardDescription className="text-xs">Direct Messages & Story Replies</CardDescription>
                </div>
              </div>
              <Badge variant="secondary">Not Connected</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Integrate Instagram Professional Accounts to automate DM responses, comment triggers,
              and lead capture directly inside your unified inbox.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Connect Instagram
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                Setup Guide <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
