'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  MessageSquare,
  Send,
  Users,
  Zap,
  Bot,
  Radio,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Building,
  LogOut,
  Bell,
} from 'lucide-react';
import { ZenvloLogo } from './ZenvloLogo';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useAuthStore } from '../stores/authStore';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Chats', href: '/chats', icon: MessageSquare, badge: '3' },
  { label: 'Campaigns', href: '/campaigns', icon: Send },
  { label: 'Contacts', href: '/contacts', icon: Users },
  { label: 'Workflows', href: '/workflows', icon: Zap },
  { label: 'AI Agents', href: '/ai-agents', icon: Bot, badge: 'New' },
  { label: 'Channels', href: '/channels', icon: Radio },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, currentWorkspaceId, logout } = useAuthStore();

  return (
    <div className="flex min-h-screen bg-black text-[#F8FAFC]">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#27272a] bg-[#000000] transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-[#27272a]">
          <Link href="/dashboard" className="flex items-center overflow-hidden">
            <ZenvloLogo collapsed={collapsed} />
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg border border-[#27272a] bg-[#09090b] text-[#A1A1AA] hover:text-[#F8FAFC] hover:border-[#3f3f46] transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex lg:hidden items-center justify-center w-8 h-8 rounded-lg text-[#A1A1AA] hover:text-[#F8FAFC]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!collapsed && (
          <div className="mx-3 my-3 p-2.5 rounded-xl bg-[#09090b] border border-[#27272a] flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-[rgba(16,185,129,0.15)] border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                <Building className="w-4 h-4" />
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                  Default Workspace
                </span>
                <span className="text-[10px] text-[#A1A1AA] font-mono truncate">
                  {currentWorkspaceId ? currentWorkspaceId.slice(0, 8) + '...' : 'Default'}
                </span>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 space-y-1.5 px-3 py-3 overflow-y-auto">
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
                    : 'text-[#A1A1AA] hover:bg-[#09090b] hover:text-[#F8FAFC] border border-transparent'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive ? 'text-[#10B981]' : 'text-[#A1A1AA] group-hover:text-[#F8FAFC]'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && item.badge && (
                  <span
                    className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-[#10B981] text-black'
                        : 'bg-[#18181b] text-[#10B981] border border-[#10B981]/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#27272a] p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-[#18181b] text-[#10B981] font-bold">
                  {user?.email ? user.email.slice(0, 2).toUpperCase() : 'ZE'}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-col truncate">
                  <span className="text-xs font-semibold text-[#F8FAFC] truncate">
                    {user?.email || 'admin@zenvlo.com'}
                  </span>
                  <span className="text-[10px] text-[#A1A1AA]">Admin</span>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#27272a] bg-black/80 px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-[#27272a] bg-[#09090b] text-[#A1A1AA]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#A1A1AA]">
              <span>Zenvlo Engage</span>
              <span>/</span>
              <span className="text-[#F8FAFC] font-medium capitalize">
                {pathname.replace('/', '') || 'Overview'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl border border-[#27272a] bg-[#09090b] text-[#A1A1AA] hover:text-[#F8FAFC] hover:border-[#3f3f46] transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#10B981]" />
            </button>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl border border-[#27272a] bg-[#09090b] text-[#A1A1AA] hover:text-[#F8FAFC] hover:border-[#3f3f46] transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
