import Link from 'next/link';
import { ZenvloLogo } from '@/components/ZenvloLogo';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  MessageSquareQuote,
  Send,
  Star,
  Layout,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/80 backdrop-blur-md sticky top-0 z-50 bg-background/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <ZenvloLogo />
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="gap-2">
                Start Free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(16,185,129,0.1)] border border-[#10B981]/30 text-[#10B981] text-xs font-semibold mb-8">
          <ShieldCheck className="w-3.5 h-3.5" />
          India-First Testimonial & Review Management SaaS
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl leading-tight sm:leading-tight">
          Turn WhatsApp Feedback into Website Social Proof with{' '}
          <span className="text-[#10B981]">Zenvlo Engage</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
          The all-in-one reputation management platform for local clinics, salons, restaurants,
          gyms, and D2C brands. Send WhatsApp requests, moderate feedback, and display verified widgets.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="gap-2 text-base px-8 h-12">
              Create Free Account <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="text-base px-8 h-12">
              Sign In to Console
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-20 w-full text-left">
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm hover:border-[#10B981]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-[#10B981] mb-4">
              <Send className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-foreground">WhatsApp Requests</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Request authentic customer reviews via WhatsApp with high open and response rates.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm hover:border-[#10B981]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-[#10B981] mb-4">
              <MessageSquareQuote className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-foreground">Frictionless Form</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Public link for rating, text, optional photo/video, and customer consent without login.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm hover:border-[#10B981]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-[#10B981] mb-4">
              <Star className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-foreground">Review Moderation</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Approve or reject incoming submissions so only verified social proof goes live.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm hover:border-[#10B981]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-[#10B981] mb-4">
              <Layout className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-foreground">Website Widgets</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Embed stunning Testimonial Walls, Carousels, and Rating Badges on any website.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <p>© 2026 Zenvlo Engage. All rights reserved. Emerald Design System.</p>
      </footer>
    </div>
  );
}
