'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  MessageSquareQuote,
  Star,
  Users,
  Send,
  Layout,
  Puzzle,
  CreditCard,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bell,
  Building,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';
import { ZenvloLogo } from '@/components/ZenvloLogo';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Testimonials', href: '/testimonials', icon: MessageSquareQuote },
  { label: 'Reviews', href: '/reviews', icon: Star },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'WhatsApp Requests', href: '/requests', icon: Send },
  { label: 'Widgets', href: '/widgets', icon: Layout },
  { label: 'Integrations', href: '/integrations', icon: Puzzle },
  { label: 'Billing', href: '/billing', icon: CreditCard },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, business, logout } = useAuthStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? (resolvedTheme || theme) : 'dark';
  const displayedBusinessName =
    mounted && business?.name
      ? business.name
      : 'My Business';
  const displayedCategory =
    mounted && business?.category
      ? business.category
      : 'Review Management';
  const displayedEmail =
    mounted && user?.email
      ? user.email
      : 'owner@business.com';
  const displayedInitials =
    mounted && user?.email
      ? user.email.slice(0, 2).toUpperCase()
      : 'ZE';

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <Link href="/dashboard" className="flex items-center overflow-hidden">
            <ZenvloLogo collapsed={collapsed} />
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg border border-border bg-muted text-muted-foreground hover:text-foreground hover:border-border transition-colors cursor-pointer"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex lg:hidden items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!collapsed && (
          <div className="mx-3 my-3 p-2.5 rounded-xl bg-muted/60 border border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-[rgba(16,185,129,0.15)] border border-[#10B981]/30 flex items-center justify-center text-[#10B981] shrink-0">
                <Building className="w-4 h-4" />
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-foreground truncate">
                  {displayedBusinessName}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono truncate">
                  {displayedCategory}
                </span>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 space-y-1 px-3 py-3 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[#10B981]/30 font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive ? 'text-[#10B981]' : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-muted text-[#10B981] font-bold">
                  {displayedInitials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-col truncate">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {displayedEmail}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Business Owner</span>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span>Zenvlo Engage</span>
              <span>/</span>
              <span className="text-foreground font-medium capitalize">
                {pathname.replace('/', '') || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-border transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#10B981]" />
            </button>

            <button
              onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:border-border transition-colors cursor-pointer"
              title={currentTheme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
              aria-label="Toggle theme"
            >
              {mounted ? (
                currentTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
