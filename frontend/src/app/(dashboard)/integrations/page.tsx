'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { apiClient } from '@/lib/axios';
import {
  Puzzle,
  Send,
  Star,
  Layout,
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Building,
} from 'lucide-react';

interface ReviewSource {
  id: string;
  name: string;
  rating: number;
  review_count: number;
}

export default function IntegrationsPage() {
  const [mounted, setMounted] = useState(false);
  const [googleSource, setGoogleSource] = useState<ReviewSource | null>(null);

  useEffect(() => {
    setMounted(true);
    const loadIntegrations = async () => {
      try {
        const res = await apiClient.get('/reviews/sources');
        if (res.data && res.data.length > 0) {
          setGoogleSource(res.data[0]);
        }
      } catch {
        // Fallback gracefully
      }
    };
    loadIntegrations();
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Puzzle className="w-6 h-6 text-[#10B981]" /> Integrations & Channels
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your external platforms to automate testimonial collection and expand social proof
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Google Places Integration */}
        <Card className="border-border hover:border-blue-500/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-lg">
                G
              </div>
              {googleSource ? (
                <Badge
                  variant="secondary"
                  className="bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 text-xs gap-1 font-semibold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Not Connected
                </Badge>
              )}
            </div>
            <CardTitle className="text-base font-bold text-foreground mt-3">
              Google Places (Read-Only Reviews)
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Import verified Google reviews and aggregate star ratings directly from your Google Business place listing without requiring complex OAuth approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {googleSource && (
              <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs space-y-1">
                <div className="font-semibold text-foreground">{googleSource.name}</div>
                <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <span className="text-amber-400 font-bold flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-amber-400" /> {googleSource.rating}
                  </span>
                  <span>•</span>
                  <span>{googleSource.review_count} imported reviews</span>
                </div>
              </div>
            )}
            <div className="pt-2">
              <Link href="/reviews">
                <Button size="sm" className="w-full gap-2 text-xs">
                  <span>{googleSource ? 'Manage Google Reviews' : 'Connect Google Place'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Delivery Channel */}
        <Card className="border-border hover:border-[#10B981]/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
              <Badge
                variant="secondary"
                className="bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 text-xs gap-1 font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Active (Zenvlo Service)
              </Badge>
            </div>
            <CardTitle className="text-base font-bold text-foreground mt-3">
              Zenvlo Engage WhatsApp Integration
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Integrated internal delivery channel communicating with the Zenvlo Engage WhatsApp capability to send branded feedback invitations and track delivery receipts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs space-y-1">
              <div className="font-semibold text-foreground">Outbound Testimonial Delivery</div>
              <p className="text-[11px] text-muted-foreground">
                Single and batch customer dispatch with direct delivery status tracking.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/requests">
                <Button size="sm" variant="outline" className="w-full gap-2 text-xs">
                  <span>Manage WhatsApp Requests</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Website Widgets Integration */}
        <Card className="border-border hover:border-[#10B981]/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Layout className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-xs text-purple-400 border-purple-500/30">
                Phase 6 Ready
              </Badge>
            </div>
            <CardTitle className="text-base font-bold text-foreground mt-3">
              Embeddable Website Widgets
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Display curated testimonials and verified Google reviews on your external website via Testimonial Wall, Testimonial Carousel, and Star Rating Badge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs space-y-1">
              <div className="font-semibold text-foreground">Zero-Code Embed Snippets</div>
              <p className="text-[11px] text-muted-foreground">
                Copy one line of HTML script tag to showcase social proof anywhere.
              </p>
            </div>
            <div className="pt-2">
              <Button size="sm" variant="outline" disabled className="w-full text-xs">
                <span>Phase 6 Workflow</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Razorpay Billing Integration */}
        <Card className="border-border hover:border-[#10B981]/40 transition-all flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Phase 7 Scheduled
              </Badge>
            </div>
            <CardTitle className="text-base font-bold text-foreground mt-3">
              Razorpay Subscription Billing
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              India-first payment gateways supporting UPI, Credit/Debit cards, and NetBanking with automated usage limit tracking for monthly plans.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs space-y-1">
              <div className="font-semibold text-foreground">Usage Tier & Quotas</div>
              <p className="text-[11px] text-muted-foreground">
                Free plan and Pro tier limits enforcement.
              </p>
            </div>
            <div className="pt-2">
              <Button size="sm" variant="outline" disabled className="w-full text-xs">
                <span>Phase 7 Workflow</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
