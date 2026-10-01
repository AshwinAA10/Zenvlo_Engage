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
import { apiClient } from '@/lib/axios';
import {
  Star,
  RefreshCw,
  Search,
  ExternalLink,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Building,
  Sparkles,
  Phone,
  Globe,
  Plus,
} from 'lucide-react';

interface ReviewSource {
  id: string;
  platform: string;
  external_id: string;
  name: string;
  address: string | null;
  rating: number;
  review_count: number;
  is_active: boolean;
  last_synced_at: string | null;
  metadata: {
    url?: string;
    website?: string;
    phone?: string;
  } | null;
}

interface ReviewItem {
  id: string;
  source_id: string;
  external_id: string;
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  content: string;
  review_date: string;
  original_url: string | null;
  is_visible: boolean;
}

interface ReviewStats {
  average_rating: number;
  total_reviews: number;
  visible_reviews: number;
  distribution: Record<string, number>;
}

interface PlaceSearchResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  rating?: number;
  userRatingsTotal?: number;
}

export default function ReviewsPage() {
  const [mounted, setMounted] = useState(false);
  const [sources, setSources] = useState<ReviewSource[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats>({
    average_rating: 5.0,
    total_reviews: 0,
    visible_reviews: 0,
    distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
  });
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<boolean | null>(null);

  // Connect Place Modal
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [connectingPlaceId, setConnectingPlaceId] = useState<string | null>(null);
  const [connectSuccess, setConnectSuccess] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const fetchReviewsAndSources = useCallback(async () => {
    try {
      setLoading(true);
      const [sourcesRes, reviewsRes, statsRes] = await Promise.all([
        apiClient.get('/reviews/sources'),
        apiClient.get('/reviews', {
          params: {
            search: search || undefined,
            rating: ratingFilter || undefined,
            is_visible: visibilityFilter !== null ? visibilityFilter : undefined,
            limit: 50,
          },
        }),
        apiClient.get('/reviews/stats'),
      ]);

      setSources(sourcesRes.data || []);
      setReviews(reviewsRes.data.data || []);
      setStats(statsRes.data || {
        average_rating: 5.0,
        total_reviews: 0,
        visible_reviews: 0,
        distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
      });
    } catch (err) {
      console.error('Failed to load reviews data', err);
    } finally {
      setLoading(false);
    }
  }, [search, ratingFilter, visibilityFilter]);

  useEffect(() => {
    setMounted(true);
    fetchReviewsAndSources();
  }, [fetchReviewsAndSources]);

  const handleSearchPlaces = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeQuery.trim()) return;

    setSearchingPlaces(true);
    setConnectError(null);
    try {
      const res = await apiClient.get('/reviews/places/search', {
        params: { query: placeQuery.trim() },
      });
      setSearchResults(res.data || []);
      if ((res.data || []).length === 0) {
        setConnectError('No places found. Please try adding city or location (e.g., "Indiranagar Bengaluru").');
      }
    } catch (err: any) {
      setConnectError(err.response?.data?.message || 'Failed to search places.');
    } finally {
      setSearchingPlaces(false);
    }
  };

  const handleConnectPlace = async (placeId: string) => {
    setConnectingPlaceId(placeId);
    setConnectError(null);
    setConnectSuccess(null);

    try {
      const res = await apiClient.post('/reviews/sources/connect', {
        place_id: placeId,
      });

      setConnectSuccess(`Connected ${res.data.source.name} and imported ${res.data.reviewsImported} reviews!`);
      setTimeout(() => {
        setIsConnectOpen(false);
        setConnectSuccess(null);
        setSearchResults([]);
        setPlaceQuery('');
        fetchReviewsAndSources();
      }, 1500);
    } catch (err: any) {
      setConnectError(err.response?.data?.message || 'Failed to connect Google Place.');
    } finally {
      setConnectingPlaceId(null);
    }
  };

  const handleSyncSource = async (sourceId: string) => {
    try {
      setSyncingId(sourceId);
      await apiClient.post(`/reviews/sources/${sourceId}/sync`);
      fetchReviewsAndSources();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to refresh Google reviews.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleToggleVisibility = async (reviewId: string, current: boolean) => {
    try {
      setTogglingId(reviewId);
      // Optimistic update
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, is_visible: !current } : r)),
      );

      await apiClient.patch(`/reviews/${reviewId}/visibility`, {
        is_visible: !current,
      });

      // Refresh stats
      const statsRes = await apiClient.get('/reviews/stats');
      setStats(statsRes.data);
    } catch (err: any) {
      // Revert on error
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, is_visible: current } : r)),
      );
      alert('Failed to update review visibility.');
    } finally {
      setTogglingId(null);
    }
  };

  if (!mounted) return null;

  const connectedSource = sources[0] || null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-lg">
              G
            </span>
            Google Reviews & Place Integration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your Google Place listing, import verified reviews, and curate social proof for website widgets
          </p>
        </div>

        <div className="flex items-center gap-3">
          {connectedSource ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSyncSource(connectedSource.id)}
              disabled={syncingId === connectedSource.id}
              className="gap-2 text-xs"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncingId === connectedSource.id ? 'animate-spin' : ''}`}
              />
              <span>{syncingId === connectedSource.id ? 'Refreshing...' : 'Sync Reviews'}</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setSearchResults([]);
                setConnectError(null);
                setConnectSuccess(null);
                setIsConnectOpen(true);
              }}
              className="gap-2 text-xs font-bold"
            >
              <Plus className="w-4 h-4" /> Connect Google Place
            </Button>
          )}
        </div>
      </div>

      {/* Connected Place Card / Connect Prompt Banner */}
      {connectedSource ? (
        <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#4285F4]/10 border border-[#4285F4]/20 flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-[#4285F4]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">{connectedSource.name}</h3>
                  <Badge
                    variant="secondary"
                    className="bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 text-[10px] gap-1 font-semibold"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 shrink-0" /> {connectedSource.address || 'Address registered on Google Places'}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-bold text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400" /> {connectedSource.rating}
                  </span>
                  <span>•</span>
                  <span>{connectedSource.review_count} Google Reviews</span>
                  {connectedSource.last_synced_at && (
                    <>
                      <span>•</span>
                      <span>Synced {new Date(connectedSource.last_synced_at).toLocaleTimeString()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              {connectedSource.metadata?.url && (
                <a
                  href={connectedSource.metadata.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs text-foreground transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" /> Google Maps
                </a>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchResults([]);
                  setConnectError(null);
                  setConnectSuccess(null);
                  setIsConnectOpen(true);
                }}
                className="text-xs h-8"
              >
                Change Place
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-gradient-to-r from-blue-500/5 via-card to-card p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Google Places Read-Only Sync
              </span>
              <h3 className="text-lg font-bold text-foreground">
                Connect your Google Business Listing
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Seamlessly import verified Google reviews, monitor aggregate star ratings, and display authentic Google proof on your website widgets without waiting for Google Business Profile OAuth approval.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setSearchResults([]);
                setConnectError(null);
                setConnectSuccess(null);
                setIsConnectOpen(true);
              }}
              className="gap-2 text-xs font-bold shrink-0"
            >
              <Plus className="w-4 h-4" /> Connect Google Place
            </Button>
          </div>
        </Card>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Google Average Rating</p>
              <h3 className="text-2xl font-bold text-amber-400 mt-1 flex items-center gap-1">
                {stats.average_rating} <Star className="w-5 h-5 fill-amber-400 text-amber-400 inline" />
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Based on imported reviews</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Star className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Imported Reviews</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{stats.total_reviews}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Verified Google customers</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-base">
              G
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active in Widgets</p>
              <h3 className="text-2xl font-bold text-[#10B981] mt-1">{stats.visible_reviews}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Enabled for public embeds</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center text-[#10B981]">
              <Eye className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">5-Star Satisfaction</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                {stats.total_reviews > 0
                  ? Math.round(((stats.distribution['5'] || 0) / stats.total_reviews) * 100)
                  : 100}%
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stats.distribution['5'] || 0} top-rated reviews
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews Table & Filter Card */}
      <Card className="border-border">
        <CardHeader className="p-4 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant={ratingFilter === null && visibilityFilter === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setRatingFilter(null);
                setVisibilityFilter(null);
              }}
              className="h-8 text-xs px-3"
            >
              All Reviews
            </Button>
            <Button
              variant={ratingFilter === 5 ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setRatingFilter(ratingFilter === 5 ? null : 5);
                setVisibilityFilter(null);
              }}
              className="h-8 text-xs px-3"
            >
              5 ★ ({stats.distribution['5'] || 0})
            </Button>
            <Button
              variant={ratingFilter === 4 ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setRatingFilter(ratingFilter === 4 ? null : 4);
                setVisibilityFilter(null);
              }}
              className="h-8 text-xs px-3"
            >
              4 ★ ({stats.distribution['4'] || 0})
            </Button>
            <Button
              variant={visibilityFilter === true ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setVisibilityFilter(visibilityFilter === true ? null : true);
                setRatingFilter(null);
              }}
              className="h-8 text-xs px-3"
            >
              In Widget ({stats.visible_reviews})
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search review content or reviewer..."
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReviewsAndSources}
              className="h-8 px-2.5 text-xs text-muted-foreground"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#10B981]" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto text-muted-foreground">
                <Star className="w-6 h-6 text-amber-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">No Google Reviews Found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {search
                    ? 'No reviews match your search query.'
                    : 'Connect your Google Place listing to automatically import customer reviews.'}
                </p>
              </div>
              {!search && !connectedSource && (
                <Button size="sm" onClick={() => setIsConnectOpen(true)} className="gap-2 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Connect Google Place
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Reviewer</th>
                    <th className="py-3 px-4">Rating</th>
                    <th className="py-3 px-4 max-w-md">Feedback Content</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Widget Visibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reviews.map((r) => {
                    const isTogglingThis = togglingId === r.id;

                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {r.author_photo_url ? (
                              <img
                                src={r.author_photo_url}
                                alt={r.author_name}
                                className="w-7 h-7 rounded-full object-cover border border-border"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-xs">
                                {r.author_name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-foreground">{r.author_name}</div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                Verified Google Review
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3.5 h-3.5 ${
                                  star <= r.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-muted-foreground/30'
                                }`}
                              />
                            ))}
                          </div>
                        </td>

                        <td className="py-3 px-4 max-w-md">
                          <p className="text-foreground leading-relaxed line-clamp-2">{r.content}</p>
                        </td>

                        <td className="py-3 px-4">
                          <Badge
                            variant="secondary"
                            className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] gap-1 font-medium"
                          >
                            Google Places
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(r.review_date).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleToggleVisibility(r.id, r.is_visible)}
                            disabled={isTogglingThis}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                              r.is_visible
                                ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/20'
                                : 'bg-muted text-muted-foreground border-border hover:text-foreground'
                            }`}
                            title={r.is_visible ? 'Visible in website widgets' : 'Hidden from website widgets'}
                          >
                            {isTogglingThis ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : r.is_visible ? (
                              <>
                                <Eye className="w-3 h-3" /> Included
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" /> Hidden
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connect Place Modal */}
      <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
                G
              </span>
              Connect Google Place Listing
            </DialogTitle>
            <DialogDescription>
              Search for your business on Google Places to import verified reviews and aggregate ratings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {connectError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{connectError}</span>
              </div>
            )}

            {connectSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{connectSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSearchPlaces} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  placeholder="e.g. Green Orchid Salon Indiranagar Bengaluru"
                  className="pl-9 text-xs h-10"
                  autoFocus
                />
              </div>
              <Button type="submit" size="sm" disabled={searchingPlaces || !placeQuery.trim()}>
                {searchingPlaces ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </Button>
            </form>

            {/* Results list */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Matching Places Found:
                </div>
                {searchResults.map((p) => {
                  const isConnectingThis = connectingPlaceId === p.placeId;

                  return (
                    <div
                      key={p.placeId}
                      className="p-3.5 rounded-xl border border-border bg-card hover:border-[#10B981]/40 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="font-semibold text-xs text-foreground truncate">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{p.formattedAddress}</div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
                          <span className="font-bold text-amber-400 flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400" /> {p.rating || 0}
                          </span>
                          <span>•</span>
                          <span>{p.userRatingsTotal || 0} reviews</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleConnectPlace(p.placeId)}
                        disabled={isConnectingThis}
                        className="h-8 text-xs shrink-0 font-medium"
                      >
                        {isConnectingThis ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Importing...
                          </>
                        ) : (
                          'Connect'
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsConnectOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
