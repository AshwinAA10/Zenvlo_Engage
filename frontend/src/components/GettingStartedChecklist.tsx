'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  ArrowRight,
  RotateCw,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/axios';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  action_url: string;
  action_label: string;
  completed: boolean;
  is_optional: boolean;
  status_hint?: string;
}

export interface ChecklistStatus {
  business_id: string;
  total_tasks: number;
  completed_tasks: number;
  progress_percentage: number;
  all_completed: boolean;
  dismissed: boolean;
  collapsed: boolean;
  tasks: ChecklistItem[];
  last_updated_at?: string;
}

interface GettingStartedChecklistProps {
  initialData?: ChecklistStatus | null;
  onRefresh?: () => void;
  className?: string;
}

export function GettingStartedChecklist({
  initialData = null,
  onRefresh,
  className = '',
}: GettingStartedChecklistProps) {
  const [data, setData] = useState<ChecklistStatus | null>(initialData);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchChecklist = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/business/checklist');
      if (res?.data) {
        setData(res.data);
      }
    } catch {
      // In case user has no business profile yet or offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchChecklist();
    } else {
      setData(initialData);
      setLoading(false);
    }
  }, [initialData]);

  const updatePreferences = async (prefs: { dismissed?: boolean; collapsed?: boolean }) => {
    if (!data) return;

    // Optimistic update
    const previous = { ...data };
    setData((prev) => (prev ? { ...prev, ...prefs } : null));

    try {
      setUpdating(true);
      const res = await apiClient.patch('/business/checklist-preferences', prefs);
      if (res?.data) {
        setData(res.data);
      }
      if (onRefresh) {
        onRefresh();
      }
    } catch {
      // Revert if network fails
      setData(previous);
    } finally {
      setUpdating(false);
    }
  };

  if (loading && !data) {
    return (
      <div className={`p-6 rounded-2xl bg-card border border-border animate-pulse ${className}`}>
        <div className="h-4 bg-muted rounded w-1/4 mb-3" />
        <div className="h-2 bg-muted rounded w-full mb-6" />
        <div className="space-y-3">
          <div className="h-12 bg-muted/60 rounded-xl w-full" />
          <div className="h-12 bg-muted/60 rounded-xl w-full" />
          <div className="h-12 bg-muted/60 rounded-xl w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const {
    total_tasks,
    completed_tasks,
    progress_percentage,
    all_completed,
    dismissed,
    collapsed,
    tasks,
  } = data;

  // When dismissed: show unobtrusive recovery toggle pill so user can easily reopen anytime
  if (dismissed) {
    return (
      <div
        role="region"
        aria-label="Getting Started Checklist Minimized"
        className={`p-3.5 px-5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[rgba(16,185,129,0.12)] text-[#10B981] shrink-0">
            {all_completed ? <Trophy className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Getting Started Checklist</span>
              <Badge variant="outline" className="text-[10px] text-[#10B981] border-[#10B981]/30">
                {completed_tasks}/{total_tasks} Completed ({progress_percentage}%)
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {all_completed
                ? 'All foundational setup milestones complete.'
                : `${total_tasks - completed_tasks} step${total_tasks - completed_tasks > 1 ? 's' : ''} remaining to maximize testimonial conversions.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={updating}
            onClick={() => updatePreferences({ dismissed: false })}
            className="text-xs h-8 px-3 gap-1.5"
            aria-label="Show Checklist"
          >
            Show Checklist
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Getting Started Checklist"
      className={`p-6 rounded-2xl bg-card border border-border space-y-5 transition-all ${className}`}
    >
      {/* Header section with progress & controls */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[rgba(16,185,129,0.12)] text-[#10B981]">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-foreground tracking-tight">
              Getting Started Checklist
            </h3>
            {all_completed ? (
              <Badge variant="default" className="gap-1 text-[11px] py-0.5 bg-[#10B981] text-black">
                <Trophy className="w-3 h-3" /> Fully Setup
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[11px] text-[#10B981] border-[#10B981]/30">
                {completed_tasks} of {total_tasks} completed ({progress_percentage}%)
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {all_completed
              ? 'Awesome work! Your reputation engine is configured to collect, manage, and display customer proof.'
              : 'Complete these key steps to get the most value out of your Zenvlo Engage workspace.'}
          </p>
        </div>

        {/* Action Controls: Refresh, Collapse/Expand, Dismiss */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            aria-label="Refresh checklist progress"
            onClick={fetchChecklist}
            disabled={loading || updating}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Refresh progress"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            aria-label={collapsed ? 'Expand checklist' : 'Collapse checklist'}
            onClick={() => updatePreferences({ collapsed: !collapsed })}
            disabled={updating}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            type="button"
            aria-label="Dismiss checklist"
            onClick={() => updatePreferences({ dismissed: true })}
            disabled={updating}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Dismiss checklist"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar (Accessible) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>Overall Progress</span>
          <span className="text-foreground">{progress_percentage}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progress_percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Setup progress: ${completed_tasks} of ${total_tasks} tasks complete`}
          className="w-full bg-muted/60 h-2 rounded-full overflow-hidden"
        >
          <div
            className="bg-[#10B981] h-full transition-all duration-500 rounded-full"
            style={{ width: `${progress_percentage}%` }}
          />
        </div>
      </div>

      {/* Celebration message when all tasks are complete */}
      {all_completed && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-gradient-to-r from-[rgba(16,185,129,0.15)] to-[rgba(16,185,129,0.05)] border border-[#10B981]/30 flex items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-[#10B981] shrink-0" />
            <span className="text-xs font-semibold text-foreground">
              All essential onboarding milestones completed! Your testimonial collection is ready.
            </span>
          </div>
          <Link href="/requests">
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
              Send More Requests <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      )}

      {/* Task List (Visible unless collapsed) */}
      {!collapsed && (
        <div className="space-y-2.5 pt-1">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                task.completed
                  ? 'bg-muted/20 border-border/60'
                  : 'bg-muted/40 border-border hover:border-[#10B981]/40'
              }`}
            >
              {/* Task Left: Icon + Text */}
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {task.completed ? (
                    <CheckCircle2
                      className="w-5 h-5 text-[#10B981]"
                      aria-label="Completed"
                    />
                  ) : (
                    <Circle
                      className="w-5 h-5 text-muted-foreground/60"
                      aria-label="Incomplete"
                    />
                  )}
                </div>

                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-bold ${
                        task.completed ? 'text-foreground line-through opacity-80' : 'text-foreground'
                      }`}
                    >
                      {task.title}
                    </span>
                    {task.is_optional && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                        Optional
                      </span>
                    )}
                    {task.status_hint && (
                      <span className="text-[11px] text-muted-foreground">
                        • {task.status_hint}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                </div>
              </div>

              {/* Task Right: Action Button or Completed status */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {task.completed ? (
                  <Link href={task.action_url}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground gap-1"
                    >
                      View
                    </Button>
                  </Link>
                ) : (
                  <Link href={task.action_url}>
                    <Button
                      size="sm"
                      className="text-xs font-semibold h-7 px-3 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {task.action_label} <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
