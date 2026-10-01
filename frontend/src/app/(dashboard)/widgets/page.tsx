'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/axios';
import {
  Layout,
  Plus,
  Code,
  ExternalLink,
  Edit3,
  Trash2,
  Eye,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  Star,
  Palette,
  Layers,
  SlidersHorizontal,
  Sliders,
  AlertCircle,
  Loader2,
  Maximize2,
  Columns,
  GalleryHorizontal,
  Award,
} from 'lucide-react';

interface WidgetItem {
  id: string;
  name: string;
  type: 'WALL' | 'CAROUSEL' | 'BADGE';
  theme: 'LIGHT' | 'DARK' | 'AUTO';
  primary_color: string;
  min_rating: number;
  show_google_reviews: boolean;
  show_photos: boolean;
  custom_css: string | null;
  embed_token: string;
  is_active: boolean;
  views_count: number;
  created_on: string;
}

const COLOR_PRESETS = [
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Teal', hex: '#14b8a6' },
];

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<WidgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Create / Edit modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetItem | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'WALL' | 'CAROUSEL' | 'BADGE'>('WALL');
  const [formTheme, setFormTheme] = useState<'LIGHT' | 'DARK' | 'AUTO'>('DARK');
  const [formColor, setFormColor] = useState('#10b981');
  const [formMinRating, setFormMinRating] = useState(4);
  const [formShowGoogle, setFormShowGoogle] = useState(true);
  const [formShowPhotos, setFormShowPhotos] = useState(true);
  const [formCustomCss, setFormCustomCss] = useState('');

  // Embed Code dialog state
  const [embedOpen, setEmbedOpen] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<WidgetItem | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'script' | 'iframe' | 'react' | 'link'>('script');
  const [copied, setCopied] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Base URLs
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const fetchWidgets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/widgets');
      setWidgets(res.data);
    } catch (err) {
      console.error('Failed to load widgets', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWidgets();
  }, [fetchWidgets]);

  const openCreateModal = () => {
    setEditingWidget(null);
    setFormName('Wall of Love');
    setFormType('WALL');
    setFormTheme('DARK');
    setFormColor('#10b981');
    setFormMinRating(4);
    setFormShowGoogle(true);
    setFormShowPhotos(true);
    setFormCustomCss('');
    setEditorOpen(true);
  };

  const openEditModal = (widget: WidgetItem) => {
    setEditingWidget(widget);
    setFormName(widget.name);
    setFormType(widget.type);
    setFormTheme(widget.theme);
    setFormColor(widget.primary_color || '#10b981');
    setFormMinRating(widget.min_rating || 1);
    setFormShowGoogle(widget.show_google_reviews ?? true);
    setFormShowPhotos(widget.show_photos ?? true);
    setFormCustomCss(widget.custom_css || '');
    setEditorOpen(true);
  };

  const handleSaveWidget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      setActionLoading(true);
      const payload = {
        name: formName.trim(),
        type: formType,
        theme: formTheme,
        primary_color: formColor,
        min_rating: formMinRating,
        show_google_reviews: formShowGoogle,
        show_photos: formShowPhotos,
        custom_css: formCustomCss.trim() || undefined,
      };

      if (editingWidget) {
        await apiClient.patch(`/widgets/${editingWidget.id}`, payload);
      } else {
        await apiClient.post('/widgets', payload);
      }

      setEditorOpen(false);
      await fetchWidgets();
    } catch (err: any) {
      console.error('Failed to save widget', err);
      alert(err.response?.data?.message || 'Failed to save widget');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWidget = async () => {
    if (!deleteId) return;
    try {
      setActionLoading(true);
      await apiClient.delete(`/widgets/${deleteId}`);
      setDeleteId(null);
      await fetchWidgets();
    } catch (err) {
      console.error('Failed to delete widget', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate snippets for embed modal
  const getEmbedScript = (w: WidgetItem) => {
    return `<!-- Zenvlo Engage Testimonial Widget -->
<div id="zenvlo-engage-widget" data-widget-id="${w.id}"></div>
<script src="${apiBaseUrl}/widgets/embed.js" async></script>`;
  };

  const getEmbedIframe = (w: WidgetItem) => {
    return `<iframe
  src="${baseUrl}/embed/${w.id}"
  width="100%"
  height="${w.type === 'BADGE' ? '120' : '650'}"
  frameborder="0"
  scrolling="no"
  style="border:none;width:100%;overflow:hidden;"
  title="Zenvlo Engage Social Proof Widget"
></iframe>`;
  };

  const getReactSnippet = (w: WidgetItem) => {
    return `export function SocialProofWidget() {
  return (
    <iframe
      src="${baseUrl}/embed/${w.id}"
      className="w-full ${w.type === 'BADGE' ? 'h-32' : 'min-h-[600px]'} border-0 overflow-hidden"
      title="Zenvlo Engage Widget"
    />
  );
}`;
  };

  const totalViews = widgets.reduce((acc, w) => acc + (w.views_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Website Widgets
            </h1>
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-xs">
              Phase 6
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Embed high-converting social proof widgets, wall of love, and star rating badges on your website.
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/20"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Widget</span>
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Widgets</p>
                <h3 className="text-2xl font-bold text-foreground mt-1">{widgets.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Layout className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Wall of Love, Carousel & Badges</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Embed Views</p>
                <h3 className="text-2xl font-bold text-foreground mt-1">{totalViews}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Eye className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Times your social proof was seen</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Embeds</p>
                <h3 className="text-2xl font-bold text-foreground mt-1">
                  {widgets.filter((w) => w.is_active).length}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Code className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Live website integrations</p>
          </CardContent>
        </Card>
      </div>

      {/* Widget List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Your Embeddable Widgets</h2>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-xl">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            <p className="text-sm">Loading widgets...</p>
          </div>
        ) : widgets.length === 0 ? (
          <Card className="border-dashed border-border/80">
            <CardContent className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">No Widgets Created Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-6">
                Create your first testimonial widget to display approved customer testimonials and Google reviews directly on your website.
              </p>
              <Button
                onClick={openCreateModal}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Wall of Love
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {widgets.map((widget) => (
              <Card
                key={widget.id}
                className="flex flex-col justify-between border-border/70 hover:border-border transition-all duration-200 shadow-sm"
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          {widget.name}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Created {new Date(widget.created_on).toLocaleDateString()}
                        </CardDescription>
                      </div>

                      <Badge
                        variant="secondary"
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
                      >
                        {widget.type}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-3">
                    {/* Widget Attributes Pill Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-secondary/50 flex items-center gap-2">
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-border"
                          style={{ backgroundColor: widget.primary_color || '#10b981' }}
                        />
                        <span className="text-muted-foreground">Color</span>
                      </div>

                      <div className="p-2 rounded-lg bg-secondary/50 flex items-center gap-2">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-muted-foreground">
                          {widget.min_rating ? `${widget.min_rating}+ Stars` : 'All Ratings'}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-secondary/50 flex items-center gap-2">
                        <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Theme: {widget.theme}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-secondary/50 flex items-center gap-2">
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {widget.views_count} views
                        </span>
                      </div>
                    </div>

                    {/* Features badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {widget.show_google_reviews && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                          + Google Reviews
                        </span>
                      )}
                      {widget.show_photos && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                          + Photos
                        </span>
                      )}
                    </div>
                  </CardContent>
                </div>

                {/* Card Actions */}
                <div className="p-4 pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      setSelectedWidget(widget);
                      setActiveCodeTab('script');
                      setEmbedOpen(true);
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                  >
                    <Code className="w-3.5 h-3.5 mr-1.5" />
                    Get Embed Code
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      window.open(`/embed/${widget.id}`, '_blank', 'noopener,noreferrer')
                    }
                    title="Preview widget in new tab"
                    className="px-2.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(widget)}
                    title="Edit widget settings"
                    className="px-2.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteId(widget.id)}
                    title="Delete widget"
                    className="px-2.5 hover:text-red-500 hover:border-red-500/50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* CREATE / EDIT WIDGET MODAL WITH LIVE PREVIEW */}
      {/* ================================================================ */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-500" />
              {editingWidget ? 'Edit Testimonial Widget' : 'Create New Widget'}
            </DialogTitle>
            <DialogDescription>
              Configure the widget layout, colors, and content filters for your website.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveWidget} className="space-y-6 pt-2">
            {/* Widget Name */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">
                Widget Name
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Landing Page Wall of Love"
                required
              />
            </div>

            {/* Layout Type Selector */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-2">
                Layout Style
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Wall of Love */}
                <div
                  onClick={() => setFormType('WALL')}
                  className={`cursor-pointer p-4 rounded-xl border text-left transition-all ${
                    formType === 'WALL'
                      ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                      : 'border-border/80 hover:border-border bg-card'
                  }`}
                >
                  <Columns className="w-6 h-6 text-emerald-500 mb-2" />
                  <h4 className="font-bold text-sm">Wall of Love</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Multi-column masonry grid of reviews. Perfect for dedicated testimonials sections.
                  </p>
                </div>

                {/* Sliding Carousel */}
                <div
                  onClick={() => setFormType('CAROUSEL')}
                  className={`cursor-pointer p-4 rounded-xl border text-left transition-all ${
                    formType === 'CAROUSEL'
                      ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                      : 'border-border/80 hover:border-border bg-card'
                  }`}
                >
                  <GalleryHorizontal className="w-6 h-6 text-emerald-500 mb-2" />
                  <h4 className="font-bold text-sm">Carousel Slider</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Horizontal sliding carousel with swipe & navigation arrows. Fits anywhere.
                  </p>
                </div>

                {/* Rating Badge */}
                <div
                  onClick={() => setFormType('BADGE')}
                  className={`cursor-pointer p-4 rounded-xl border text-left transition-all ${
                    formType === 'BADGE'
                      ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                      : 'border-border/80 hover:border-border bg-card'
                  }`}
                >
                  <Award className="w-6 h-6 text-emerald-500 mb-2" />
                  <h4 className="font-bold text-sm">Star Badge</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Compact social proof pill. Click opens popup modal with verified reviews.
                  </p>
                </div>
              </div>
            </div>

            {/* Theme & Accent Color */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Color Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DARK', 'LIGHT', 'AUTO'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormTheme(t)}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border transition ${
                        formTheme === t
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold'
                          : 'border-border text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {t === 'DARK' ? '🌙 Dark' : t === 'LIGHT' ? '☀️ Light' : '⚙️ Auto'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setFormColor(p.hex)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        formColor === p.hex ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: p.hex }}
                      title={p.name}
                    />
                  ))}
                  <Input
                    type="text"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-24 text-xs font-mono h-8 ml-1"
                    placeholder="#10b981"
                  />
                </div>
              </div>
            </div>

            {/* Content Filters */}
            <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Content & Source Filters
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-foreground block mb-1">
                    Minimum Rating
                  </label>
                  <select
                    value={formMinRating}
                    onChange={(e) => setFormMinRating(Number(e.target.value))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm"
                  >
                    <option value={5}>5 Stars only</option>
                    <option value={4}>4 Stars and above</option>
                    <option value={3}>3 Stars and above</option>
                    <option value={1}>All Ratings (1+)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="showGoogle"
                    checked={formShowGoogle}
                    onChange={(e) => setFormShowGoogle(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-emerald-500 accent-emerald-500"
                  />
                  <label htmlFor="showGoogle" className="text-xs text-foreground cursor-pointer">
                    Include Google reviews
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="showPhotos"
                    checked={formShowPhotos}
                    onChange={(e) => setFormShowPhotos(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-emerald-500 accent-emerald-500"
                  />
                  <label htmlFor="showPhotos" className="text-xs text-foreground cursor-pointer">
                    Show customer photos
                  </label>
                </div>
              </div>
            </div>

            {/* Optional Custom CSS */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Custom CSS (Optional)
              </label>
              <Textarea
                value={formCustomCss}
                onChange={(e) => setFormCustomCss(e.target.value)}
                placeholder="/* Injected custom styles, e.g. .card { border-radius: 20px; } */"
                rows={2}
                className="font-mono text-xs"
              />
            </div>

            {/* Live Interactive Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Live Preview
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Theme: {formTheme} | Accent: {formColor}
                </span>
              </div>

              <div
                className={`p-6 rounded-2xl border transition-all ${
                  formTheme === 'LIGHT'
                    ? 'bg-white text-zinc-900 border-zinc-200'
                    : 'bg-[#09090b] text-zinc-100 border-zinc-800'
                }`}
              >
                {/* Simulated Badge */}
                {formType === 'BADGE' && (
                  <div className="flex justify-center py-2">
                    <div
                      className={`inline-flex items-center gap-3 px-4 py-2 rounded-full border shadow-sm ${
                        formTheme === 'LIGHT'
                          ? 'bg-white border-zinc-200'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
                        style={{ backgroundColor: formColor }}
                      >
                        ★
                      </div>
                      <span className="font-extrabold text-sm">4.9</span>
                      <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
                      <span className="text-xs font-medium">38 verified reviews</span>
                      <span className="text-[11px] font-semibold text-emerald-500">
                        Zenvlo
                      </span>
                    </div>
                  </div>
                )}

                {/* Simulated Carousel */}
                {formType === 'CAROUSEL' && (
                  <div
                    className={`p-5 rounded-xl border ${
                      formTheme === 'LIGHT'
                        ? 'bg-white border-zinc-200'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">
                          A
                        </div>
                        <div>
                          <div className="font-bold text-xs">Aarav Sharma</div>
                          <div className="text-[10px] text-emerald-500 font-semibold">
                            ✓ Verified via Zenvlo
                          </div>
                        </div>
                      </div>
                      <div className="flex text-xs" style={{ color: formColor }}>
                        ★★★★★
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed italic">
                      &ldquo;The WhatsApp automation request made sharing my review completely effortless! Excellent customer support.&rdquo;
                    </p>
                  </div>
                )}

                {/* Simulated Wall */}
                {formType === 'WALL' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={`p-4 rounded-xl border text-xs ${
                        formTheme === 'LIGHT'
                          ? 'bg-white border-zinc-200'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold">Priya Patel</span>
                        <span style={{ color: formColor }}>★★★★★</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        &ldquo;Fast delivery and premium packaging. Absolutely worth every rupee!&rdquo;
                      </p>
                      <div className="text-[9px] text-muted-foreground mt-2">
                        Verified Review • 2 days ago
                      </div>
                    </div>

                    <div
                      className={`p-4 rounded-xl border text-xs ${
                        formTheme === 'LIGHT'
                          ? 'bg-white border-zinc-200'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold">Rahul Verma</span>
                        <span style={{ color: formColor }}>★★★★★</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        &ldquo;Google Places sync imported my review seamlessly. 10/10 experience.&rdquo;
                      </p>
                      <div className="text-[9px] text-blue-500 mt-2">
                        Google Review • 1 week ago
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditorOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editingWidget ? 'Update Widget' : 'Save & Generate Code'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* GET EMBED CODE DIALOG */}
      {/* ================================================================ */}
      <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Code className="w-5 h-5 text-emerald-500" />
              Embed &ldquo;{selectedWidget?.name}&rdquo;
            </DialogTitle>
            <DialogDescription>
              Copy and paste this snippet anywhere on your website. No coding required.
            </DialogDescription>
          </DialogHeader>

          {selectedWidget && (
            <div className="space-y-4 pt-1">
              {/* Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-secondary/60 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('script')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                    activeCodeTab === 'script'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Universal Script
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('iframe')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                    activeCodeTab === 'iframe'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Direct Iframe
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('react')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                    activeCodeTab === 'react'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  React / Next.js
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('link')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                    activeCodeTab === 'link'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Direct Link
                </button>
              </div>

              {/* Code Box */}
              <div className="relative">
                <pre className="p-4 rounded-xl bg-zinc-950 text-zinc-200 border border-zinc-800 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48 leading-relaxed">
                  {activeCodeTab === 'script' && getEmbedScript(selectedWidget)}
                  {activeCodeTab === 'iframe' && getEmbedIframe(selectedWidget)}
                  {activeCodeTab === 'react' && getReactSnippet(selectedWidget)}
                  {activeCodeTab === 'link' && `${baseUrl}/embed/${selectedWidget.id}`}
                </pre>

                <Button
                  size="sm"
                  onClick={() => {
                    const code =
                      activeCodeTab === 'script'
                        ? getEmbedScript(selectedWidget)
                        : activeCodeTab === 'iframe'
                        ? getEmbedIframe(selectedWidget)
                        : activeCodeTab === 'react'
                        ? getReactSnippet(selectedWidget)
                        : `${baseUrl}/embed/${selectedWidget.id}`;
                    handleCopyCode(code);
                  }}
                  className="absolute top-2.5 right-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 shadow"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy Code
                    </>
                  )}
                </Button>
              </div>

              {/* Instructions */}
              <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/50 text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Quick Installation:
                </div>
                {activeCodeTab === 'script' && (
                  <p>
                    Paste this snippet before the closing <code className="text-emerald-400 font-mono">&lt;/body&gt;</code> tag or inside your HTML block in Webflow, Shopify, WordPress, or Framer. It automatically resizes to fit your reviews without scrollbars.
                  </p>
                )}
                {activeCodeTab === 'iframe' && (
                  <p>
                    Paste into Notion, Wix, Squarespace, or any custom CMS iframe block.
                  </p>
                )}
                {activeCodeTab === 'react' && (
                  <p>
                    Drop into any Next.js or React component tree.
                  </p>
                )}
                {activeCodeTab === 'link' && (
                  <p>
                    Direct standalone review URL to share with partners or link in your marketing emails.
                  </p>
                )}
              </div>

              {/* Direct preview link */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(`/embed/${selectedWidget.id}`, '_blank', 'noopener,noreferrer')
                  }
                  className="text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Open Live Standalone Preview
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEmbedOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* DELETE CONFIRMATION DIALOG */}
      {/* ================================================================ */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-500 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Delete Widget?
            </DialogTitle>
            <DialogDescription>
              Any website currently displaying this embed will stop showing reviews. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteWidget}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete Widget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
