'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchTestimonials = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/testimonials', {
        params: { status: statusTab === 'ALL' ? undefined : statusTab, limit: 50 },
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

  const handleUpdateStatus = async (id: string, newStatus: 'APPROVED' | 'REJECTED') => {
    setUpdatingId(id);
    try {
      await apiClient.patch(`/testimonials/${id}/status`, { status: newStatus });
      fetchTestimonials();
    } catch (err) {
      console.error('Failed to update testimonial status', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this testimonial?')) return;
    try {
      await apiClient.delete(`/testimonials/${id}`);
      fetchTestimonials();
    } catch (err) {
      console.error('Failed to delete testimonial', err);
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Testimonial Moderation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review customer feedback submissions, approve social proof, and manage website proof
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
              {counts.pending > 0 ? 'Requires business moderation' : 'Inbox zero'}
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
            <p className="text-xs text-muted-foreground mt-1">Available for website widgets</p>
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
            <p className="text-xs text-muted-foreground mt-1">All recorded feedback</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
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
              onClick={() => setStatusTab(tab)}
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

      {/* Testimonials List */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-7 h-7 animate-spin text-[#10B981]" />
        </div>
      ) : testimonials.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 px-4 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto text-muted-foreground">
              <MessageSquareQuote className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                No {statusTab === 'ALL' ? '' : statusTab.toLowerCase()} Testimonials Yet
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Share your public review link with customers to collect genuine testimonials.
              </p>
            </div>
            <Button size="sm" onClick={copyPublicFormLink} className="gap-2 text-xs">
              <Copy className="w-3.5 h-3.5" /> Copy Public Form Link
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testimonials.map((t) => (
            <Card
              key={t.id}
              className={`transition-all ${
                t.approval_status === 'PENDING'
                  ? 'border-amber-500/40 bg-amber-500/[0.02]'
                  : t.approval_status === 'APPROVED'
                    ? 'border-[#10B981]/30 hover:border-[#10B981]/50'
                    : 'border-red-500/30 opacity-75'
              }`}
            >
              <CardContent className="p-5 space-y-3.5">
                {/* Header: Customer name, stars, status */}
                <div className="flex items-start justify-between gap-3">
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
                        onClick={() => handleUpdateStatus(t.id, 'REJECTED')}
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
          ))}
        </div>
      )}
    </div>
  );
}
