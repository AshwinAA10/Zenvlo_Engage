'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ZenvloLogo } from '@/components/ZenvloLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';
import { Loader2, AlertCircle, CheckCircle2, Building, Sparkles } from 'lucide-react';

const onboardingSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  category: z.string().min(1, 'Please select or enter a category'),
  phone: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

const commonCategories = [
  'Salon & Spa',
  'Healthcare & Clinic',
  'Restaurant & Cafe',
  'Fitness & Gym',
  'Professional Services',
  'D2C Brand',
  'Retail Store',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { business, setBusiness } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: business?.name || '',
      category: business?.category || 'Salon & Spa',
      phone: business?.phone || '',
      website: business?.website || '',
      location: business?.location || '',
    },
  });

  const selectedCategory = watch('category');

  const onSubmit = async (data: OnboardingFormValues) => {
    setServerError(null);
    try {
      const response = await apiClient.post('/business/onboarding', data);
      setBusiness(response.data);
      setSuccess(true);

      setTimeout(() => {
        router.push('/dashboard');
      }, 600);
    } catch (err: any) {
      setServerError(
        err.response?.data?.message || 'Failed to complete business setup. Please try again.'
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-xl space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4">
            <ZenvloLogo />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(16,185,129,0.12)] border border-[#10B981]/30 text-[#10B981] text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Complete Business Setup
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Configure Your Business Profile
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            This information will be displayed on your public testimonial forms and website review widgets.
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="w-4 h-4 text-[#10B981]" /> Business Identity
              </CardTitle>
              <CardDescription>
                Provide key details about your business to personalize review requests
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {serverError && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Business profile configured! Launching your Engage Console...</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Business Name</label>
                <Input
                  placeholder="e.g. Aura Aesthetics & Laser Clinic"
                  disabled={isSubmitting || success}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Business Category</label>
                <div className="flex flex-wrap gap-2">
                  {commonCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setValue('category', cat)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        selectedCategory === cat
                          ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40 font-semibold'
                          : 'bg-muted/50 text-muted-foreground border-border hover:border-border/80 hover:text-foreground'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="Or enter custom category"
                  disabled={isSubmitting || success}
                  {...register('category')}
                  className="mt-2"
                />
                {errors.category && (
                  <p className="text-xs text-red-500 mt-1">{errors.category.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Contact Phone (WhatsApp Sender)
                  </label>
                  <Input
                    placeholder="+91 98765 43210"
                    disabled={isSubmitting || success}
                    {...register('phone')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Website Address
                  </label>
                  <Input
                    placeholder="https://auraclinic.in"
                    disabled={isSubmitting || success}
                    {...register('website')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Location / City
                </label>
                <Input
                  placeholder="Indiranagar, Bengaluru, Karnataka"
                  disabled={isSubmitting || success}
                  {...register('location')}
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full h-11 font-bold text-sm"
                disabled={isSubmitting || success}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving profile...
                  </>
                ) : (
                  'Complete Setup & Enter Dashboard'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
