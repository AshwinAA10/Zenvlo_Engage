'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  delivery_status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'PENDING_CONTRACT';
  message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  testimonial_id: string | null;
  response_received_at: string | null;
  created_on: string;
}

interface RequestStats {
  total_sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending_contract: number;
  feedback_received: number;
  delivery_rate: number;
  feedback_conversion_rate: number;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  last_request_sent_at?: string | null;
  request_count?: number;
}

export default function RequestsPage() {
  const { business } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [stats, setStats] = useState<RequestStats>({
    total_sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    pending_contract: 0,
    feedback_received: 0,
    delivery_rate: 100,
    feedback_conversion_rate: 0,
  });
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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

  // Copy Feedback Link Toast State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchStatsAndLogs = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, logsRes, customersRes] = await Promise.all([
        apiClient.get('/requests/stats'),
        apiClient.get('/requests', {
          params: {
            search: search || undefined,
            delivery_status: statusFilter === 'ALL' || statusFilter === 'FEEDBACK_RECEIVED' ? undefined : statusFilter,
            limit: 50,
          },
        }),
        apiClient.get('/customers', { params: { limit: 100 } }),
      ]);

      setStats(statsRes.data);
      let loadedLogs = logsRes.data.data || [];
      if (statusFilter === 'FEEDBACK_RECEIVED') {
        loadedLogs = loadedLogs.filter((l: RequestLog) => !!l.testimonial_id);
      }
      setLogs(loadedLogs);
      setCustomers(customersRes.data.data || []);
    } catch (err) {
      console.error('Failed to load request logs', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    setMounted(true);
    fetchStatsAndLogs();
  }, [fetchStatsAndLogs]);

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
          setSendErrorMsg('Please select a customer or enter name and WhatsApp phone number');
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
        fetchStatsAndLogs();
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
    setSendErrorMsg(null);

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
        fetchStatsAndLogs();
      }, 2000);
    } catch (err: any) {
      setSendErrorMsg(err.response?.data?.message || 'Failed to dispatch batch requests.');
    } finally {
      setIsBatchSending(false);
    }
  };

  if (!mounted) return null;

  const publicUrl = business?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/submit/${business.slug}`
    : 'https://app.zenvlo.com/submit/your-business';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Send className="w-6 h-6 text-[#10B981]" /> WhatsApp Requests & Tracking
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dispatch personalized WhatsApp testimonial requests and monitor customer delivery in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBatchOpen(true)}
            className="gap-2 text-xs"
            disabled={customers.length === 0}
          >
            <Users className="w-4 h-4 text-[#10B981]" /> Batch Send ({customers.length})
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
            className="gap-2 text-xs font-bold"
          >
            <Send className="w-4 h-4" /> Send Request
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Requests Sent</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{stats.total_sent}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">WhatsApp delivery channel</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center text-[#10B981]">
              <Send className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Delivery Success Rate</p>
              <h3 className="text-2xl font-bold text-[#10B981] mt-1">{stats.delivery_rate}%</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.delivered + stats.pending_contract} of {stats.total_sent || 0} delivered
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center text-[#10B981]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Feedback Conversion</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                {stats.feedback_conversion_rate}%
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.feedback_received} reviews submitted
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Star className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Integration Channel</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <h3 className="text-sm font-bold text-foreground">Zenvlo Engage WhatsApp</h3>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Internal service boundary</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <MessageSquare className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

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
                onClick={() => setStatusFilter(tab.id)}
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recipient or phone..."
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatsAndLogs}
              className="h-8 px-2.5 text-xs text-muted-foreground"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
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
                    const isPending = log.delivery_status === 'PENDING_CONTRACT';

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

              {/* Select Existing Customer */}
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
  );
}
