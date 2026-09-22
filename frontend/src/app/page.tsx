import Link from 'next/link';
import { ZenvloLogo } from '@/components/ZenvloLogo';
import { Button } from '@/components/ui/button';
import { ArrowRight, MessageSquare, Send, Zap, Bot, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-[#F8FAFC]">
      <header className="border-b border-[#27272a]/80 backdrop-blur-md sticky top-0 z-50 bg-black/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <ZenvloLogo />
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm" className="gap-2">
                Open Console <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(16,185,129,0.1)] border border-[#10B981]/30 text-[#10B981] text-xs font-semibold mb-8">
          <ShieldCheck className="w-3.5 h-3.5" />
          Enterprise Multi-Tenant SaaS Architecture
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[#F8FAFC] max-w-4xl leading-tight sm:leading-tight">
          Supercharge WhatsApp & Instagram with{' '}
          <span className="text-[#10B981]">Zenvlo Engage</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-[#A1A1AA] max-w-2xl leading-relaxed">
          The high-throughput automation cloud for conversations, scheduled campaigns,
          dynamic workflows, and AI agents with verified tenant isolation.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/dashboard">
            <Button size="lg" className="gap-2 text-base px-8 h-12">
              Launch Dashboard <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="text-base px-8 h-12">
              Authentication Portal
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-20 w-full text-left">
          <div className="p-6 rounded-2xl bg-[#09090b] border border-[#27272a] shadow-sm hover:border-[#10B981]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#27272a] flex items-center justify-center text-[#10B981] mb-4">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-[#F8FAFC]">Unified Inbox</h3>
            <p className="mt-2 text-xs text-[#A1A1AA] leading-relaxed">
              Real-time multi-agent inbox synchronizing WhatsApp Cloud API & Instagram Graph API.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#09090b] border border-[#27272a] shadow-sm hover:border-[#10B981]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#27272a] flex items-center justify-center text-[#10B981] mb-4">
              <Send className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-[#F8FAFC]">Broadcast Campaigns</h3>
            <p className="mt-2 text-xs text-[#A1A1AA] leading-relaxed">
              Targeted template broadcasts backed by resilient BullMQ queue processing.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#09090b] border border-[#27272a] shadow-sm hover:border-[#10B981]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#27272a] flex items-center justify-center text-[#10B981] mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-[#F8FAFC]">Visual Workflows</h3>
            <p className="mt-2 text-xs text-[#A1A1AA] leading-relaxed">
              Automated trigger-to-action routing with instant Meta webhook validation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#09090b] border border-[#27272a] shadow-sm hover:border-[#10B981]/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-[#27272a] flex items-center justify-center text-[#10B981] mb-4">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-[#F8FAFC]">AI Agents</h3>
            <p className="mt-2 text-xs text-[#A1A1AA] leading-relaxed">
              Extensible agentic foundation ready for LLM-powered autonomous assistance.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#27272a] py-6 text-center text-xs text-[#A1A1AA]">
        <p>© 2026 Zenvlo Ecosystem. All rights reserved. Pitch-Black Obsidian + Emerald Design System.</p>
      </footer>
    </div>
  );
}
