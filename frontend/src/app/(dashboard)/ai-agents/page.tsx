'use client';

import React, { useState } from 'react';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Plus, Sparkles } from 'lucide-react';

export default function AiAgentsPage() {
  const [agents] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F8FAFC]">AI Agents & Assistants</h1>
          <p className="mt-1 text-sm text-[#A1A1AA]">
            Autonomous LLM agents for WhatsApp customer support and lead qualification
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Create AI Agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <Card className="border-[#27272a] bg-[#09090b] text-center py-16">
          <CardContent className="flex flex-col items-center justify-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#18181b] border border-[#27272a] flex items-center justify-center text-[#10B981] mb-4">
              <Bot className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg flex items-center justify-center gap-2">
              No AI Agents Deployed <Sparkles className="w-4 h-4 text-[#10B981]" />
            </CardTitle>
            <p className="text-sm text-[#A1A1AA] mt-2 leading-relaxed">
              Connect custom knowledge bases and prompt guidelines to let AI handle repetitive inquiries,
              schedule appointments, and escalate complex requests to your team.
            </p>
            <Button size="sm" className="mt-6 gap-2">
              <Plus className="w-4 h-4" /> Deploy First Agent
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
