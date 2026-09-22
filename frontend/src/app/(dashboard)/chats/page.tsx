'use client';

import React, { useState } from 'react';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function ChatsPage() {
  const [conversations] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Unified Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time conversations from WhatsApp Cloud & Instagram Graph API
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Start Conversation
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search messages or contacts..." className="pl-9" />
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="w-4 h-4" /> Filter
        </Button>
      </div>

      {conversations.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="flex flex-col items-center justify-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center text-[#10B981] mb-4">
              <MessageSquare className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg">No Active Conversations</CardTitle>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              When customers message your connected WhatsApp numbers or Instagram direct accounts,
              their conversations will stream here in real time.
            </p>
            <Button size="sm" className="mt-6 gap-2">
              Connect Channel First
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
