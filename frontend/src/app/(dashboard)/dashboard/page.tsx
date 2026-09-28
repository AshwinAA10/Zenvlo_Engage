'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MessageSquareQuote,
  Clock,
  Star,
  Send,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Building,
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

export default function DashboardOverviewPage() {
  const { business } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const publicLink =
    typeof window !== 'undefined' && business?.slug
      ? `${window.location.origin}/submit/${business.slug}`
      : 'https://zenvlo.com/submit/demo-business';

  const copyPublicLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const businessName = mounted && business?.name ? business.name : 'Your Business';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#10B981] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> India-First Reputation Platform
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {businessName} Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor incoming testimonials, WhatsApp requests, and social proof widgets
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge variant="default" className="gap-1.5 py-1 px-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Phase 1 Active
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={copyPublicLink}
            className="gap-2 text-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#10B981]" /> Copied Form Link
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy Testimonial Link
              </>
            )}
          </Button>
          <Link href="/settings">
            <Button size="sm" className="gap-2 text-xs">
              <Building className="w-3.5 h-3.5" /> Edit Business Profile
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="hover:border-[#10B981]/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Testimonials
            </CardTitle>
            <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.1)] text-[#10B981]">
              <MessageSquareQuote className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">0</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-[#10B981] font-medium flex items-center">
                +0% <ArrowUpRight className="w-3 h-3" />
              </span>{' '}
              Awaiting submissions
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-[#10B981]/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Approvals
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Clock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">0</div>
            <p className="text-xs text-muted-foreground mt-1">Requires business review</p>
          </CardContent>
        </Card>

        <Card className="hover:border-[#10B981]/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Average Rating
            </CardTitle>
            <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.1)] text-[#10B981]">
              <Star className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">5.0 ★</div>
            <p className="text-xs text-muted-foreground mt-1">Calculated from approved reviews</p>
          </CardContent>
        </Card>

        <Card className="hover:border-[#10B981]/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              WhatsApp Requests
            </CardTitle>
            <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.1)] text-[#10B981]">
              <Send className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">0</div>
            <p className="text-xs text-muted-foreground mt-1">Ready for Phase 4</p>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-base text-foreground">
              Core Testimonial Loop Workflow
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Phase 1 foundation is established. The sequential roadmap follows:
            </p>
          </div>
          <Badge variant="outline" className="text-xs text-[#10B981] border-[#10B981]/30">
            Phase 1 Complete
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-muted/40 border border-border">
            <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider">Step 1</span>
            <h4 className="text-sm font-semibold text-foreground mt-1">Business Setup</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Account created, profile initialized, server-side tenant isolation active.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/20 border border-border/60 opacity-80">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Step 2</span>
            <h4 className="text-sm font-semibold text-foreground mt-1">Customer Management</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Add customers manually or import via CSV (Phase 2).
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/20 border border-border/60 opacity-80">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Step 3</span>
            <h4 className="text-sm font-semibold text-foreground mt-1">Testimonials & Review</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Public frictionless review submission, moderation approval workflow (Phase 2 & 3).
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/20 border border-border/60 opacity-80">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Step 4</span>
            <h4 className="text-sm font-semibold text-foreground mt-1">WhatsApp & Widgets</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Automated request delivery via WhatsApp service & embeddable website widgets (Phase 4 & 6).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
