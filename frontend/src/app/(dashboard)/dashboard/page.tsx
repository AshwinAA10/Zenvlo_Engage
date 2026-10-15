'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  ArrowRight,
  CheckCircle2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';

interface OnboardingStatus {
  business_id: string;
  completed: boolean;
  dismissed: boolean;
  current_step: number;
  completed_steps: string[];
  skipped_steps: string[];
  has_profile: boolean;
  has_customer: boolean;
  has_request: boolean;
  has_testimonial: boolean;
  has_widget: boolean;
}

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { business } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [dismissBanner, setDismissBanner] = useState(false);
  const [metrics, setMetrics] = useState({
    testimonialsTotal: 0,
    pendingApprovals: 0,
    averageRating: 5.0,
    requestsTotal: 0,
    deliveryRate: 100,
  });

  useEffect(() => {
    setMounted(true);
    const loadOverviewData = async () => {
      try {
        const [testimonialsRes, requestsRes, onboardingRes] = await Promise.all([
          apiClient.get('/testimonials').catch(() => ({ data: { total: 0, counts: { pending: 0, approved: 0, averageRating: 5.0 } } })),
          apiClient.get('/requests/stats').catch(() => ({ data: { total_sent: 0, delivery_rate: 100 } })),
          apiClient.get('/business/onboarding-status').catch(() => null),
        ]);

        const counts = testimonialsRes.data?.counts || { total: 0, pending: 0, approved: 0, averageRating: 5.0 };
        const reqStats = requestsRes.data || { total_sent: 0, delivery_rate: 100 };

        setMetrics({
          testimonialsTotal: counts.total || testimonialsRes.data?.total || 0,
          pendingApprovals: counts.pending || 0,
          averageRating: counts.averageRating !== undefined ? counts.averageRating : 5.0,
          requestsTotal: reqStats.total_sent || 0,
          deliveryRate: reqStats.delivery_rate !== undefined ? reqStats.delivery_rate : 100,
        });

        if (onboardingRes?.data) {
          const status: OnboardingStatus = onboardingRes.data;
          setOnboardingStatus(status);
          // Show welcome modal if onboarding is not completed and user hasn't explicitly dismissed it
          if (!status.completed && !status.dismissed) {
            setShowWelcomeModal(true);
          }
        }
      } catch {
        // Fallback gracefully
      }
    };
    loadOverviewData();
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

  const handleDismissWelcome = async () => {
    setShowWelcomeModal(false);
    try {
      await apiClient.patch('/business/onboarding-status', { dismissed: true });
      if (onboardingStatus) {
        setOnboardingStatus({ ...onboardingStatus, dismissed: true });
      }
    } catch {
      // Continue locally
    }
  };

  const businessName = mounted && business?.name ? business.name : 'Your Business';
  const isIncomplete = onboardingStatus && !onboardingStatus.completed && !dismissBanner;

  return (
    <div className="space-y-8">
      {/* Welcome Experience Modal for Newly Activated Users */}
      <Dialog open={showWelcomeModal} onOpenChange={(open) => !open && handleDismissWelcome()}>
        <DialogContent className="max-w-lg border-border bg-[#09090b] text-foreground p-6">
          <DialogHeader className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(16,185,129,0.12)] border border-[#10B981]/30 text-[#10B981] text-xs font-semibold w-fit">
              <Sparkles className="w-3.5 h-3.5" /> Welcome to Zenvlo Engage
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              Welcome aboard, {businessName}!
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Zenvlo Engage helps you turn customer conversations into high-converting website social proof. In 2 minutes, configure your profile and start collecting verified testimonials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-[rgba(16,185,129,0.15)] text-[#10B981] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                1
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-foreground">Configure WhatsApp Sender & Profile</h4>
                <p className="text-[11px] text-muted-foreground">Personalize your brand identity for official WhatsApp review requests.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-[rgba(16,185,129,0.15)] text-[#10B981] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                2
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-foreground">Receive Genuine Photo & Video Reviews</h4>
                <p className="text-[11px] text-muted-foreground">Your dedicated mobile-optimized link captures 5-star ratings with photos.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-[rgba(16,185,129,0.15)] text-[#10B981] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                3
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-foreground">Moderate & Embed Live Widgets</h4>
                <p className="text-[11px] text-muted-foreground">Approve customer submissions and display live social proof on your site.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDismissWelcome}
              className="text-xs"
            >
              Explore Dashboard First
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setShowWelcomeModal(false);
                router.push('/onboarding');
              }}
              className="text-xs font-bold gap-1.5"
            >
              Start 2-Minute Guided Setup <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incomplete Setup Recovery Banner */}
      {isIncomplete && (
        <div
          role="region"
          aria-label="Setup Incomplete Banner"
          className="p-4 rounded-2xl bg-gradient-to-r from-[rgba(16,185,129,0.12)] to-[rgba(16,185,129,0.04)] border border-[#10B981]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#10B981]/20 text-[#10B981] shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                Setup Incomplete
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981]">
                  Action Needed
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Complete your business profile and review link setup to begin collecting customer testimonials.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link href="/onboarding">
              <Button size="sm" className="h-8 text-xs font-bold gap-1.5">
                Resume Guided Setup <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <button
              type="button"
              aria-label="Dismiss banner"
              onClick={() => setDismissBanner(true)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Overview Top Header */}
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
            Phase 4 Active
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link href="/testimonials" className="block">
          <Card className="hover:border-[#10B981]/40 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Testimonials
              </CardTitle>
              <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.1)] text-[#10B981]">
                <MessageSquareQuote className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.testimonialsTotal}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span className="text-[#10B981] font-medium flex items-center">
                  Live <ArrowUpRight className="w-3 h-3" />
                </span>{' '}
                Total collected
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/testimonials" className="block">
          <Card className="hover:border-amber-500/40 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pending Approvals
              </CardTitle>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                <Clock className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{metrics.pendingApprovals}</div>
              <p className="text-xs text-muted-foreground mt-1">Requires business moderation</p>
            </CardContent>
          </Card>
        </Link>

        <Card className="hover:border-[#10B981]/40 transition-all h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Average Rating
            </CardTitle>
            <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.1)] text-[#10B981]">
              <Star className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.averageRating > 0 ? `${metrics.averageRating.toFixed(1)} ★` : '0.0 ★'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Calculated from approved reviews</p>
          </CardContent>
        </Card>

        <Link href="/requests" className="block">
          <Card className="hover:border-[#10B981]/40 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                WhatsApp Requests
              </CardTitle>
              <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.1)] text-[#10B981]">
                <Send className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.requestsTotal}</div>
              <p className="text-xs text-[#10B981] font-medium mt-1">
                {metrics.deliveryRate}% Delivery Rate
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Core Workflow Overview */}
      <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-base text-foreground">
              Core Testimonial Loop Workflow
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              India-first testimonial loop: WhatsApp requests → Public feedback → Approval → Widgets
            </p>
          </div>
          <Badge variant="outline" className="text-xs text-[#10B981] border-[#10B981]/30">
            Phase 4 Active (WhatsApp Live)
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <Link href="/settings" className="block group">
            <div className="p-4 rounded-xl bg-muted/40 border border-border group-hover:border-[#10B981]/40 transition-colors h-full">
              <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider">Step 1</span>
              <h4 className="text-sm font-semibold text-foreground mt-1 group-hover:text-[#10B981] transition-colors">Business Setup</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Account created, profile initialized, server-side tenant isolation active.
              </p>
            </div>
          </Link>
          <Link href="/customers" className="block group">
            <div className="p-4 rounded-xl bg-muted/40 border border-border group-hover:border-[#10B981]/40 transition-colors h-full">
              <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider">Step 2</span>
              <h4 className="text-sm font-semibold text-foreground mt-1 group-hover:text-[#10B981] transition-colors">Customer Management</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Add customers manually or import via CSV to prepare request recipients.
              </p>
            </div>
          </Link>
          <Link href="/testimonials" className="block group">
            <div className="p-4 rounded-xl bg-muted/40 border border-border group-hover:border-[#10B981]/40 transition-colors h-full">
              <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider">Step 3</span>
              <h4 className="text-sm font-semibold text-foreground mt-1 group-hover:text-[#10B981] transition-colors">Testimonials & Review</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Public frictionless review submission, moderation approval workflow.
              </p>
            </div>
          </Link>
          <Link href="/widgets" className="block group">
            <div className="p-4 rounded-xl bg-muted/40 border border-border group-hover:border-[#10B981]/40 transition-colors h-full">
              <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider">Step 4</span>
              <h4 className="text-sm font-semibold text-foreground mt-1 group-hover:text-[#10B981] transition-colors">WhatsApp & Widgets</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Automated request delivery via WhatsApp service & embeddable website widgets.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
