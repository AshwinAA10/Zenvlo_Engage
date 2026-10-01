'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Star,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Quote,
  X,
  MessageSquare,
} from 'lucide-react';

interface WidgetData {
  widget: {
    id: string;
    name: string;
    type: 'WALL' | 'CAROUSEL' | 'BADGE';
    theme: 'LIGHT' | 'DARK' | 'AUTO';
    primary_color: string;
    min_rating: number;
    show_google_reviews: boolean;
    show_photos: boolean;
    custom_css: string | null;
  };
  business: {
    id: string;
    name: string;
    slug: string;
  };
  stats: {
    average_rating: number;
    total_reviews: number;
    testimonials_count: number;
    google_reviews_count: number;
  };
  items: Array<{
    id: string;
    source: 'ZENVLO' | 'GOOGLE';
    author_name: string;
    author_photo_url: string | null;
    rating: number;
    content: string;
    photo_url: string | null;
    video_url: string | null;
    is_verified: boolean;
    date: string;
  }>;
}

export default function StandaloneEmbedPage() {
  const params = useParams();
  const widgetId = (params?.id as string) || '';
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carousel state
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Badge modal state
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);

  // Container ref for auto-resize
  const containerRef = useRef<HTMLDivElement>(null);

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  useEffect(() => {
    if (!widgetId) return;

    let isMounted = true;
    setLoading(true);
    fetch(`${apiUrl}/widgets/public/${widgetId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Widget not found or inactive (${res.status})`);
        }
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load widget');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [widgetId, apiUrl]);

  // Post height to parent window for auto-resizing iframe
  useEffect(() => {
    if (!data) return;

    const reportHeight = () => {
      if (typeof window === 'undefined' || !window.parent) return;
      const rootEl = containerRef.current || document.body;
      const height = rootEl.scrollHeight || document.documentElement.scrollHeight;
      window.parent.postMessage(
        {
          zenvloWidgetId: widgetId,
          height: Math.max(height, 80),
        },
        '*',
      );
    };

    reportHeight();

    const resizeObserver = new ResizeObserver(() => {
      reportHeight();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    resizeObserver.observe(document.body);

    window.addEventListener('resize', reportHeight);
    // Extra triggers after images might have loaded
    const timer1 = setTimeout(reportHeight, 300);
    const timer2 = setTimeout(reportHeight, 1000);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', reportHeight);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [data, widgetId, carouselIndex, badgeModalOpen]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center p-8 min-h-[140px] text-zinc-400">
        <div className="flex items-center gap-2 text-sm font-medium animate-pulse">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading Zenvlo Engage widget...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full p-6 text-center text-sm text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl">
        <p className="font-semibold text-zinc-700 dark:text-zinc-300">Widget Unavailable</p>
        <p className="text-xs mt-1 text-zinc-400">{error || 'Could not load widget data.'}</p>
      </div>
    );
  }

  const { widget, business, stats, items } = data;
  const primaryColor = widget.primary_color || '#10b981';

  // Determine dark or light mode based on theme setting
  const isDarkMode =
    widget.theme === 'DARK' ||
    (widget.theme === 'AUTO' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const containerClasses = isDarkMode
    ? 'bg-[#09090b] text-zinc-100 border-zinc-800/80 shadow-2xl'
    : 'bg-white text-zinc-900 border-zinc-200/90 shadow-sm';

  const cardClasses = isDarkMode
    ? 'bg-zinc-900/90 border-zinc-800/80 text-zinc-100 hover:border-zinc-700'
    : 'bg-white border-zinc-200/80 text-zinc-800 hover:border-zinc-300 shadow-sm';

  const secondaryText = isDarkMode ? 'text-zinc-400' : 'text-zinc-500';

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className="w-4 h-4"
            style={{
              fill: star <= rating ? primaryColor : 'transparent',
              color: star <= rating ? primaryColor : isDarkMode ? '#3f3f46' : '#d4d4d8',
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`w-full min-h-full font-sans antialiased transition-colors duration-200 p-2 sm:p-4 select-none ${
        isDarkMode ? 'dark' : ''
      }`}
      style={{
        // Expose custom primary variable for child components
        ['--zenvlo-primary' as any]: primaryColor,
      }}
    >
      {/* Optional custom CSS injected by user */}
      {widget.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: widget.custom_css }} />
      )}

      {/* ============================================================== */}
      {/* 1. BADGE WIDGET TYPE */}
      {/* ============================================================== */}
      {widget.type === 'BADGE' && (
        <div className="flex flex-col items-center justify-center py-2">
          <div
            onClick={() => setBadgeModalOpen(true)}
            className={`cursor-pointer inline-flex items-center gap-3.5 px-4 py-2.5 rounded-full border transition-all hover:scale-[1.02] active:scale-[0.98] ${cardClasses}`}
          >
            {/* Source logo / stars */}
            <div className="flex items-center gap-1.5">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-white"
                style={{ backgroundColor: primaryColor }}
              >
                ★
              </span>
              <span className="font-extrabold text-base tracking-tight">
                {stats.average_rating.toFixed(1)}
              </span>
            </div>

            <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />

            {/* Overlapping customer avatars */}
            <div className="flex -space-x-2">
              {items.slice(0, 3).map((item, idx) => (
                <div
                  key={idx}
                  className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold overflow-hidden"
                >
                  {item.author_photo_url ? (
                    <img
                      src={item.author_photo_url}
                      alt={item.author_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{item.author_name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="text-xs font-medium">
              <span>{stats.total_reviews} verified reviews</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Zenvlo</span>
            </div>
          </div>

          {/* Badge Click Review Modal */}
          {badgeModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
              <div
                className={`relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl ${containerClasses}`}
              >
                <button
                  onClick={() => setBadgeModalOpen(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: primaryColor }}
                  >
                    ★
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{business.name}</h3>
                    <p className={`text-xs ${secondaryText}`}>
                      {stats.total_reviews} Verified Customer Reviews • {stats.average_rating.toFixed(1)} / 5.0
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border ${cardClasses}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs overflow-hidden">
                            {item.author_photo_url ? (
                              <img
                                src={item.author_photo_url}
                                alt={item.author_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              item.author_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-xs">{item.author_name}</span>
                              {item.source === 'GOOGLE' ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-semibold">
                                  Google
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold">
                                  Verified
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] ${secondaryText}`}>
                              {new Date(item.date).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                        {renderStars(item.rating)}
                      </div>
                      <p className="text-xs leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. CAROUSEL WIDGET TYPE */}
      {/* ============================================================== */}
      {widget.type === 'CAROUSEL' && (
        <div className="w-full max-w-4xl mx-auto py-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                ★
              </div>
              <div>
                <h4 className="font-bold text-sm tracking-tight">{business.name}</h4>
                <div className="flex items-center gap-1.5 text-xs">
                  {renderStars(Math.round(stats.average_rating))}
                  <span className="font-bold text-xs">{stats.average_rating.toFixed(1)}</span>
                  <span className={`text-[11px] ${secondaryText}`}>
                    ({stats.total_reviews} reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            {items.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    setCarouselIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))
                  }
                  className={`p-2 rounded-lg border transition ${cardClasses} hover:scale-105 active:scale-95`}
                  aria-label="Previous review"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setCarouselIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))
                  }
                  className={`p-2 rounded-lg border transition ${cardClasses} hover:scale-105 active:scale-95`}
                  aria-label="Next review"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Active Card */}
          {items.length > 0 ? (
            <div className={`p-6 sm:p-7 rounded-2xl border transition-all ${cardClasses}`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-sm overflow-hidden border border-zinc-200 dark:border-zinc-700">
                    {items[carouselIndex].author_photo_url ? (
                      <img
                        src={items[carouselIndex].author_photo_url}
                        alt={items[carouselIndex].author_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      items[carouselIndex].author_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-foreground">
                      {items[carouselIndex].author_name}
                    </h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      {items[carouselIndex].source === 'GOOGLE' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500">
                          Google Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified Customer
                        </span>
                      )}
                      <span className={`text-[11px] ${secondaryText}`}>•</span>
                      <span className={`text-[11px] ${secondaryText}`}>
                        {new Date(items[carouselIndex].date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                {renderStars(items[carouselIndex].rating)}
              </div>

              <div className="relative">
                <Quote className="w-6 h-6 text-zinc-300 dark:text-zinc-700 absolute -top-1 -left-1 opacity-40 pointer-events-none" />
                <p className="text-sm sm:text-base leading-relaxed pl-5 font-normal">
                  {items[carouselIndex].content}
                </p>
              </div>

              {/* Photos attached */}
              {widget.show_photos && items[carouselIndex].photo_url && (
                <div className="mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60">
                  <img
                    src={items[carouselIndex].photo_url!}
                    alt="Customer feedback attachment"
                    className="max-h-56 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className={`p-8 text-center rounded-2xl border ${cardClasses}`}>
              <p className={`text-sm ${secondaryText}`}>No testimonials available yet.</p>
            </div>
          )}

          {/* Dots Indicator */}
          {items.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {items.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCarouselIndex(idx)}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: idx === carouselIndex ? '20px' : '6px',
                    backgroundColor:
                      idx === carouselIndex ? primaryColor : isDarkMode ? '#3f3f46' : '#d4d4d8',
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. WALL OF LOVE WIDGET TYPE */}
      {/* ============================================================== */}
      {widget.type === 'WALL' && (
        <div className="w-full max-w-6xl mx-auto py-2">
          {/* Header summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 px-1 border-b border-zinc-200/60 dark:border-zinc-800/60 pb-4">
            <div>
              <h3 className="font-extrabold text-lg sm:text-xl tracking-tight">
                Customer Reviews for {business.name}
              </h3>
              <p className={`text-xs mt-0.5 ${secondaryText}`}>
                Authentic, verified reviews from genuine customers
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {renderStars(Math.round(stats.average_rating))}
                <span className="font-extrabold text-sm">{stats.average_rating.toFixed(1)}</span>
              </div>
              <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
              <span className={`text-xs font-medium ${secondaryText}`}>
                {stats.total_reviews} reviews
              </span>
            </div>
          </div>

          {/* Grid / Wall */}
          {items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${cardClasses}`}
                >
                  <div>
                    {/* Author & Stars */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs overflow-hidden border border-zinc-200 dark:border-zinc-700">
                          {item.author_photo_url ? (
                            <img
                              src={item.author_photo_url}
                              alt={item.author_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            item.author_name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-xs sm:text-sm">
                            {item.author_name}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {item.source === 'GOOGLE' ? (
                              <span className="text-[10px] font-semibold text-blue-500">
                                Google Review
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-500">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Verified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {renderStars(item.rating)}
                    </div>

                    {/* Review text */}
                    <p className="text-xs sm:text-sm leading-relaxed text-foreground/90">
                      &ldquo;{item.content}&rdquo;
                    </p>

                    {/* Photo attachment if available */}
                    {widget.show_photos && item.photo_url && (
                      <div className="mt-3">
                        <img
                          src={item.photo_url}
                          alt="Customer feedback attachment"
                          className="w-full max-h-48 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800"
                        />
                      </div>
                    )}
                  </div>

                  {/* Date footer */}
                  <div className={`mt-4 pt-3 border-t border-zinc-200/50 dark:border-zinc-800/50 flex items-center justify-between text-[11px] ${secondaryText}`}>
                    <span>
                      {new Date(item.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="opacity-80">Verified Review</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-12 text-center rounded-2xl border ${cardClasses}`}>
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-sm">No reviews found</p>
              <p className={`text-xs mt-1 ${secondaryText}`}>
                Approved reviews will show up here automatically.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* Brand Watermark / Footer */}
      {/* ============================================================== */}
      <div className="flex items-center justify-center gap-1.5 pt-4 pb-2 text-[11px]">
        <span className={secondaryText}>Social proof powered by</span>
        <a
          href="https://zenvlo.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline transition"
          style={{ color: primaryColor }}
        >
          <Sparkles className="w-3 h-3" />
          <span>Zenvlo Engage</span>
        </a>
      </div>
    </div>
  );
}
