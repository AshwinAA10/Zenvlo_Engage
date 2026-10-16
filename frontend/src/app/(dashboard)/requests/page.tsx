'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';
import {
  Send,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Star,
  Copy,
  ExternalLink,
  Loader2,
  Search,
  RefreshCw,
  MessageSquare,
  Sparkles,
  Check,
  TrendingUp,
  TrendingDown,
  Info,
  Calendar,
  BarChart3,
  ListFilter,
  Eye,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface RequestLog {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  channel: string;
  template_name: string;
  testimonial_url: string;
  custom_message: string | null;
  delivery_status: 'QUEUED' | 'PROCESSING' | 'SUBMITTED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'AMBIGUOUS' | 'PENDING_CONTRACT';
  message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  testimonial_id: string | null;
  response_received_at: string | null;
  created_on: string;
}

interface RequestAnalyticsSummary {
  total_requests: number;
  confirmed_delivered: number;
  confirmed_read: number;
  confirmed_failed: number;
  pending_confirmation: number;
  feedback_responses: number;
  delivery_success_rate: number | null;
  overall_delivery_rate: number;
  response_rate_delivered: number | null;
  response_rate_total: number;
}

interface RequestAnalyticsComparison {
  prev_total_requests: number;
  prev_confirmed_delivered: number;
  prev_feedback_responses: number;
  total_requests_change_pct: number | null;
  delivered_change_pct: number | null;
  responses_change_pct: number | null;
}

interface DeliveryBreakdownItem {
  status: string;
  count: number;
  percentage: number;
  is_terminal: boolean;
}

interface RequestTrendPoint {
  date: string;
  created: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  responses: number;
}

interface RequestAnalyticsResponse {
  period: {
    startDate: string;
    endDate: string;
    prevStartDate: string;
    prevEndDate: string;
    days: number;
  };
  summary: RequestAnalyticsSummary;
  comparison: RequestAnalyticsComparison;
  delivery_breakdown: DeliveryBreakdownItem[];
  trend: RequestTrendPoint[];
  meta: {
    channel: string;
    unknown_outcomes_count: number;
    semantics: Record<string, string>;
  };
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  last_request_sent_at?: string | null;
  request_count?: number;
}

type PeriodPreset = '7D' | '30D' | '90D' | 'CUSTOM';

export default function RequestsPage() {
  const { business } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'dispatches'>('analytics');

  // Analytics state
  const [analytics, setAnalytics] = useState<RequestAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30D');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [chartViewMode, setChartViewMode] = useState<'chart' | 'table'>('chart');
  const [hoveredPoint, setHoveredPoint] = useState<RequestTrendPoint | null>(null);

  // Dispatches log state
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 25;

  // Customers for modal selection
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  // Single Send Modal
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState<string | null>(null);
  const [sendErrorMsg, setSendErrorMsg] = useState<string | null>(null);

  // Batch Send Modal
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchNote, setBatchNote] = useState('');
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [batchResult, setBatchResult] = useState<{ queued: number; total: number } | null>(null);

  // Link copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Date range resolver
  const { startDateISO, endDateISO } = useMemo(() => {
    const end = new Date();
    let start = new Date();

    if (periodPreset === '7D') {
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (periodPreset === '30D') {
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (periodPreset === '90D') {
      start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (periodPreset === 'CUSTOM' && customStartDate && customEndDate) {
      return {
        startDateISO: new Date(customStartDate).toISOString(),
        endDateISO: new Date(customEndDate).toISOString(),
      };
    } else {
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return {
      startDateISO: start.toISOString(),
      endDateISO: end.toISOString(),
    };
  }, [periodPreset, customStartDate, customEndDate]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      const res = await apiClient.get('/requests/analytics', {
        params: {
          startDate: startDateISO,
          endDate: endDateISO,
          channel: 'WHATSAPP',
        },
      });
      setAnalytics(res.data);
    } catch (err: any) {
      console.error('Failed to load request analytics', err);
      setAnalyticsError(
        err.response?.data?.message || 'Failed to load verified request analytics. Please retry.'
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }, [startDateISO, endDateISO]);

  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const deliveryStatusParam =
        statusFilter === 'ALL' || statusFilter === 'FEEDBACK_RECEIVED'
          ? undefined
          : statusFilter;

      const res = await apiClient.get('/requests', {
        params: {
          search: search.trim() || undefined,
          delivery_status: deliveryStatusParam,
          page,
          limit,
        },
      });

      let loadedLogs = res.data.data || [];
      if (statusFilter === 'FEEDBACK_RECEIVED') {
        loadedLogs = loadedLogs.filter((l: RequestLog) => !!l.testimonial_id);
      }
      setLogs(loadedLogs);
      setLogsTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load request logs', err);
    } finally {
      setLogsLoading(false);
    }
  }, [search, statusFilter, page]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await apiClient.get('/customers', { params: { limit: 100 } });
      setCustomers(res.data.data || []);
    } catch (err) {
      console.error('Failed to load customers', err);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (mounted) {
      fetchAnalytics();
    }
  }, [mounted, fetchAnalytics]);

  useEffect(() => {
    if (mounted) {
      fetchLogs();
    }
  }, [mounted, fetchLogs]);

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSendSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setSendSuccessMsg(null);
    setSendErrorMsg(null);

    try {
      const payload: any = {
        custom_message: customNote.trim() || undefined,
      };

      if (selectedCustomerId) {
        payload.customer_id = selectedCustomerId;
      } else {
        if (!manualName.trim() || !manualPhone.trim()) {
          setSendErrorMsg('Please select a contact or enter name and WhatsApp phone number');
          setIsSending(false);
          return;
        }
        payload.customer_name = manualName.trim();
        payload.customer_phone = manualPhone.trim();
      }

      await apiClient.post('/requests/send', payload);
      setSendSuccessMsg('WhatsApp testimonial request dispatched successfully!');
      setTimeout(() => {
        setIsSendOpen(false);
        setSendSuccessMsg(null);
        setSelectedCustomerId('');
        setManualName('');
        setManualPhone('');
        setCustomNote('');
        fetchAnalytics();
        fetchLogs();
      }, 1500);
    } catch (err: any) {
      setSendErrorMsg(err.response?.data?.message || 'Failed to dispatch request.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendBatch = async () => {
    if (customers.length === 0) return;
    setIsBatchSending(true);

    try {
      const ids = customers.map((c) => c.id);
      const res = await apiClient.post('/requests/batch', {
        customer_ids: ids,
        custom_message: batchNote.trim() || undefined,
      });

      setBatchResult({ queued: res.data.queued, total: res.data.total });
      setTimeout(() => {
        setIsBatchOpen(false);
        setBatchResult(null);
        setBatchNote('');
        fetchAnalytics();
        fetchLogs();
      }, 2000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to dispatch batch requests.');
    } finally {
      setIsBatchSending(false);
    }
  };

  const jumpToFilterInDispatches = (status: string) => {
    setStatusFilter(status);
    setActiveTab('dispatches');
  };

  if (!mounted) return null;

  const publicUrl = business?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/submit/${business.slug}`
    : 'https://app.zenvlo.com/submit/your-business';

  // SVG Trend Chart Dimensions & Math
  const trendData = analytics?.trend || [];
  const maxTrendCount = Math.max(1, ...trendData.map((d) => Math.max(d.created, d.delivered, d.responses)));
  const chartHeight = 180;
  const chartWidth = Math.max(500, trendData.length * 36);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header and Primary Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                <Send className="w-4 h-4" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                WhatsApp Requests & Analytics
              </h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Monitor verified WhatsApp delivery receipts, response conversions, and recipient activity with auditable data
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBatchOpen(true)}
              className="gap-1.5 text-xs h-9"
              disabled={customers.length === 0}
            >
              <Users className="w-3.5 h-3.5 text-[#10B981]" /> Batch Send ({customers.length})
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedCustomerId('');
                setManualName('');
                setManualPhone('');
                setCustomNote('');
                setSendSuccessMsg(null);
                setSendErrorMsg(null);
                setIsSendOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold h-9"
            >
              <Send className="w-3.5 h-3.5" /> Send Request
            </Button>
          </div>
        </div>

        {/* Tab Switcher: Analytics vs Dispatches */}
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[#10B981]/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Performance & Analytics
            </button>
            <button
              onClick={() => setActiveTab('dispatches')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'dispatches'
                  ? 'bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[#10B981]/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" /> Dispatches & History
              {logsTotal > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] text-muted-foreground font-mono">
                  {logsTotal}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'analytics' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-card border border-border rounded-lg p-0.5">
                {(['7D', '30D', '90D', 'CUSTOM'] as PeriodPreset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodPreset(p)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                      periodPreset === p
                        ? 'bg-[#10B981] text-black font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p === '7D' ? '7 Days' : p === '30D' ? '30 Days' : p === '90D' ? '90 Days' : 'Custom'}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnalytics}
                className="h-8 px-2.5 text-xs text-muted-foreground"
                title="Refresh Analytics"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: ANALYTICS & PERFORMANCE                                            */}
        {/* ========================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Custom Date Picker Bar */}
            {periodPreset === 'CUSTOM' && (
              <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center gap-3 text-xs">
                <Calendar className="w-4 h-4 text-[#10B981]" />
                <span className="font-semibold text-foreground">Select Custom Window:</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                  <Button
                    size="sm"
                    onClick={fetchAnalytics}
                    disabled={!customStartDate || !customEndDate}
                    className="h-8 text-xs"
                  >
                    Apply Window
                  </Button>
                </div>
              </div>
            )}

            {/* Error Banner with Retry */}
            {analyticsError && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between text-xs text-red-500">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{analyticsError}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchAnalytics}
                  className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/20"
                >
                  Retry Request
                </Button>
              </div>
            )}

            {/* Transparent Data Quality & Semantics Banner */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
                <span className="text-muted-foreground">
                  Metrics verified against definitive provider webhook receipts for{' '}
                  <strong className="text-foreground">
                    {analytics?.period?.days || 30} days
                  </strong>{' '}
                  cohort ({analytics?.period?.startDate?.slice(0, 10)} to {analytics?.period?.endDate?.slice(0, 10)}).
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground/80 font-mono">
                {analytics?.meta?.unknown_outcomes_count || 0} in-flight dispatches awaiting provider receipt
              </div>
            </div>

            {/* KPI Cards Grid */}
            {analyticsLoading && !analytics ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="border-border animate-pulse p-4 h-28 bg-muted/30" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Requests Created */}
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span>Total Requests Created</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground/70 cursor-pointer hover:text-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-semibold text-foreground">Total Requests Created</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              All testimonial requests initiated and persisted within the selected cohort period. Deduplicated by unique request ID.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
                        <Send className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between">
                      <h3 className="text-2xl font-bold text-foreground">
                        {analytics?.summary?.total_requests || 0}
                      </h3>
                      {analytics?.comparison?.total_requests_change_pct !== null && (
                        <div
                          className={`flex items-center gap-1 text-[11px] font-semibold ${
                            (analytics?.comparison?.total_requests_change_pct ?? 0) >= 0
                              ? 'text-[#10B981]'
                              : 'text-amber-400'
                          }`}
                        >
                          {(analytics?.comparison?.total_requests_change_pct ?? 0) >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          <span>
                            {(analytics?.comparison?.total_requests_change_pct ?? 0) > 0 ? '+' : ''}
                            {analytics?.comparison?.total_requests_change_pct}%
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      vs {analytics?.comparison?.prev_total_requests || 0} in previous period
                    </p>
                  </CardContent>
                </Card>

                {/* 2. Delivery Success Rate */}
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span>Delivery Success Rate</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground/70 cursor-pointer hover:text-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-semibold text-foreground">Delivery Success Rate (Known Outcomes)</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Numerator: Verified Delivered + Read receipts.
                              <br />
                              Denominator: Total requests with confirmed terminal outcomes (Delivered + Read + Failed).
                              <br />
                              In-flight and queued requests are not treated as delivered or failed.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-green-500/15 text-green-400 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between">
                      <h3 className="text-2xl font-bold text-green-400">
                        {analytics?.summary?.delivery_success_rate !== null
                          ? `${analytics?.summary?.delivery_success_rate}%`
                          : 'N/A'}
                      </h3>
                      {analytics?.comparison?.delivered_change_pct !== null && (
                        <div
                          className={`flex items-center gap-1 text-[11px] font-semibold ${
                            (analytics?.comparison?.delivered_change_pct ?? 0) >= 0
                              ? 'text-[#10B981]'
                              : 'text-red-400'
                          }`}
                        >
                          {(analytics?.comparison?.delivered_change_pct ?? 0) >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          <span>
                            {(analytics?.comparison?.delivered_change_pct ?? 0) > 0 ? '+' : ''}
                            {analytics?.comparison?.delivered_change_pct}%
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {analytics?.summary?.confirmed_delivered || 0} delivered of{' '}
                      {(analytics?.summary?.confirmed_delivered || 0) +
                        (analytics?.summary?.confirmed_failed || 0)}{' '}
                      terminal outcomes
                    </p>
                  </CardContent>
                </Card>

                {/* 3. Read Engagement Rate */}
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span>Read Engagement Rate</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground/70 cursor-pointer hover:text-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-semibold text-foreground">Read Engagement Rate</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Percentage of confirmed delivered messages where the recipient opened and read the WhatsApp request (blue ticks confirmation).
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                        <Eye className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between">
                      <h3 className="text-2xl font-bold text-blue-400">
                        {(analytics?.summary?.confirmed_delivered || 0) > 0
                          ? `${Math.round(
                              ((analytics?.summary?.confirmed_read || 0) /
                                (analytics?.summary?.confirmed_delivered || 1)) *
                                100
                            )}%`
                          : 'N/A'}
                      </h3>
                      <span className="text-[11px] text-muted-foreground">
                        {analytics?.summary?.confirmed_read || 0} read
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      of {analytics?.summary?.confirmed_delivered || 0} verified delivered messages
                    </p>
                  </CardContent>
                </Card>

                {/* 4. Feedback Response Conversion */}
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span>Feedback Response Rate</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground/70 cursor-pointer hover:text-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-semibold text-foreground">Response Conversion Rate</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Numerator: Testimonials submitted and linked to request.
                              <br />
                              Denominator: Delivered requests ({analytics?.summary?.confirmed_delivered || 0}).
                              <br />
                              Also represents {analytics?.summary?.response_rate_total || 0}% of all requests created.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                      </div>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between">
                      <h3 className="text-2xl font-bold text-amber-400">
                        {analytics?.summary?.response_rate_delivered !== null
                          ? `${analytics?.summary?.response_rate_delivered}%`
                          : 'N/A'}
                      </h3>
                      {analytics?.comparison?.responses_change_pct !== null && (
                        <div
                          className={`flex items-center gap-1 text-[11px] font-semibold ${
                            (analytics?.comparison?.responses_change_pct ?? 0) >= 0
                              ? 'text-[#10B981]'
                              : 'text-amber-400'
                          }`}
                        >
                          {(analytics?.comparison?.responses_change_pct ?? 0) >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          <span>
                            {(analytics?.comparison?.responses_change_pct ?? 0) > 0 ? '+' : ''}
                            {analytics?.comparison?.responses_change_pct}%
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {analytics?.summary?.feedback_responses || 0} customer reviews received
                    </p>
                  </CardContent>
                </Card>

                {/* 5. Pending / In-Flight Confirmations */}
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span>Pending Webhook Confirmation</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground/70 cursor-pointer hover:text-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-semibold text-foreground">Pending / In-Flight Dispatches</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Requests queued or dispatched to network where definitive provider delivery status has not yet arrived.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-yellow-500/15 text-yellow-400 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between">
                      <h3 className="text-2xl font-bold text-yellow-400">
                        {analytics?.summary?.pending_confirmation || 0}
                      </h3>
                      <button
                        onClick={() => jumpToFilterInDispatches('PENDING_CONTRACT')}
                        className="text-[11px] text-[#10B981] hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        Inspect <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Awaiting delivery receipts from WhatsApp provider
                    </p>
                  </CardContent>
                </Card>

                {/* 6. Confirmed Delivery Failures */}
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span>Confirmed Failures</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground/70 cursor-pointer hover:text-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-semibold text-foreground">Confirmed Delivery Failures</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Requests explicitly reported as failed by provider (e.g. invalid phone number, rate limit, blocked).
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center">
                        <AlertCircle className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="mt-2 flex items-baseline justify-between">
                      <h3 className="text-2xl font-bold text-red-400">
                        {analytics?.summary?.confirmed_failed || 0}
                      </h3>
                      <button
                        onClick={() => jumpToFilterInDispatches('FAILED')}
                        className="text-[11px] text-red-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        View Failed <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Confirmed bounced or undeliverable numbers
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Delivery Outcome Breakdown Bar */}
            <Card className="border-border">
              <CardHeader className="py-3 px-4 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Delivery Outcome Breakdown
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Proportion of terminal delivery events vs in-flight dispatches
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {analytics?.summary?.total_requests === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    No requests dispatched during this period cohort.
                  </p>
                ) : (
                  <>
                    <div className="w-full h-4 rounded-full bg-muted overflow-hidden flex">
                      {/* Delivered / Read */}
                      <div
                        style={{
                          width: `${
                            ((analytics?.summary?.confirmed_delivered || 0) /
                              (analytics?.summary?.total_requests || 1)) *
                            100
                          }%`,
                        }}
                        className="bg-[#10B981] h-full"
                        title={`Delivered: ${analytics?.summary?.confirmed_delivered || 0}`}
                      />
                      {/* Pending / In-flight */}
                      <div
                        style={{
                          width: `${
                            ((analytics?.summary?.pending_confirmation || 0) /
                              (analytics?.summary?.total_requests || 1)) *
                            100
                          }%`,
                        }}
                        className="bg-yellow-500/80 h-full"
                        title={`Pending: ${analytics?.summary?.pending_confirmation || 0}`}
                      />
                      {/* Failed */}
                      <div
                        style={{
                          width: `${
                            ((analytics?.summary?.confirmed_failed || 0) /
                              (analytics?.summary?.total_requests || 1)) *
                            100
                          }%`,
                        }}
                        className="bg-red-500 h-full"
                        title={`Failed: ${analytics?.summary?.confirmed_failed || 0}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                        <span className="text-muted-foreground">Delivered:</span>
                        <span className="font-semibold text-foreground">
                          {analytics?.summary?.confirmed_delivered || 0} (
                          {analytics?.summary?.overall_delivery_rate || 0}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                        <span className="text-muted-foreground">Read:</span>
                        <span className="font-semibold text-foreground">
                          {analytics?.summary?.confirmed_read || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <span className="text-muted-foreground">Pending:</span>
                        <span className="font-semibold text-foreground">
                          {analytics?.summary?.pending_confirmation || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <span className="text-muted-foreground">Failed:</span>
                        <span className="font-semibold text-foreground">
                          {analytics?.summary?.confirmed_failed || 0}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Request Activity Trend Chart Card */}
            <Card className="border-border">
              <CardHeader className="py-3 px-4 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-[#10B981]" /> Request Activity & Delivery Trends
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Daily progression of requests initiated, delivered, and reviews collected
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-card border border-border rounded-lg p-0.5 text-xs">
                    <button
                      onClick={() => setChartViewMode('chart')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                        chartViewMode === 'chart'
                          ? 'bg-[#10B981] text-black font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Chart
                    </button>
                    <button
                      onClick={() => setChartViewMode('table')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                        chartViewMode === 'table'
                          ? 'bg-[#10B981] text-black font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Table View
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4">
                {analyticsLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[#10B981]" />
                  </div>
                ) : trendData.length === 0 ? (
                  <div className="text-center py-12 text-xs text-muted-foreground">
                    No activity recorded in this period window.
                  </div>
                ) : chartViewMode === 'chart' ? (
                  <div className="space-y-4">
                    {/* Responsive SVG Chart */}
                    <div className="overflow-x-auto pb-2">
                      <div className="min-w-[600px] h-[220px] relative">
                        <svg
                          viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
                          className="w-full h-full overflow-visible"
                        >
                          {/* Grid horizontal lines */}
                          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                            const y = chartHeight - pct * chartHeight + 10;
                            return (
                              <g key={idx}>
                                <line
                                  x1="0"
                                  y1={y}
                                  x2={chartWidth}
                                  y2={y}
                                  stroke="currentColor"
                                  className="text-border/40"
                                  strokeDasharray="3 3"
                                />
                                <text
                                  x="2"
                                  y={y - 4}
                                  className="text-[9px] fill-muted-foreground font-mono"
                                >
                                  {Math.round(pct * maxTrendCount)}
                                </text>
                              </g>
                            );
                          })}

                          {/* Bars and Data Points */}
                          {trendData.map((d, idx) => {
                            const colWidth = chartWidth / trendData.length;
                            const x = idx * colWidth + colWidth / 2;
                            const createdHeight = (d.created / maxTrendCount) * chartHeight;
                            const deliveredHeight = (d.delivered / maxTrendCount) * chartHeight;
                            const responsesHeight = (d.responses / maxTrendCount) * chartHeight;

                            const barWidth = Math.max(6, Math.min(18, colWidth * 0.45));

                            return (
                              <g
                                key={d.date}
                                className="cursor-pointer group"
                                onMouseEnter={() => setHoveredPoint(d)}
                              >
                                {/* Invisible hover zone */}
                                <rect
                                  x={idx * colWidth}
                                  y={10}
                                  width={colWidth}
                                  height={chartHeight}
                                  fill="transparent"
                                />

                                {/* Created bar (background bar) */}
                                <rect
                                  x={x - barWidth / 2}
                                  y={chartHeight - createdHeight + 10}
                                  width={barWidth}
                                  height={Math.max(2, createdHeight)}
                                  rx={2}
                                  className="fill-blue-500/30 group-hover:fill-blue-500/50 transition-colors"
                                />

                                {/* Delivered bar (solid bar) */}
                                <rect
                                  x={x - barWidth / 2}
                                  y={chartHeight - deliveredHeight + 10}
                                  width={barWidth}
                                  height={Math.max(2, deliveredHeight)}
                                  rx={2}
                                  className="fill-[#10B981] group-hover:fill-emerald-400 transition-colors"
                                />

                                {/* Response marker (dot) */}
                                {d.responses > 0 && (
                                  <circle
                                    cx={x}
                                    cy={chartHeight - responsesHeight + 10}
                                    r={4}
                                    className="fill-amber-400 stroke-background stroke-2"
                                  />
                                )}

                                {/* X-axis Date label (show every Nth label to prevent clutter) */}
                                {(idx % Math.ceil(trendData.length / 10) === 0 || idx === trendData.length - 1) && (
                                  <text
                                    x={x}
                                    y={chartHeight + 28}
                                    textAnchor="middle"
                                    className="text-[10px] fill-muted-foreground font-mono"
                                  >
                                    {d.date.slice(5)}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>

                    {/* Active Point Hover Callout */}
                    {hoveredPoint ? (
                      <div className="p-2.5 rounded-xl bg-card border border-[#10B981]/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-[#10B981]" />
                          <strong className="text-foreground">{hoveredPoint.date}</strong>
                        </div>
                        <div className="flex items-center gap-4 text-[11px]">
                          <span>
                            Created: <strong>{hoveredPoint.created}</strong>
                          </span>
                          <span className="text-[#10B981]">
                            Delivered: <strong>{hoveredPoint.delivered}</strong>
                          </span>
                          <span className="text-blue-400">
                            Read: <strong>{hoveredPoint.read}</strong>
                          </span>
                          <span className="text-amber-400">
                            Reviews: <strong>{hoveredPoint.responses}</strong>
                          </span>
                          <span className="text-red-400">
                            Failed: <strong>{hoveredPoint.failed}</strong>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-6 text-[11px] text-muted-foreground pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500/50" />
                          <span>Requests Dispatched</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-[#10B981]" />
                          <span>Confirmed Delivered</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span>Customer Review Received</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Accessible Table View */
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Dispatched</th>
                          <th className="py-2 px-3">Delivered</th>
                          <th className="py-2 px-3">Read</th>
                          <th className="py-2 px-3">Reviews</th>
                          <th className="py-2 px-3">Failed</th>
                          <th className="py-2 px-3">Pending</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {trendData.map((d) => (
                          <tr key={d.date} className="hover:bg-muted/20">
                            <td className="py-2 px-3 font-mono text-foreground font-semibold">{d.date}</td>
                            <td className="py-2 px-3">{d.created}</td>
                            <td className="py-2 px-3 text-[#10B981] font-semibold">{d.delivered}</td>
                            <td className="py-2 px-3 text-blue-400">{d.read}</td>
                            <td className="py-2 px-3 text-amber-400 font-semibold">{d.responses}</td>
                            <td className="py-2 px-3 text-red-400">{d.failed}</td>
                            <td className="py-2 px-3 text-yellow-400">{d.pending}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DISPATCHES & LOGS                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'dispatches' && (
          <div className="space-y-6">
            {/* WhatsApp Message Template Preview Card */}
            <Card className="border-border overflow-hidden">
              <CardHeader className="py-3 px-4 border-b border-border bg-muted/30">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#10B981]" /> WhatsApp Message Template Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="max-w-2xl bg-[#0b141a] dark:bg-[#111b21] p-4 rounded-2xl border border-border/80 shadow-md text-foreground">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10 text-xs text-muted-foreground">
                    <span className="font-semibold text-emerald-400">
                      {business?.name || 'Your Business'}
                    </span>
                    <span>•</span>
                    <span className="text-[11px]">Official WhatsApp Testimonial Notification</span>
                  </div>
                  <p className="text-xs leading-relaxed text-gray-200">
                    Hi <span className="font-semibold text-emerald-300">Rahul Sharma</span>, thank you for choosing{' '}
                    <span className="font-semibold text-white">{business?.name || 'Zenvlo Engage'}</span>!
                    We’d love to hear about your experience.
                  </p>
                  <p className="text-xs mt-2 text-gray-200">
                    Please take 30 seconds to share your review and photo:
                  </p>
                  <div className="mt-2.5 p-2 rounded-xl bg-[#202c33] border border-[#2a3942] flex items-center justify-between text-xs font-mono text-[#53bdeb]">
                    <span className="truncate">{publicUrl}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 ml-2 text-muted-foreground" />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2 text-right">
                    Just now • Delivered via WhatsApp
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Requests Table Card */}
            <Card className="border-border">
              <CardHeader className="p-4 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'ALL', label: 'All Requests' },
                    { id: 'DELIVERED', label: 'Delivered' },
                    { id: 'READ', label: 'Read' },
                    { id: 'PENDING_CONTRACT', label: 'Queued (Integration)' },
                    { id: 'FEEDBACK_RECEIVED', label: 'Feedback Submitted' },
                    { id: 'FAILED', label: 'Failed' },
                  ].map((tab) => (
                    <Button
                      key={tab.id}
                      variant={statusFilter === tab.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setStatusFilter(tab.id);
                        setPage(1);
                      }}
                      className="h-8 text-xs px-3"
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search recipient or phone..."
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchLogs}
                    className="h-8 px-2.5 text-xs text-muted-foreground"
                    title="Refresh Dispatches"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {logsLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[#10B981]" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-16 px-4 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto text-muted-foreground">
                      <Send className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-foreground">No WhatsApp Requests Found</h3>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        {search
                          ? 'No requests match your search criteria.'
                          : 'Dispatch your first review request to collect verified testimonials on WhatsApp.'}
                      </p>
                    </div>
                    {!search && (
                      <Button size="sm" onClick={() => setIsSendOpen(true)} className="gap-2 text-xs">
                        <Send className="w-3.5 h-3.5" /> Send First Request
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-3 px-4">Recipient</th>
                          <th className="py-3 px-4">Channel</th>
                          <th className="py-3 px-4">Delivery Status</th>
                          <th className="py-3 px-4">Feedback Status</th>
                          <th className="py-3 px-4">Sent At</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {logs.map((log) => {
                          const isDelivered =
                            log.delivery_status === 'DELIVERED' || log.delivery_status === 'READ';
                          const isFailed = log.delivery_status === 'FAILED';
                          const isPending =
                            log.delivery_status === 'PENDING_CONTRACT' ||
                            log.delivery_status === 'QUEUED' ||
                            log.delivery_status === 'SENT';

                          return (
                            <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-foreground">{log.customer_name}</div>
                                <div className="text-muted-foreground font-mono text-[11px]">
                                  {log.customer_phone}
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <Badge
                                  variant="secondary"
                                  className="bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30 font-medium text-[11px] gap-1"
                                >
                                  <MessageSquare className="w-3 h-3" /> WhatsApp
                                </Badge>
                              </td>

                              <td className="py-3 px-4">
                                {isDelivered && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-500/10 text-green-500 border-green-500/30 gap-1 text-[11px]"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />{' '}
                                    {log.delivery_status === 'READ' ? 'Read' : 'Delivered'}
                                  </Badge>
                                )}
                                {isPending && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-amber-500/10 text-amber-500 border-amber-500/30 gap-1 text-[11px]"
                                    title="Dispatched via Zenvlo WhatsApp Service boundary"
                                  >
                                    <Clock className="w-3 h-3" /> Dispatched
                                  </Badge>
                                )}
                                {isFailed && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-red-500/10 text-red-500 border-red-500/30 gap-1 text-[11px]"
                                    title={log.error_message || 'Delivery failed'}
                                  >
                                    <AlertCircle className="w-3 h-3" /> Failed
                                  </Badge>
                                )}
                              </td>

                              <td className="py-3 px-4">
                                {log.testimonial_id ? (
                                  <Badge
                                    variant="secondary"
                                    className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1 text-[11px] font-semibold"
                                  >
                                    <Star className="w-3 h-3 fill-emerald-400" /> Review Submitted
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground/60 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Awaiting Response
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-muted-foreground">
                                {new Date(log.created_on).toLocaleString()}
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleCopyLink(log.testimonial_url, log.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors text-[11px] cursor-pointer"
                                    title="Copy feedback link"
                                  >
                                    {copiedId === log.id ? (
                                      <>
                                        <Check className="w-3 h-3 text-[#10B981]" /> Copied!
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3 text-muted-foreground" /> Link
                                      </>
                                    )}
                                  </button>

                                  <button
                                    onClick={() => {
                                      setSelectedCustomerId(log.customer_id || '');
                                      setManualName(log.customer_name);
                                      setManualPhone(log.customer_phone);
                                      setIsSendOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 transition-colors text-[11px] font-medium cursor-pointer"
                                    title="Re-send WhatsApp request"
                                  >
                                    <Send className="w-3 h-3" /> Resend
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Send Request Modal */}
        <Dialog open={isSendOpen} onOpenChange={setIsSendOpen}>
          <DialogContent className="max-w-md">
            <form onSubmit={handleSendSingle}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#10B981]" /> Send WhatsApp Review Request
                </DialogTitle>
                <DialogDescription>
                  Dispatch an official WhatsApp testimonial invitation with your custom submission link.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {sendErrorMsg && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{sendErrorMsg}</span>
                  </div>
                )}

                {sendSuccessMsg && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-xs">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{sendSuccessMsg}</span>
                  </div>
                )}

                {/* Select Existing Contact */}
                {customers.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Select From Existing Contacts
                    </label>
                    <select
                      className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      value={selectedCustomerId}
                      onChange={(e) => {
                        setSelectedCustomerId(e.target.value);
                        if (e.target.value) {
                          const c = customers.find((cust) => cust.id === e.target.value);
                          if (c) {
                            setManualName(c.name);
                            setManualPhone(c.phone);
                          }
                        }
                      }}
                    >
                      <option value="">-- Choose Contact (or enter below) --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Recipient Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Customer Name *</label>
                    <Input
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Ananya Roy"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      WhatsApp Phone *
                    </label>
                    <Input
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>
                </div>

                {/* Optional Note */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Personalized Note (Optional)
                  </label>
                  <Textarea
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="e.g. Hope your dental cleaning yesterday went smoothly!"
                    className="h-20 text-xs"
                  />
                </div>

                {/* Message preview snippet */}
                <div className="p-3 rounded-xl bg-muted/60 border border-border text-[11px] text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-[#10B981]" /> WhatsApp Message Includes:
                  </div>
                  <p>
                    &quot;Hi {manualName || '{Customer}'}, thank you for choosing {business?.name || 'us'}!
                    Please share your review: {publicUrl}&quot;
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSendOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSending}>
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Dispatching...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-2" /> Send via WhatsApp
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Batch Send Modal */}
        <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#10B981]" /> Batch Dispatch WhatsApp Requests
              </DialogTitle>
              <DialogDescription>
                Simultaneously dispatch review requests to all {customers.length} contacts in your directory.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {batchResult && (
                <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-xs">
                  Successfully dispatched {batchResult.queued} of {batchResult.total} WhatsApp requests!
                </div>
              )}

              <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Target Recipients:</span>
                  <span className="font-bold text-foreground">{customers.length} Contacts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Channel:</span>
                  <span className="font-semibold text-[#10B981]">Zenvlo Engage WhatsApp</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Submission Link:</span>
                  <span className="font-mono text-[11px] text-foreground truncate max-w-[200px]">
                    /submit/{business?.slug || 'your-business'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Optional Batch Message Note
                </label>
                <Textarea
                  value={batchNote}
                  onChange={(e) => setBatchNote(e.target.value)}
                  placeholder="e.g. Thank you for your continued patronage this month!"
                  className="h-20 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBatchOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSendBatch}
                disabled={isBatchSending || customers.length === 0}
              >
                {isBatchSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Dispatching Batch...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-2" /> Dispatch to All ({customers.length})
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
