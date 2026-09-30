'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiClient } from '@/lib/axios';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Star,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building,
  ShieldCheck,
  Camera,
  Video,
  X,
  UploadCloud,
} from 'lucide-react';
import Link from 'next/link';

interface BusinessInfo {
  id: string;
  name: string;
  slug: string;
  category: string;
  logo_url: string | null;
  location: string | null;
}

const formSchema = z.object({
  rating: z.number().min(1, 'Please select a star rating').max(5),
  content: z.string().min(5, 'Please provide at least 5 characters of feedback'),
  customer_name: z.string().min(2, 'Please enter your name'),
  customer_phone: z.string().optional(),
  customer_email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  consent_given: z.literal(true, {
    errorMap: () => ({ message: 'You must provide consent to publish your review' }),
  }),
});

type FormValues = z.infer<typeof formSchema>;

const starLabels: Record<number, string> = {
  1: 'Terrible experience',
  2: 'Poor experience',
  3: 'Average service',
  4: 'Good & satisfied',
  5: 'Outstanding! Highly recommended',
};

export default function PublicTestimonialPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Optional Media Upload States
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rating: 5,
      content: '',
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      consent_given: true,
    },
  });

  const selectedRating = watch('rating');

  useEffect(() => {
    if (!slug) return;
    const fetchInfo = async () => {
      try {
        setLoadingBusiness(true);
        const res = await apiClient.get(`/testimonials/public/${slug}/info`);
        setBusiness(res.data);
      } catch {
        setNotFound(true);
      } finally {
        setLoadingBusiness(false);
      }
    };
    fetchInfo();
  }, [slug]);

  const handleMediaUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'photo' | 'video',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaError(null);

    // Client-side size checks
    if (type === 'photo' && file.size > 5 * 1024 * 1024) {
      setMediaError('Photo size must not exceed 5MB');
      return;
    }
    if (type === 'video' && file.size > 30 * 1024 * 1024) {
      setMediaError('Video size must not exceed 30MB');
      return;
    }

    if (type === 'photo') setPhotoUploading(true);
    else setVideoUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const res = await apiClient.post('/storage/upload', {
            data: base64,
            filename: file.name,
            category: type,
          });

          if (type === 'photo') {
            setPhotoUrl(res.data.url);
          } else {
            setVideoUrl(res.data.url);
          }
        } catch (err: any) {
          setMediaError(err.response?.data?.message || `Failed to upload ${type}`);
        } finally {
          if (type === 'photo') setPhotoUploading(false);
          else setVideoUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setMediaError(`Failed to process ${type} file`);
      if (type === 'photo') setPhotoUploading(false);
      else setVideoUploading(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      await apiClient.post(`/testimonials/public/${slug}`, {
        rating: data.rating,
        content: data.content,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone || undefined,
        customer_email: data.customer_email || undefined,
        photo_url: photoUrl || undefined,
        video_url: videoUrl || undefined,
        consent_given: true,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setServerError(
        err.response?.data?.message || 'Failed to submit review. Please try again.',
      );
    }
  };

  if (loadingBusiness) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#10B981]" />
          <p className="text-sm text-muted-foreground">Loading review form...</p>
        </div>
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="text-center max-w-md space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto text-muted-foreground">
            <Building className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold">Business Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The testimonial form you are looking for does not exist or has been disabled.
          </p>
          <Link href="/">
            <Button variant="outline" size="sm">
              Visit Zenvlo Engage
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center mx-auto text-[#10B981] animate-in zoom-in-50 duration-300">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Thank You for Your Feedback!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your review for <strong className="text-foreground">{business.name}</strong> has been
              received. Genuine customer feedback helps local businesses grow and serve you better.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-card border border-border text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" /> Verified Customer Submission
            </p>
            <p>Your review is being processed and will be featured on their website soon.</p>
          </div>
          <div className="pt-4 text-xs text-muted-foreground flex items-center justify-center gap-1">
            Powered by{' '}
            <Link href="/" className="font-semibold text-[#10B981] hover:underline">
              Zenvlo Engage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeRating = hoverRating !== null ? hoverRating : selectedRating;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-lg space-y-6">
        {/* Business Branding Header */}
        <div className="flex flex-col items-center text-center">
          {business.logo_url ? (
            <img
              src={business.logo_url}
              alt={business.name}
              className="w-16 h-16 rounded-2xl object-cover border border-border mb-3"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[rgba(16,185,129,0.15)] border border-[#10B981]/30 flex items-center justify-center text-[#10B981] mb-3 font-bold text-xl">
              {business.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {business.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <span className="font-medium text-foreground">{business.category}</span>
            {business.location && (
              <>
                <span>•</span>
                <span>{business.location}</span>
              </>
            )}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg">Share Your Experience</CardTitle>
              <CardDescription>
                How was your recent visit or service? We value your honest feedback!
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {serverError && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              {mediaError && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{mediaError}</span>
                </div>
              )}

              {/* Star Rating Selector */}
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setValue('rating', star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="p-1 focus:outline-none transition-transform hover:scale-110 cursor-pointer"
                      title={`${star} Star`}
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          star <= activeRating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-muted-foreground/30 hover:text-muted-foreground/50'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-semibold text-foreground h-4">
                  {starLabels[activeRating] || ''}
                </span>
                {errors.rating && (
                  <p className="text-xs text-red-500">{errors.rating.message}</p>
                )}
              </div>

              {/* Testimonial Text */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Your Review / Feedback *
                </label>
                <Textarea
                  placeholder="Tell us what you liked most about your experience..."
                  rows={4}
                  disabled={isSubmitting}
                  {...register('content')}
                />
                {errors.content && (
                  <p className="text-xs text-red-500 mt-1">{errors.content.message}</p>
                )}
              </div>

              {/* Optional Photo & Video Upload */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Add Photo or Video (Optional)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Photo Upload Box */}
                  <div className="relative border border-dashed border-border rounded-xl p-3 text-center hover:border-[#10B981]/50 transition-colors bg-muted/20">
                    {photoUrl ? (
                      <div className="relative">
                        <img
                          src={photoUrl}
                          alt="Review preview"
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setPhotoUrl(null)}
                          className="absolute -top-1.5 -right-1.5 p-1 bg-background border border-border text-red-400 rounded-full hover:bg-muted shadow"
                          title="Remove photo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center justify-center py-2 gap-1.5">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleMediaUpload(e, 'photo')}
                          disabled={photoUploading || isSubmitting}
                          className="hidden"
                        />
                        {photoUploading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-[#10B981]" />
                        ) : (
                          <Camera className="w-5 h-5 text-muted-foreground" />
                        )}
                        <span className="text-[11px] font-semibold text-foreground">
                          {photoUploading ? 'Uploading...' : 'Add Photo'}
                        </span>
                        <span className="text-[9px] text-muted-foreground">JPG, PNG, WebP (≤5MB)</span>
                      </label>
                    )}
                  </div>

                  {/* Video Upload Box */}
                  <div className="relative border border-dashed border-border rounded-xl p-3 text-center hover:border-[#10B981]/50 transition-colors bg-muted/20">
                    {videoUrl ? (
                      <div className="relative">
                        <video
                          src={videoUrl}
                          controls
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setVideoUrl(null)}
                          className="absolute -top-1.5 -right-1.5 p-1 bg-background border border-border text-red-400 rounded-full hover:bg-muted shadow"
                          title="Remove video"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center justify-center py-2 gap-1.5">
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          onChange={(e) => handleMediaUpload(e, 'video')}
                          disabled={videoUploading || isSubmitting}
                          className="hidden"
                        />
                        {videoUploading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-[#10B981]" />
                        ) : (
                          <Video className="w-5 h-5 text-muted-foreground" />
                        )}
                        <span className="text-[11px] font-semibold text-foreground">
                          {videoUploading ? 'Uploading...' : 'Add Video'}
                        </span>
                        <span className="text-[9px] text-muted-foreground">MP4, WebM (≤30MB)</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Customer Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Your Name *</label>
                <Input
                  placeholder="e.g. Ananya Roy"
                  disabled={isSubmitting}
                  {...register('customer_name')}
                />
                {errors.customer_name && (
                  <p className="text-xs text-red-500 mt-1">{errors.customer_name.message}</p>
                )}
              </div>

              {/* Phone & Email (Private) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Phone (WhatsApp)
                  </label>
                  <Input
                    placeholder="+91 98765 43210"
                    disabled={isSubmitting}
                    {...register('customer_phone')}
                  />
                  <p className="text-[10px] text-muted-foreground">Kept strictly private</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    disabled={isSubmitting}
                    {...register('customer_email')}
                  />
                  <p className="text-[10px] text-muted-foreground">Optional, kept private</p>
                </div>
              </div>

              {/* Consent Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/40 border border-border cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border text-[#10B981] focus:ring-[#10B981] accent-[#10B981]"
                    disabled={isSubmitting}
                    {...register('consent_given')}
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I confirm this review represents my honest experience. I give permission to{' '}
                    <strong className="text-foreground">{business.name}</strong> to display my
                    feedback, photo/video, and name publicly on their website and marketing widgets.
                  </span>
                </label>
                {errors.consent_given && (
                  <p className="text-xs text-red-500 mt-1">{errors.consent_given.message}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full h-11 font-bold text-sm"
                disabled={isSubmitting || photoUploading || videoUploading}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting review...
                  </>
                ) : (
                  'Submit Review'
                )}
              </Button>

              <div className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                <span>Verified review platform powered by</span>
                <span className="text-foreground font-semibold">Zenvlo Engage</span>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
