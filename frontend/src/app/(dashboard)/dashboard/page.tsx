'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  AlertCircle,
  Eye,
  Users,
  BarChart3,
  RefreshCw,
  Loader2,
  ListFilter,
  CheckCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';
import { GettingStartedChecklist } from '@/components/GettingStartedChecklist';

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

interface TestimonialItem {
  id: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  rating: number;
  content: string;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_on: string;
}

interface RequestItem {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_status: string;
  testimonial_id?: string | null;
  created_on: string;
}

interface TrendPoint {
  date: string;
  created: number;
  delivered: number;
  responses: number;
}

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { business } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [partialError, setPartialError] = useState<string | null>(null);

  // Core metrics
  const [metrics, setMetrics] = useState({
    testimonialsTotal: 0,
    pendingApprovals: 0,
    approvedTestimonials: 0,
    averageRating: 5.0,
    requestsTotal: 0,
    confirmedDelivered: 0,
    deliverySuccessRate: null as number | null,
    feedbackResponses: 0,
    responseRate: null as number | null,
  });

  // Recent feeds & trend
  const [recentTestimonials, setRecentTestimonials] = useState<TestimonialItem[]>([]);
  const [pendingTestimonialsList, setPendingTestimonialsList] = useState<TestimonialItem[]>([]);
  const [recentRequests, setRecentRequests] = useState<RequestItem[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);

  // Onboarding & setup
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [dismissBanner, setDismissBanner] = useState(false);

  // Quick actions
  const [copied, setCopied] = useState(false);
  const [quickSendOpen, setQuickSendOpen] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setPartialError(null);

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [testimonialsResult, analyticsResult, requestsResult, onboardingResult] =
      await Promise.allSettled([
        apiClient.get('/testimonials', { params: { limit: 5 } }),
        apiClient.get('/requests/analytics', {
          params: {
            startDate: fourteenDaysAgo.toISOString(),
            endDate: now.toISOString(),
            channel: 'WHATSAPP',
          },
        }),
        apiClient.get('/requests', { params: { limit: 5 } }),
        apiClient.get('/business/onboarding-status'),
      ]);

    const errors: string[] = [];

    // 1. Process Testimonials response
    if (testimonialsResult.status === 'fulfilled') {
      const resData = testimonialsResult.value.data;
      const counts = resData?.counts || {};
      const items: TestimonialItem[] = resData?.data || [];

      setMetrics((prev) => ({
        ...prev,
        testimonialsTotal: counts.total ?? resData?.total ?? 0,
        pendingApprovals: counts.pending ?? 0,
        approvedTestimonials: counts.approved ?? 0,
        averageRating: counts.averageRating !== undefined ? counts.averageRating : 5.0,
      }));

      setRecentTestimonials(items);
      setPendingTestimonialsList(items.filter((t) => t.approval_status === 'PENDING'));
    } else {
      errors.push('Testimonial summary');
    }

    // 2. Process Analytics response
    if (analyticsResult.status === 'fulfilled') {
      const aData = analyticsResult.value.data;
      const summary = aData?.summary || {};

      setMetrics((prev) => ({
        ...prev,
        requestsTotal: summary.total_requests ?? 0,
        confirmedDelivered: summary.confirmed_delivered ?? 0,
        deliverySuccessRate: summary.delivery_success_rate ?? null,
        feedbackResponses: summary.feedback_responses ?? 0,
        responseRate: summary.response_rate_delivered ?? null,
      }));

      if (aData?.trend && Array.isArray(aData.trend)) {
        setTrendData(
          aData.trend.slice(-14).map((t: any) => ({
            date: t.date,
            created: t.created || 0,
            delivered: t.delivered || 0,
            responses: t.responses || 0,
          }))
        );
      }
    } else {
      errors.push('Request analytics');
    }

    // 3. Process Recent Requests response
    if (requestsResult.status === 'fulfilled') {
      setRecentRequests(requestsResult.value.data?.data || []);
    } else {
      errors.push('Recent dispatches');
    }

    // 4. Process Onboarding Status response
    if (onboardingResult.status === 'fulfilled' && onboardingResult.value.data) {
      const status: OnboardingStatus = onboardingResult.value.data;
      setOnboardingStatus(status);
      if (!status.completed && !status.dismissed) {
        setShowWelcomeModal(true);
      }
    }

    if (errors.length > 0) {
      setPartialError(
        `Unable to refresh ${errors.join(', ')}. Displaying cached data where available.`
      );
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    setMounted(true);
    loadDashboardData();
  }, [loadDashboardData]);

  const publicLink = useMemo(() => {
    if (typeof window !== 'undefined' && business?.slug) {
      return `${window.location.origin}/submit/${business.slug}`;
    }
    return 'https://zenvlo.com/submit/your-business';
  }, [business?.slug]);

  const copyPublicLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
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

  const handleQuickSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !recipientPhone.trim()) {
      setSendError('Please provide both recipient name and phone number');
      return;
    }

    setIsSending(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      await apiClient.post('/requests/send', {
        customer_name: recipientName.trim(),
        customer_phone: recipientPhone.trim(),
        custom_message: quickNote.trim() || undefined,
      });

      setSendSuccess('WhatsApp review request sent successfully!');
      setTimeout(() => {
        setQuickSendOpen(false);
        setSendSuccess(null);
        setRecipientName('');
        setRecipientPhone('');
        setQuickNote('');
        loadDashboardData(true);
      }, 1500);
    } catch (err: any) {
      setSendError(err.response?.data?.message || 'Failed to dispatch request.');
    } finally {
      setIsSending(false);
    }
  };

  if (!mounted) return null;

  const businessName = business?.name || 'Your Business';
  const isIncomplete = onboardingStatus && !onboardingStatus.completed && !dismissBanner;
  const isBrandNewAccount =
    !loading && metrics.testimonialsTotal === 0 && metrics.requestsTotal === 0;

  // Max value for mini trend chart
  const maxTrend = Math.max(1, ...trendData.map((d) => Math.max(d.created, d.delivered, d.responses)));

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Welcome Modal for newly activated users */}
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
                Zenvlo Engage turns everyday customer conversations into high-converting website social proof. In 2 minutes, configure your profile and start collecting verified testimonials.
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

        {/* Setup Incomplete Recovery Banner */}
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

        {/* Partial API Error Notice */}
        {partialError && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-500">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{partialError}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDashboardData(true)}
              className="h-7 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Overview Header & Operational Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#10B981] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Reputational Hub
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {businessName} Dashboard
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Real-time testimonial pipeline, verified delivery analytics, and pending actions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              size="sm"
              variant="outline"
              onClick={copyPublicLink}
              className="gap-1.5 text-xs h-9"
              title="Copy your public testimonial collection link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#10B981]" /> Copied Review Link
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Review Link
                </>
              )}
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setRecipientName('');
                setRecipientPhone('');
                setQuickNote('');
                setSendSuccess(null);
                setSendError(null);
                setQuickSendOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold h-9"
            >
              <Send className="w-3.5 h-3.5" /> Send WhatsApp Request
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDashboardData(true)}
              disabled={refreshing}
              className="h-9 px-2.5 text-muted-foreground"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Urgent Action Banner: Pending Testimonial Moderation */}
        {metrics.pendingApprovals > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500 shrink-0 mt-0.5">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">
                    {metrics.pendingApprovals}{' '}
                    {metrics.pendingApprovals === 1 ? 'Testimonial Requires' : 'Testimonials Require'}{' '}
                    Moderation
                  </h3>
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 text-[10px]">
                    Action Needed
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  New customer submissions are withheld from public website widgets until approved by your business.
                </p>
                {pendingTestimonialsList.length > 0 && (
                  <div className="text-[11px] text-muted-foreground font-mono mt-1">
                    Latest submission from <strong className="text-foreground">{pendingTestimonialsList[0].customer_name}</strong> (
                    {pendingTestimonialsList[0].rating} ★)
                  </div>
                )}
              </div>
            </div>

            <Link href="/testimonials?status=PENDING">
              <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-400 font-bold text-xs gap-1.5 shrink-0">
                Review & Moderate ({metrics.pendingApprovals}) <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        )}

        {/* Core KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Testimonials */}
          <Link href="/testimonials" className="block group">
            <Card className="hover:border-[#10B981]/50 transition-all cursor-pointer h-full border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Total Testimonials
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer text-muted-foreground/60 hover:text-foreground">
                        <AlertCircle className="w-3 h-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-semibold">Total Testimonials</p>
                      <p className="text-[11px] text-muted-foreground">
                        All feedback received via public form or WhatsApp requests.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.12)] text-[#10B981] group-hover:bg-[#10B981]/20 transition-colors">
                  <MessageSquareQuote className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? <span className="animate-pulse">--</span> : metrics.testimonialsTotal}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className="text-[#10B981] font-medium">{metrics.approvedTestimonials} live</span>
                  <span>•</span>
                  <span className={metrics.pendingApprovals > 0 ? 'text-amber-400 font-semibold' : ''}>
                    {metrics.pendingApprovals} pending
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 2: Average Rating */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-1.5">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Average Rating
                </CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-pointer text-muted-foreground/60 hover:text-foreground">
                      <AlertCircle className="w-3 h-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs font-semibold">Average Rating</p>
                    <p className="text-[11px] text-muted-foreground">
                      Computed from approved testimonials currently eligible for public display.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Star className="w-4 h-4 fill-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {loading ? (
                  <span className="animate-pulse">--</span>
                ) : metrics.testimonialsTotal > 0 ? (
                  `${metrics.averageRating.toFixed(1)} ★`
                ) : (
                  'N/A'
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.approvedTestimonials > 0
                  ? `Across ${metrics.approvedTestimonials} approved reviews`
                  : 'Awaiting first approved review'}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: WhatsApp Delivery Rate */}
          <Link href="/requests" className="block group">
            <Card className="hover:border-blue-500/40 transition-all cursor-pointer h-full border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    WhatsApp Delivery
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer text-muted-foreground/60 hover:text-foreground">
                        <AlertCircle className="w-3 h-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs font-semibold">Verified WhatsApp Delivery Rate</p>
                      <p className="text-[11px] text-muted-foreground">
                        Formula: (Delivered + Read) / (Delivered + Read + Failed) * 100.
                        Calculated strictly from terminal webhook receipts.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                  <Send className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">
                  {loading ? (
                    <span className="animate-pulse">--</span>
                  ) : metrics.deliverySuccessRate !== null ? (
                    `${metrics.deliverySuccessRate}%`
                  ) : metrics.confirmedDelivered > 0 ? (
                    '100%'
                  ) : (
                    'N/A'
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.confirmedDelivered} confirmed delivered ({metrics.requestsTotal} sent)
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Card 4: Feedback Conversion Rate */}
          <Link href="/requests" className="block group">
            <Card className="hover:border-[#10B981]/50 transition-all cursor-pointer h-full border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Response Conversion
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer text-muted-foreground/60 hover:text-foreground">
                        <AlertCircle className="w-3 h-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs font-semibold">Response Conversion Rate</p>
                      <p className="text-[11px] text-muted-foreground">
                        Ratio of customer testimonials submitted to delivered review requests.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.12)] text-[#10B981] group-hover:bg-[#10B981]/20 transition-colors">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? (
                    <span className="animate-pulse">--</span>
                  ) : metrics.responseRate !== null ? (
                    `${metrics.responseRate}%`
                  ) : metrics.feedbackResponses > 0 ? (
                    'Active'
                  ) : (
                    'N/A'
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.feedbackResponses} reviews submitted from requests
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Getting Started Interactive Checklist */}
        <GettingStartedChecklist />

        {/* 14-Day Activity & Delivery Trends Mini-Chart */}
        {trendData.length > 0 && (
          <Card className="border-border">
            <CardHeader className="py-3 px-4 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-[#10B981]" /> 14-Day WhatsApp Activity Trend
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Daily distribution of requests dispatched, delivered, and reviews collected
                </CardDescription>
              </div>

              <Link
                href="/requests"
                className="text-xs text-[#10B981] hover:underline flex items-center gap-1 font-semibold"
              >
                View Full Analytics <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>

            <CardContent className="p-4">
              <div className="h-32 flex items-end gap-2 pt-2 pb-1 overflow-x-auto">
                {trendData.map((d) => {
                  const createdHeight = (d.created / maxTrend) * 90;
                  const deliveredHeight = (d.delivered / maxTrend) * 90;

                  return (
                    <div
                      key={d.date}
                      className="flex-1 min-w-[28px] flex flex-col items-center gap-1.5 group cursor-pointer"
                      title={`${d.date}: ${d.created} sent, ${d.delivered} delivered, ${d.responses} reviews`}
                    >
                      <div className="w-full flex items-end justify-center gap-0.5 h-24">
                        <div
                          style={{ height: `${Math.max(4, createdHeight)}px` }}
                          className="w-2 rounded-t bg-blue-500/40 group-hover:bg-blue-500/70 transition-colors"
                        />
                        <div
                          style={{ height: `${Math.max(4, deliveredHeight)}px` }}
                          className="w-2 rounded-t bg-[#10B981] group-hover:bg-emerald-400 transition-colors"
                        />
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground group-hover:text-foreground">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-6 text-[11px] text-muted-foreground pt-2 border-t border-border mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-blue-500/40" />
                  <span>Requests Initiated</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#10B981]" />
                  <span>Confirmed Delivered</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dual Activity Feed: Recent Testimonials & Recent Requests */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Recent Testimonials */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-3 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <MessageSquareQuote className="w-4 h-4 text-[#10B981]" /> Recent Testimonials
                </CardTitle>
                <CardDescription className="text-xs">
                  Latest customer submissions across public channels
                </CardDescription>
              </div>

              <Link
                href="/testimonials"
                className="text-xs text-[#10B981] hover:underline flex items-center gap-1 font-semibold"
              >
                View All ({metrics.testimonialsTotal}) <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#10B981]" />
                </div>
              ) : recentTestimonials.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center mx-auto text-muted-foreground">
                    <MessageSquareQuote className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-foreground">No Testimonials Received Yet</h4>
                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                      Share your public review link or dispatch WhatsApp requests to start collecting customer social proof.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={copyPublicLink} className="text-xs gap-1.5 h-8">
                    <Copy className="w-3 h-3" /> Copy Review Link
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentTestimonials.map((t) => (
                    <div key={t.id} className="p-4 hover:bg-muted/20 transition-colors flex items-start justify-between gap-3">
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground truncate">{t.customer_name}</span>
                          <div className="flex items-center text-amber-400 text-xs">
                            {Array.from({ length: t.rating }).map((_, i) => (
                              <Star key={i} className="w-3 h-3 fill-amber-400" />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          &quot;{t.content}&quot;
                        </p>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(t.created_on).toLocaleDateString()}
                        </span>
                      </div>

                      <Badge
                        variant="secondary"
                        className={`text-[10px] shrink-0 font-medium ${
                          t.approval_status === 'APPROVED'
                            ? 'bg-green-500/10 text-green-500 border-green-500/30'
                            : t.approval_status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 font-semibold'
                            : 'bg-red-500/10 text-red-500 border-red-500/30'
                        }`}
                      >
                        {t.approval_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Column 2: Recent WhatsApp Request Dispatches */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-3 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#10B981]" /> Recent Request Dispatches
                </CardTitle>
                <CardDescription className="text-xs">
                  Latest personalized WhatsApp invites sent to customers
                </CardDescription>
              </div>

              <Link
                href="/requests"
                className="text-xs text-[#10B981] hover:underline flex items-center gap-1 font-semibold"
              >
                View All ({metrics.requestsTotal}) <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#10B981]" />
                </div>
              ) : recentRequests.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center mx-auto text-muted-foreground">
                    <Send className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-foreground">No WhatsApp Requests Dispatched</h4>
                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                      Send personalized testimonial invitations directly to your customer contact list via WhatsApp.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setRecipientName('');
                      setRecipientPhone('');
                      setQuickNote('');
                      setQuickSendOpen(true);
                    }}
                    className="text-xs gap-1.5 h-8 font-semibold"
                  >
                    <Send className="w-3 h-3" /> Send First Request
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentRequests.map((r) => {
                    const isDelivered = r.delivery_status === 'DELIVERED' || r.delivery_status === 'READ';
                    const isFailed = r.delivery_status === 'FAILED';

                    return (
                      <div key={r.id} className="p-4 hover:bg-muted/20 transition-colors flex items-center justify-between gap-3">
                        <div className="space-y-0.5 truncate">
                          <div className="text-xs font-bold text-foreground truncate">{r.customer_name}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {r.customer_phone}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {new Date(r.created_on).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              isDelivered
                                ? 'bg-green-500/10 text-green-500 border-green-500/30'
                                : isFailed
                                ? 'bg-red-500/10 text-red-500 border-red-500/30'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                            }`}
                          >
                            {r.delivery_status}
                          </Badge>

                          {r.testimonial_id ? (
                            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-emerald-400" /> Review Submitted
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/70">
                              Awaiting response
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Send Dialog from Dashboard */}
        <Dialog open={quickSendOpen} onOpenChange={setQuickSendOpen}>
          <DialogContent className="max-w-md">
            <form onSubmit={handleQuickSend}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#10B981]" /> Send WhatsApp Review Request
                </DialogTitle>
                <DialogDescription>
                  Send an official WhatsApp testimonial invitation directly with your review link.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {sendError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{sendError}</span>
                  </div>
                )}

                {sendSuccess && (
                  <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{sendSuccess}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Recipient Name *</label>
                  <Input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">WhatsApp Phone *</label>
                  <Input
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Personalized Note (Optional)</label>
                  <Textarea
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    placeholder="e.g. Thank you for visiting us yesterday! We'd love your feedback."
                    className="h-20 text-xs"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setQuickSendOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSending} className="font-semibold gap-1.5">
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Dispatching...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Dispatch via WhatsApp
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
