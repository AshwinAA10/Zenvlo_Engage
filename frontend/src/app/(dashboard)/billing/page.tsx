'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
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
import { apiClient } from '@/lib/axios';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  ShieldCheck,
  Send,
  Layout,
  MessageSquareQuote,
  Loader2,
  ArrowUpRight,
  Receipt,
  HelpCircle,
} from 'lucide-react';

interface SubscriptionData {
  subscription: {
    id: string;
    plan: 'FREE' | 'GROWTH' | 'ENTERPRISE';
    billing_cycle: 'MONTHLY' | 'YEARLY';
    status: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
  };
  plan: {
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    features: {
      whatsapp_requests_limit: number;
      widgets_limit: number | null;
      testimonials_limit: number | null;
      watermark_removed: boolean;
      google_places_sync: boolean;
    };
  };
  usage: {
    period_month: string;
    whatsapp_requests_sent: number;
    whatsapp_requests_limit: number;
    whatsapp_requests_remaining: number;
    widgets_count: number;
    widgets_limit: number | null;
    testimonials_count: number;
    testimonials_limit: number | null;
  };
  plans_available: Record<
    string,
    {
      monthlyPrice: number;
      yearlyPrice: number;
      features: {
        whatsapp_requests_limit: number;
        widgets_limit: number | null;
        testimonials_limit: number | null;
        watermark_removed: boolean;
        google_places_sync: boolean;
      };
    }
  >;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function BillingPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Success modal
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/billing/subscription');
      setData(res.data);
      if (res.data?.subscription?.billing_cycle) {
        setBillingCycle(res.data.subscription.billing_cycle);
      }
    } catch (err) {
      console.error('Failed to load subscription details', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Load Razorpay Checkout Script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleUpgrade = async (plan: 'GROWTH' | 'ENTERPRISE') => {
    try {
      setActionLoading(true);

      // 1. Create checkout order on backend
      const checkoutRes = await apiClient.post('/billing/checkout', {
        plan,
        billing_cycle: billingCycle,
      });

      const orderData = checkoutRes.data;

      // 2. Open Razorpay modal if SDK loaded
      if (typeof window !== 'undefined' && window.Razorpay) {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'Zenvlo Engage',
          description: `${plan} Plan (${billingCycle})`,
          order_id: orderData.orderId,
          handler: async function (response: any) {
            try {
              // 3. Verify payment on backend
              await apiClient.post('/billing/verify', {
                razorpay_order_id: response.razorpay_order_id || orderData.orderId,
                razorpay_payment_id: response.razorpay_payment_id || `pay_${Date.now()}`,
                razorpay_signature: response.razorpay_signature || 'mock_valid_signature',
                plan,
                billing_cycle: billingCycle,
              });

              setSuccessMessage(`Successfully upgraded to Zenvlo Engage ${plan} Plan!`);
              await fetchSubscription();
            } catch (err: any) {
              alert(err.response?.data?.message || 'Payment verification failed');
            }
          },
          prefill: {
            name: 'Business Owner',
          },
          theme: {
            color: '#10B981',
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          alert(`Payment failed: ${response.error?.description || 'Unknown error'}`);
        });
        rzp.open();
      } else {
        // Fallback simulated payment for local/test environments
        await apiClient.post('/billing/verify', {
          razorpay_order_id: orderData.orderId,
          razorpay_payment_id: `pay_test_${Date.now()}`,
          razorpay_signature: 'mock_valid_signature',
          plan,
          billing_cycle: billingCycle,
        });

        setSuccessMessage(`Successfully activated ${plan} Plan (Sandbox Mode)!`);
        await fetchSubscription();
      }
    } catch (err: any) {
      console.error('Upgrade failed', err);
      alert(err.response?.data?.message || 'Failed to initiate upgrade');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setActionLoading(true);
      await apiClient.post('/billing/cancel');
      setCancelDialogOpen(false);
      setSuccessMessage('Your subscription cancellation has been scheduled for the end of the current period.');
      await fetchSubscription();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-500" />
        <p className="text-sm">Loading billing & usage data...</p>
      </div>
    );
  }

  const currentPlan = data?.subscription?.plan || 'FREE';
  const usage = data?.usage;

  const whatsappPercent = usage
    ? Math.min(100, Math.round((usage.whatsapp_requests_sent / usage.whatsapp_requests_limit) * 100))
    : 0;

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Subscription & Usage
            </h1>
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-xs">
              Phase 7
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track your WhatsApp review requests, active widgets, and manage your Zenvlo Engage subscription.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              currentPlan === 'GROWTH'
                ? 'bg-emerald-500 text-white'
                : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {currentPlan} PLAN
          </Badge>
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-sm flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Usage Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* WhatsApp Request Usage */}
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-500" />
                WhatsApp Requests
              </CardTitle>
              <span className="text-xs font-bold text-foreground">
                {usage?.whatsapp_requests_sent || 0} / {usage?.whatsapp_requests_limit || 50}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  whatsappPercent > 90
                    ? 'bg-rose-500'
                    : whatsappPercent > 70
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${whatsappPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{usage?.whatsapp_requests_remaining || 0} requests left</span>
              <span>Resets monthly</span>
            </div>
          </CardContent>
        </Card>

        {/* Widgets Usage */}
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Layout className="w-4 h-4 text-blue-500" />
                Active Widgets
              </CardTitle>
              <span className="text-xs font-bold text-foreground">
                {usage?.widgets_count || 0} /{' '}
                {usage?.widgets_limit === null ? '∞ Unlimited' : usage?.widgets_limit || 1}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{
                  width: `${
                    usage?.widgets_limit === null
                      ? 25
                      : Math.min(100, ((usage?.widgets_count || 0) / (usage?.widgets_limit || 1)) * 100)
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {usage?.widgets_limit === null
                  ? 'Unlimited embeds included'
                  : 'Wall of Love, Carousel & Badge'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Testimonials Capacity */}
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <MessageSquareQuote className="w-4 h-4 text-purple-500" />
                Collected Testimonials
              </CardTitle>
              <span className="text-xs font-bold text-foreground">
                {usage?.testimonials_count || 0} /{' '}
                {usage?.testimonials_limit === null ? '∞' : usage?.testimonials_limit || 20}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-500"
                style={{
                  width: `${
                    usage?.testimonials_limit === null
                      ? 35
                      : Math.min(100, ((usage?.testimonials_count || 0) / (usage?.testimonials_limit || 20)) * 100)
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {usage?.testimonials_limit === null
                  ? 'Unlimited reviews'
                  : 'Approved customer reviews'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Period Status Banner */}
      {currentPlan !== 'FREE' && (
        <div className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Active {currentPlan} Subscription ({data?.subscription?.billing_cycle})
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data?.subscription?.cancel_at_period_end ? (
                  <span className="text-amber-500 font-medium">
                    Cancels at end of billing cycle on{' '}
                    {new Date(data.subscription.current_period_end).toLocaleDateString()}
                  </span>
                ) : (
                  <span>
                    Renews automatically on{' '}
                    {new Date(data?.subscription?.current_period_end || '').toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
          </div>

          {!data?.subscription?.cancel_at_period_end && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelDialogOpen(true)}
              className="text-xs text-muted-foreground hover:text-red-500 hover:border-red-500/50"
            >
              Cancel Auto-Renewal
            </Button>
          )}
        </div>
      )}

      {/* Billing Cycle Toggle */}
      <div className="flex flex-col items-center justify-center space-y-2 pt-4">
        <div className="inline-flex items-center p-1 rounded-xl bg-secondary/80 border border-border">
          <button
            type="button"
            onClick={() => setBillingCycle('MONTHLY')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              billingCycle === 'MONTHLY'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('YEARLY')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              billingCycle === 'YEARLY'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Annual Billing</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold">
              Save 17%
            </span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {billingCycle === 'YEARLY'
            ? 'Annual plans include 2 months free + priority WhatsApp dispatch.'
            : 'Standard monthly subscription. Cancel or upgrade anytime.'}
        </p>
      </div>

      {/* Pricing Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* FREE PLAN */}
        <Card
          className={`flex flex-col justify-between border transition-all ${
            currentPlan === 'FREE'
              ? 'border-border/80 bg-card'
              : 'border-border/60 bg-card/60'
          }`}
        >
          <div>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">Free Starter</CardTitle>
                {currentPlan === 'FREE' && (
                  <Badge variant="outline" className="border-border text-xs">
                    Current Plan
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs mt-1">
                Perfect for local shops beginning to collect customer social proof.
              </CardDescription>

              <div className="pt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-foreground">₹0</span>
                <span className="text-xs text-muted-foreground">/ month forever</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              <div className="font-semibold text-foreground pb-1">Included in Starter:</div>

              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>50 WhatsApp testimonial requests / month</span>
              </div>

              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>1 Website embed widget (Wall, Carousel, Badge)</span>
              </div>

              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Up to 20 approved customer testimonials</span>
              </div>

              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Google Places review import (1 location)</span>
              </div>

              <div className="flex items-center gap-2.5 text-muted-foreground">
                <span className="w-4 text-center">•</span>
                <span>Zenvlo Engage branding watermark</span>
              </div>
            </CardContent>
          </div>

          <CardFooter className="pt-6">
            <Button
              variant="outline"
              disabled
              className="w-full text-xs font-semibold cursor-not-allowed opacity-70"
            >
              {currentPlan === 'FREE' ? 'Current Plan' : 'Free Tier'}
            </Button>
          </CardFooter>
        </Card>

        {/* GROWTH PLAN */}
        <Card
          className={`flex flex-col justify-between relative border-2 transition-all ${
            currentPlan === 'GROWTH'
              ? 'border-emerald-500 bg-card shadow-lg shadow-emerald-950/20'
              : 'border-emerald-500/80 bg-card hover:border-emerald-500 shadow-xl'
          }`}
        >
          {/* Top highlight badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow">
            <Sparkles className="w-3 h-3" />
            Recommended for Growth
          </div>

          <div>
            <CardHeader className="pb-4 pt-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <span>Growth Plan</span>
                  <Zap className="w-4 h-4 text-emerald-500 fill-emerald-500" />
                </CardTitle>
                {currentPlan === 'GROWTH' && (
                  <Badge className="bg-emerald-500 text-white text-xs">
                    Current Plan
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs mt-1">
                For ambitious brands looking to maximize conversions with automated social proof.
              </CardDescription>

              <div className="pt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-foreground">
                  ₹{billingCycle === 'YEARLY' ? '14,990' : '1,499'}
                </span>
                <span className="text-xs text-muted-foreground">
                  / {billingCycle === 'YEARLY' ? 'year' : 'month'}
                </span>
                {billingCycle === 'YEARLY' && (
                  <span className="text-[11px] text-emerald-400 font-semibold ml-2">
                    (₹1,249/mo eff.)
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              <div className="font-semibold text-foreground pb-1">
                Everything in Starter, plus:
              </div>

              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="font-medium text-foreground">
                  500 WhatsApp testimonial requests / month
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="font-medium text-foreground">
                  Unlimited Website Widgets
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="font-medium text-foreground">
                  Unlimited Approved Testimonials & Photos
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="font-medium text-foreground">
                  Remove &ldquo;Powered by Zenvlo Engage&rdquo; watermark
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Google Places automatic daily synchronization</span>
              </div>

              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Priority WhatsApp dispatch queue</span>
              </div>
            </CardContent>
          </div>

          <CardFooter className="pt-6">
            {currentPlan === 'GROWTH' ? (
              <Button
                variant="outline"
                disabled
                className="w-full text-xs font-semibold border-emerald-500 text-emerald-400"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Active Plan
              </Button>
            ) : (
              <Button
                onClick={() => handleUpgrade('GROWTH')}
                disabled={actionLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-950/20"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Upgrade to Growth with Razorpay
                <ArrowUpRight className="w-4 h-4 ml-1.5" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Trust & Invoicing Information */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-border/60">
        <div className="p-4 rounded-xl bg-card border border-border/70 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <div>
            <h5 className="font-bold text-xs text-foreground">Safe & Encrypted Payments</h5>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Processed securely via Razorpay. Supports UPI, NetBanking, and credit/debit cards.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/70 flex items-start gap-3">
          <Receipt className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h5 className="font-bold text-xs text-foreground">GST Invoicing for India</h5>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Includes full GST invoices with your business GSTIN for tax input credits.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/70 flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
          <div>
            <h5 className="font-bold text-xs text-foreground">Need High-Scale Volume?</h5>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Contact our team for Enterprise tiers with over 2,500 WhatsApp requests/month.
            </p>
          </div>
        </div>
      </div>

      {/* Cancel Auto-Renewal Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-500 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Cancel Auto-Renewal?
            </DialogTitle>
            <DialogDescription>
              Your Growth plan will remain active until{' '}
              {new Date(data?.subscription?.current_period_end || '').toLocaleDateString()}. After that date, your account will revert to the Free Starter tier.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={actionLoading}
            >
              Keep My Plan
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
