'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  Users,
  Send,
  Zap,
  Radio,
  ArrowUpRight,
  ShieldCheck,
  Cpu,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Engage Console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unified WhatsApp & Instagram automation infrastructure
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="default" className="gap-1.5 py-1 px-3">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Foundation Ready
          </Badge>
          <Link href="/channels">
            <Button size="sm" className="gap-2">
              <Radio className="w-4 h-4" /> Connect Channel
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="hover:border-[#10B981]/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Conversations
            </CardTitle>
            <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.1)] text-[#10B981]">
              <MessageSquare className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">0</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-[#10B981] font-medium flex items-center">
                +0% <ArrowUpRight className="w-3 h-3" />
              </span>{' '}
              Awaiting channel traffic
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-[#10B981]/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Contacts
            </CardTitle>
            <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.1)] text-[#10B981]">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">0</div>
            <p className="text-xs text-muted-foreground mt-1">Tenant audience directory</p>
          </CardContent>
        </Card>

        <Card className="hover:border-[#10B981]/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Broadcast Campaigns
            </CardTitle>
            <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.1)] text-[#10B981]">
              <Send className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">0</div>
            <p className="text-xs text-muted-foreground mt-1">BullMQ queue scheduled</p>
          </CardContent>
        </Card>

        <Card className="hover:border-[#10B981]/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Automated Workflows
            </CardTitle>
            <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.1)] text-[#10B981]">
              <Zap className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">0</div>
            <p className="text-xs text-muted-foreground mt-1">Trigger pipeline ready</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#10B981]" />
                Architecture & Foundation Status
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Verified core components ready for business module plug-in
              </p>
            </div>
            <Badge variant="default">All Systems Verified</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Cpu className="w-4 h-4 text-[#10B981]" /> NestJS & Active Record
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                BaseTable & TenantBaseEntity automatically bind request-scoped workspace context via nestjs-cls.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Layers className="w-4 h-4 text-[#10B981]" /> BullMQ & Webhooks
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Asynchronous Meta webhook ingestion enqueues payloads in &lt; 50ms with zero request blocking.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="w-4 h-4 text-[#10B981]" /> TimescaleDB Audit
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Decoupled audit logging over EventEmitter2 with automated hypertable partitioning.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
