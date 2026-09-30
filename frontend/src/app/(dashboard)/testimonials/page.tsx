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
} from 'lucide-react';
import Link from 'next/link';

interface Testimonial {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  rating: number;
  content: string;
  photo_url: string | null;
  video_url: string | null;
  consent_given: boolean;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  source: string;
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
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [mediaFilter, setMediaFilter] = useState<'ALL' | 'MEDIA_ONLY' | 'TEXT_ONLY'>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Lightbox Media Preview Dialog
  const [previewMedia, setPreviewMedia] = useState<{
    type: 'photo' | 'video';
    url: string;
    customer: string;
  } | null>(null);

  // Reject Dialog
  const [rejectingItem, setRejectingItem] = useState<Testimonial | null>(null);
  const [rejectReason, setRejectReason] = useState('Does not meet quality standards');

  const fetchTestimonials = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/testimonials', {
        params: { status: statusTab === 'ALL' ? undefined : statusTab, limit: 100 },
      });
      setTestimonials(res.data.data || []);
      if (res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch (err) {
      console.error('Failed to load testimonials', err);
    } finally {
      setLoading(false);
    }
  }, [statusTab]);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  const handleUpdateStatus = async (
    id: string,
    newStatus: 'APPROVED' | 'REJECTED',
    reason?: string,
  ) => {
    setUpdatingId(id);
    try {
      await apiClient.patch(`/testimonials/${id}/status`, {
        status: newStatus,
        rejection_reason: reason,
      });
      fetchTestimonials();
    } catch (err) {
      console.error('Failed to update testimonial status', err);
    } finally {
      setUpdatingId(null);
      setRejectingItem(null);
    }
  };

  const handleBulkUpdate = async (status: 'APPROVED' | 'REJECTED') => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          apiClient.patch(`/testimonials/${id}/status`, { status }),
        ),
      );
      setSelectedIds([]);
      fetchTestimonials();
    } catch (err) {
      console.error('Failed bulk status update', err);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this testimonial?')) return;
    try {
      await apiClient.delete(`/testimonials/${id}`);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      fetchTestimonials();
    } catch (err) {
      console.error('Failed to delete testimonial', err);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTestimonials.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTestimonials.map((t) => t.id));
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

  // Filter by media if active
  const filteredTestimonials = testimonials.filter((t) => {
    if (mediaFilter === 'MEDIA_ONLY') {
      return Boolean(t.photo_url || t.video_url);
    }
    if (mediaFilter === 'TEXT_ONLY') {
      return !t.photo_url && !t.video_url;
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Testimonial Moderation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review customer submissions, verify photos/videos, and manage live website social proof
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

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

      {/* Filter Tabs & Media Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
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
                onClick={() => {
                  setStatusTab(tab);
                  setSelectedIds([]);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[#10B981]/30'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                }`}
              >
                <span>{tab === 'ALL' ? 'All Reviews' : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
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

        {/* Media filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Media:
          </span>
          <button
            onClick={() => setMediaFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg border transition-all ${
              mediaFilter === 'ALL'
                ? 'bg-muted text-foreground border-border font-bold'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setMediaFilter('MEDIA_ONLY')}
            className={`px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
              mediaFilter === 'MEDIA_ONLY'
                ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40 font-bold'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <Camera className="w-3 h-3" /> With Media
          </button>
        </div>
      </div>

      {/* Bulk Action Bar (Visible when items selected) */}
      {selectedIds.length > 0 && (
        <div className="sticky top-20 z-20 flex items-center justify-between p-3.5 rounded-2xl bg-[#09090b] border border-[#10B981]/40 shadow-xl animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-foreground">
              {selectedIds.length} review{selectedIds.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-muted-foreground hover:underline"
            >
              Clear
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
              onClick={() => handleBulkUpdate('REJECTED')}
              disabled={bulkProcessing}
              className="h-8 text-xs font-bold gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject Selected
            </Button>
          </div>
        </div>
      )}

      {/* Testimonials List */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-7 h-7 animate-spin text-[#10B981]" />
        </div>
      ) : filteredTestimonials.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 px-4 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto text-muted-foreground">
              <MessageSquareQuote className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                No {statusTab === 'ALL' ? '' : statusTab.toLowerCase()} Testimonials Found
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Share your public review link with customers to collect genuine testimonials with photos & videos.
              </p>
            </div>
            <Button size="sm" onClick={copyPublicFormLink} className="gap-2 text-xs">
              <Copy className="w-3.5 h-3.5" /> Copy Public Form Link
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 hover:text-foreground font-semibold cursor-pointer"
            >
              {selectedIds.length === filteredTestimonials.length ? (
                <CheckSquare className="w-4 h-4 text-[#10B981]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              Select All ({filteredTestimonials.length})
            </button>
            <span>Showing {filteredTestimonials.length} reviews</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTestimonials.map((t) => {
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
                          <h3 className="text-sm font-bold text-foreground">{t.customer_name}</h3>
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
                    <p className="text-xs text-muted-foreground leading-relaxed italic bg-muted/30 p-3 rounded-xl border border-border/50">
                      &ldquo;{t.content}&rdquo;
                    </p>

                    {/* Media Attachments (Photo / Video Previews) */}
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
                            <video
                              src={t.video_url}
                              className="w-full h-full object-cover"
                            />
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

                    {/* Footer metadata & actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
                      <span>{new Date(t.created_on).toLocaleDateString()}</span>

                      <div className="flex items-center gap-1.5">
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
                          onClick={() => handleDelete(t.id)}
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
        </div>
      )}

      {/* Media Lightbox Dialog */}
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
              <video
                src={previewMedia.url}
                controls
                autoPlay
                className="max-h-[65vh] w-full rounded-lg"
              />
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

      {/* Rejection Reason Dialog */}
      <Dialog open={!!rejectingItem} onOpenChange={() => setRejectingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <XCircle className="w-5 h-5" /> Reject Testimonial
            </DialogTitle>
            <DialogDescription>
              Rejected testimonials will not appear in website widgets.
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
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
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
              onClick={() => setRejectingItem(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (rejectingItem) {
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
    </div>
  );
}
