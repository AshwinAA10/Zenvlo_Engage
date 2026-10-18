'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';
import {
  MessageSquareQuote,
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Trash2,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Camera,
  Video,
  Eye,
  CheckSquare,
  Square,
  Filter,
  Search,
  ArrowUpDown,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

export interface Testimonial {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  rating: number;
  content: string;
  photo_url: string | null;
  video_url: string | null;
  consent_given: boolean;
  consent_timestamp?: string;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  source: string;
  approved_at: string | null;
  approved_by_id: string | null;
  rejection_reason: string | null;
  created_on: string;
}

interface Counts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  averageRating: number;
}

export default function TestimonialsPage() {
  const { business } = useAuthStore();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [counts, setCounts] = useState<Counts>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    averageRating: 5.0,
  });

  // State: Loading, Error, Feedback
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Filters & Search & Sort
  const [statusTab, setStatusTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mediaFilter, setMediaFilter] = useState<'ALL' | 'MEDIA_ONLY' | 'TEXT_ONLY'>('ALL');
  const [ratingFilter, setRatingFilter] = useState<number | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'created_on' | 'rating'>('created_on');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');

  // Server-backed Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Actions & Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Dialogs: Detailed Inspection, Rejection, Deletion, Lightbox
  const [inspectingItem, setInspectingItem] = useState<Testimonial | null>(null);
  const [rejectingItem, setRejectingItem] = useState<Testimonial | null>(null);
  const [rejectReason, setRejectReason] = useState('Does not meet quality standards');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkReject, setIsBulkReject] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{
    type: 'photo' | 'video';
    url: string;
    customer: string;
  } | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page when tab changes
  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [statusTab, mediaFilter, ratingFilter, sortBy, sortOrder]);

  const fetchTestimonials = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const params: Record<string, any> = {
        page,
        limit,
        status: statusTab === 'ALL' ? undefined : statusTab,
        sortBy,
        sortOrder,
      };

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      if (mediaFilter !== 'ALL') {
        params.mediaFilter = mediaFilter;
      }
      if (ratingFilter !== 'ALL') {
        params.rating = ratingFilter;
      }

      const res = await apiClient.get('/testimonials', { params });
      setTestimonials(res.data.data || []);
      setTotalCount(res.data.total || 0);
      setTotalPages(res.data.total_pages || Math.ceil((res.data.total || 0) / limit) || 1);

      if (res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load testimonials. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusTab, debouncedSearch, mediaFilter, ratingFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const handleUpdateStatus = async (
    id: string,
    newStatus: 'APPROVED' | 'REJECTED' | 'PENDING',
    reason?: string,
  ) => {
    setUpdatingId(id);
    try {
      const res = await apiClient.patch(`/testimonials/${id}/status`, {
        status: newStatus,
        rejection_reason: reason,
      });

      // Synchronize inspected item if currently open
      if (inspectingItem && inspectingItem.id === id) {
        setInspectingItem(res.data);
      }

      showFeedback(
        'success',
        newStatus === 'APPROVED'
          ? 'Testimonial approved and published to widgets.'
          : newStatus === 'REJECTED'
            ? 'Testimonial rejected and hidden from widgets.'
            : 'Testimonial re-queued for moderation.',
      );

      await fetchTestimonials();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update testimonial status.';
      showFeedback('error', msg);
    } finally {
      setUpdatingId(null);
      setRejectingItem(null);
    }
  };

  const handleBulkUpdate = async (status: 'APPROVED' | 'REJECTED', reason?: string) => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    try {
      const res = await apiClient.patch('/testimonials/bulk-status', {
        ids: selectedIds,
        status,
        rejection_reason: reason,
      });

      showFeedback(
        'success',
        `Successfully updated ${res.data?.updated_count || selectedIds.length} review(s) to ${status.toLowerCase()}.`,
      );
      setSelectedIds([]);
      setIsBulkReject(false);
      await fetchTestimonials();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to perform bulk action.';
      showFeedback('error', msg);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/testimonials/${id}`);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      if (inspectingItem?.id === id) {
        setInspectingItem(null);
      }
      showFeedback('success', 'Testimonial deleted successfully.');
      await fetchTestimonials();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to delete testimonial.';
      showFeedback('error', msg);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === testimonials.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(testimonials.map((t) => t.id));
    }
  };

  const publicFormUrl =
    typeof window !== 'undefined' && business?.slug
      ? `${window.location.origin}/submit/${business.slug}`
      : '#';

  const copyPublicFormLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(publicFormUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="space-y-7">
      {/* Top Header & Public Form Link */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Testimonial Moderation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review incoming feedback, verify photos & videos, and control website social proof publication
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={copyPublicFormLink}
            className="gap-2 text-xs"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#10B981]" /> Link Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy Review Form Link
              </>
            )}
          </Button>
          {business?.slug && (
            <Link href={`/submit/${business.slug}`} target="_blank">
              <Button size="sm" className="gap-2 text-xs font-bold">
                <ExternalLink className="w-3.5 h-3.5" /> Open Public Form
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Operational Feedback Banner */}
      {feedbackMessage && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in slide-in-from-top-1 ${
            feedbackMessage.type === 'success'
              ? 'bg-[rgba(16,185,129,0.12)] border-[#10B981]/30 text-[#10B981]'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-xs hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Retry Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3 text-xs text-red-400"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchTestimonials}
            className="h-7 text-xs border-red-500/40 text-red-400 hover:bg-red-500/20 gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </Button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="hover:border-amber-500/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Approvals
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Clock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{counts.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {counts.pending > 0 ? 'Requires business moderation' : 'All reviews reviewed'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-[#10B981]/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Approved Reviews
            </CardTitle>
            <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.1)] text-[#10B981]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{counts.approved}</div>
            <p className="text-xs text-muted-foreground mt-1">Live in website widgets</p>
          </CardContent>
        </Card>

        <Card className="hover:border-[#10B981]/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Average Rating
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {counts.averageRating.toFixed(1)} ★
            </div>
            <p className="text-xs text-muted-foreground mt-1">From approved testimonials</p>
          </CardContent>
        </Card>

        <Card className="hover:border-[#10B981]/40 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Submissions
            </CardTitle>
            <div className="p-2 rounded-xl bg-muted text-muted-foreground">
              <MessageSquareQuote className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{counts.total}</div>
            <p className="text-xs text-muted-foreground mt-1">All customer submissions</p>
          </CardContent>
        </Card>
      </div>

      {/* Moderation Workspace Toolbar: Search, Status Tabs, Rating, Media & Sorting */}
      <div className="p-4 rounded-2xl bg-card border border-border space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search customer name or review text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 text-xs h-9 bg-muted/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort & Order Dropdowns */}
          <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
            <div className="flex items-center gap-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-muted/40 border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="created_on">Submission Date</option>
                <option value="rating">Star Rating</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')}
              className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground bg-muted/30 cursor-pointer"
              title={sortOrder === 'DESC' ? 'Descending' : 'Ascending'}
            >
              {sortOrder === 'DESC' ? 'Newest / Highest ↓' : 'Oldest / Lowest ↑'}
            </button>
          </div>
        </div>

        {/* Secondary Filter Line: Status Tabs + Media + Rating */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-border/60">
          {/* Status Tabs with Counters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((tab) => {
              const isActive = statusTab === tab;
              const count =
                tab === 'ALL'
                  ? counts.total
                  : tab === 'PENDING'
                    ? counts.pending
                    : tab === 'APPROVED'
                      ? counts.approved
                      : counts.rejected;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusTab(tab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[#10B981]/30 font-bold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                  }`}
                >
                  <span>
                    {tab === 'ALL' ? 'All Reviews' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-[#10B981] text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Media & Rating Filter Toggles */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            {/* Rating Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Rating:</span>
              <select
                value={ratingFilter}
                onChange={(e) =>
                  setRatingFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                }
                className="bg-muted/40 border border-border text-foreground text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Stars</option>
                <option value="5">5 Stars only</option>
                <option value="4">4 Stars only</option>
                <option value="3">3 Stars only</option>
                <option value="2">2 Stars only</option>
                <option value="1">1 Star only</option>
              </select>
            </div>

            {/* Media Filter */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Filter className="w-3 h-3" /> Media:
              </span>
              <button
                type="button"
                onClick={() => setMediaFilter('ALL')}
                className={`px-2 py-0.5 rounded-lg border transition-all ${
                  mediaFilter === 'ALL'
                    ? 'bg-muted text-foreground border-border font-bold'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setMediaFilter('MEDIA_ONLY')}
                className={`px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 ${
                  mediaFilter === 'MEDIA_ONLY'
                    ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40 font-bold'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                <Camera className="w-2.5 h-2.5" /> Media Only
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-20 z-20 flex flex-col sm:flex-row sm:items-center justify-between p-3.5 px-5 rounded-2xl bg-[#09090b] border border-[#10B981]/40 shadow-2xl animate-in slide-in-from-top-2 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-foreground">
              {selectedIds.length} review{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-muted-foreground hover:underline cursor-pointer"
            >
              Clear selection
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleBulkUpdate('APPROVED')}
              disabled={bulkProcessing}
              className="h-8 text-xs font-bold gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsBulkReject(true);
                setRejectReason('Does not meet quality standards');
              }}
              disabled={bulkProcessing}
              className="h-8 text-xs font-bold gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject Selected...
            </Button>
          </div>
        </div>
      )}

      {/* Testimonials Grid / List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#10B981]" />
          <p className="text-xs text-muted-foreground">Loading testimonials...</p>
        </div>
      ) : testimonials.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 px-4 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto text-muted-foreground">
              <MessageSquareQuote className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                {debouncedSearch
                  ? `No reviews matching "${debouncedSearch}"`
                  : `No ${statusTab === 'ALL' ? '' : statusTab.toLowerCase()} Testimonials Found`}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {debouncedSearch
                  ? 'Try searching with different keywords or clear the filter.'
                  : statusTab === 'PENDING'
                    ? 'All customer feedback has been reviewed. Newly received reviews will appear here.'
                    : 'Share your public review form with customers to collect genuine testimonials with photos & videos.'}
              </p>
            </div>
            {debouncedSearch ? (
              <Button size="sm" variant="outline" onClick={() => setSearchQuery('')} className="text-xs">
                Clear Search
              </Button>
            ) : (
              <Button size="sm" onClick={copyPublicFormLink} className="gap-2 text-xs">
                <Copy className="w-3.5 h-3.5" /> Copy Public Form Link
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Header Row: Select All + Count Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 hover:text-foreground font-semibold cursor-pointer"
            >
              {selectedIds.length === testimonials.length && testimonials.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-[#10B981]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Select All on Page ({testimonials.length})
            </button>
            <span>
              Showing {testimonials.length} of {totalCount} reviews (Page {page} of {totalPages})
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testimonials.map((t) => {
              const isSelected = selectedIds.includes(t.id);

              return (
                <Card
                  key={t.id}
                  className={`transition-all relative ${
                    isSelected ? 'ring-2 ring-[#10B981]' : ''
                  } ${
                    t.approval_status === 'PENDING'
                      ? 'border-amber-500/40 bg-amber-500/[0.02]'
                      : t.approval_status === 'APPROVED'
                        ? 'border-[#10B981]/30 hover:border-[#10B981]/50'
                        : 'border-red-500/30 opacity-75'
                  }`}
                >
                  <CardContent className="p-5 space-y-3.5">
                    {/* Header: Select box, Customer name, stars, status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => toggleSelect(t.id)}
                          className="mt-0.5 text-muted-foreground hover:text-[#10B981] transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#10B981]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <div>
                          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            {t.customer_name}
                            {t.consent_given && (
                              <span
                                title="Verified Consent"
                                className="text-[#10B981] inline-flex items-center"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-1 mt-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3.5 h-3.5 ${
                                  star <= t.rating
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-muted-foreground/30'
                                }`}
                              />
                            ))}
                            <span className="text-[11px] font-bold text-foreground ml-1.5">
                              {t.rating}.0
                            </span>
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant={
                          t.approval_status === 'APPROVED'
                            ? 'default'
                            : t.approval_status === 'PENDING'
                              ? 'outline'
                              : 'destructive'
                        }
                        className="text-[10px] uppercase font-bold"
                      >
                        {t.approval_status}
                      </Badge>
                    </div>

                    {/* Content */}
                    <p className="text-xs text-muted-foreground leading-relaxed italic bg-muted/30 p-3 rounded-xl border border-border/50 line-clamp-3">
                      &ldquo;{t.content}&rdquo;
                    </p>

                    {/* Media Attachments Preview */}
                    {(t.photo_url || t.video_url) && (
                      <div className="flex items-center gap-3 pt-1">
                        {t.photo_url && (
                          <div
                            onClick={() =>
                              setPreviewMedia({
                                type: 'photo',
                                url: t.photo_url!,
                                customer: t.customer_name,
                              })
                            }
                            className="relative group cursor-pointer overflow-hidden rounded-xl border border-border w-24 h-20 bg-muted shrink-0"
                          >
                            <img
                              src={t.photo_url}
                              alt="Review attachment"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                            <span className="absolute bottom-1 right-1 bg-black/60 px-1 py-0.5 rounded text-[8px] font-semibold text-white flex items-center gap-0.5">
                              <Camera className="w-2.5 h-2.5" /> Photo
                            </span>
                          </div>
                        )}

                        {t.video_url && (
                          <div
                            onClick={() =>
                              setPreviewMedia({
                                type: 'video',
                                url: t.video_url!,
                                customer: t.customer_name,
                              })
                            }
                            className="relative group cursor-pointer overflow-hidden rounded-xl border border-border w-28 h-20 bg-muted shrink-0"
                          >
                            <video src={t.video_url} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                            <span className="absolute bottom-1 right-1 bg-black/60 px-1 py-0.5 rounded text-[8px] font-semibold text-white flex items-center gap-0.5">
                              <Video className="w-2.5 h-2.5" /> Video
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rejection reason notice */}
                    {t.approval_status === 'REJECTED' && t.rejection_reason && (
                      <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Reason: {t.rejection_reason}</span>
                      </div>
                    )}

                    {/* Footer metadata & moderation controls */}
                    <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
                      <span>{new Date(t.created_on).toLocaleDateString()}</span>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setInspectingItem(t)}
                          className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Inspect
                        </Button>

                        {t.approval_status !== 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={updatingId === t.id}
                            onClick={() => handleUpdateStatus(t.id, 'APPROVED')}
                            className="h-7 text-xs px-2.5 font-bold"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                        )}

                        {t.approval_status !== 'REJECTED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatingId === t.id}
                            onClick={() => setRejectingItem(t)}
                            className="h-7 text-xs px-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/30"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        )}

                        <button
                          type="button"
                          onClick={() => setDeletingId(t.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete Testimonial"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  className="h-8 text-xs gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  className="h-8 text-xs gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed Testimonial Inspection Modal */}
      <Dialog open={!!inspectingItem} onOpenChange={(open) => !open && setInspectingItem(null)}>
        <DialogContent className="max-w-xl bg-card border-border p-6 text-foreground">
          {inspectingItem && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted border border-border text-xs text-muted-foreground">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" /> Verified Consent
                  </div>
                  <Badge
                    variant={
                      inspectingItem.approval_status === 'APPROVED'
                        ? 'default'
                        : inspectingItem.approval_status === 'PENDING'
                          ? 'outline'
                          : 'destructive'
                    }
                    className="text-xs font-bold uppercase"
                  >
                    {inspectingItem.approval_status}
                  </Badge>
                </div>
                <DialogTitle className="text-lg font-bold mt-2">
                  Testimonial from {inspectingItem.customer_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Submitted via {inspectingItem.source || 'Public Form'} on{' '}
                  {new Date(inspectingItem.created_on).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              {/* Rating */}
              <div className="flex items-center gap-1 bg-muted/30 p-3 rounded-xl border border-border/60">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= inspectingItem.rating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                ))}
                <span className="text-xs font-bold text-foreground ml-2">
                  {inspectingItem.rating}.0 out of 5 stars
                </span>
              </div>

              {/* Review Text */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Review Content:</span>
                <p className="text-sm text-foreground bg-muted/40 p-4 rounded-xl border border-border leading-relaxed">
                  {inspectingItem.content}
                </p>
              </div>

              {/* Customer Contact Metadata (Visible to Authorized Moderator Only) */}
              {(inspectingItem.customer_phone || inspectingItem.customer_email) && (
                <div className="p-3 rounded-xl bg-muted/20 border border-border text-xs space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Customer Details (Private):
                  </span>
                  <div className="flex flex-wrap gap-4 text-foreground">
                    {inspectingItem.customer_phone && (
                      <span>Phone: {inspectingItem.customer_phone}</span>
                    )}
                    {inspectingItem.customer_email && (
                      <span>Email: {inspectingItem.customer_email}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Attached Media */}
              {(inspectingItem.photo_url || inspectingItem.video_url) && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground">Attached Media:</span>
                  <div className="flex items-center gap-3">
                    {inspectingItem.photo_url && (
                      <div
                        onClick={() =>
                          setPreviewMedia({
                            type: 'photo',
                            url: inspectingItem.photo_url!,
                            customer: inspectingItem.customer_name,
                          })
                        }
                        className="cursor-pointer overflow-hidden rounded-xl border border-border w-28 h-24 bg-muted relative group"
                      >
                        <img
                          src={inspectingItem.photo_url}
                          alt="Review attachment"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    )}
                    {inspectingItem.video_url && (
                      <div
                        onClick={() =>
                          setPreviewMedia({
                            type: 'video',
                            url: inspectingItem.video_url!,
                            customer: inspectingItem.customer_name,
                          })
                        }
                        className="cursor-pointer overflow-hidden rounded-xl border border-border w-32 h-24 bg-muted relative group"
                      >
                        <video src={inspectingItem.video_url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rejection Note */}
              {inspectingItem.approval_status === 'REJECTED' && inspectingItem.rejection_reason && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <span className="font-bold">Rejection Note: </span>
                  <span>{inspectingItem.rejection_reason}</span>
                </div>
              )}

              <DialogFooter className="flex flex-col sm:flex-row sm:justify-between items-center gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeletingId(inspectingItem.id)}
                  className="text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>

                <div className="flex items-center gap-2">
                  {inspectingItem.approval_status !== 'APPROVED' && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleUpdateStatus(inspectingItem.id, 'APPROVED')}
                      className="text-xs font-bold gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Publish
                    </Button>
                  )}

                  {inspectingItem.approval_status !== 'REJECTED' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRejectingItem(inspectingItem);
                        setInspectingItem(null);
                      }}
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/30 gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject...
                    </Button>
                  )}

                  {inspectingItem.approval_status !== 'PENDING' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateStatus(inspectingItem.id, 'PENDING')}
                      className="text-xs gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Re-queue Pending
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox Media Preview Dialog */}
      <Dialog open={!!previewMedia} onOpenChange={() => setPreviewMedia(null)}>
        <DialogContent className="max-w-2xl bg-black border-border p-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              Attachment from {previewMedia?.customer}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Verified review submission asset
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-2 max-h-[70vh] overflow-hidden rounded-xl">
            {previewMedia?.type === 'photo' ? (
              <img
                src={previewMedia.url}
                alt="Enlarged review photo"
                className="max-h-[65vh] w-auto object-contain rounded-lg"
              />
            ) : previewMedia?.type === 'video' ? (
              <video src={previewMedia.url} controls autoPlay className="max-h-[65vh] w-full rounded-lg" />
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewMedia(null)}
            >
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog (Single or Bulk) */}
      <Dialog
        open={!!rejectingItem || isBulkReject}
        onOpenChange={() => {
          setRejectingItem(null);
          setIsBulkReject(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <XCircle className="w-5 h-5" />{' '}
              {isBulkReject
                ? `Reject ${selectedIds.length} Testimonials`
                : 'Reject Testimonial'}
            </DialogTitle>
            <DialogDescription>
              Rejected testimonials will not be published in any website social proof widgets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Select Common Reason:
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  'Spam or Promo',
                  'Inappropriate Content',
                  'Competitor / Fake',
                  'Wrong Business',
                  'Customer Request',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReason(reason)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      rejectReason === reason
                        ? 'bg-red-500/15 text-red-400 border-red-500/40 font-bold'
                        : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Internal Rejection Note:
              </label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Explain why this review was rejected..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setRejectingItem(null);
                setIsBulkReject(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (isBulkReject) {
                  handleBulkUpdate('REJECTED', rejectReason);
                } else if (rejectingItem) {
                  handleUpdateStatus(rejectingItem.id, 'REJECTED', rejectReason);
                }
              }}
              className="bg-red-500 hover:bg-red-600 text-white font-bold"
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accessible Deletion Confirmation Dialog */}
      <Dialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" /> Permanently Delete Testimonial
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              This will remove the testimonial from your business workspace and any live widgets. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => deletingId && handleDelete(deletingId)}
              className="font-bold"
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
