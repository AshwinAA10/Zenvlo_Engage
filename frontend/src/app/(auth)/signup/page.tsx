'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
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
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const signupSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      business_name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    setServerError(null);
    try {
      const response = await apiClient.post('/auth/signup', data);
      const { access_token, user, business } = response.data;

      setAuth(access_token, user, business);
      setSuccess(true);

      setTimeout(() => {
        if (business) {
          router.push('/dashboard');
        } else {
          router.push('/onboarding');
        }
      }, 500);
    } catch (err: any) {
      setServerError(
        err.response?.data?.message || 'Registration failed. Please check your information and try again.'
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="mb-4">
            <ZenvloLogo />
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Start Collecting Reviews with Zenvlo Engage
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Turn WhatsApp conversations into high-converting website social proof
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle className="text-base">Create Business Account</CardTitle>
              <CardDescription>
                Zero-setup onboarding for local businesses & D2C brands
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {serverError && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Account created successfully! Initializing workspace...</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Business Name</label>
                <Input
                  placeholder="e.g. Lotus Wellness Clinic"
                  disabled={isSubmitting || success}
                  {...register('business_name')}
                />
                {errors.business_name && (
                  <p className="text-xs text-red-500 mt-1">{errors.business_name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">First Name</label>
                  <Input
                    placeholder="Aarav"
                    disabled={isSubmitting || success}
                    {...register('first_name')}
                  />
                  {errors.first_name && (
                    <p className="text-xs text-red-500 mt-1">{errors.first_name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Last Name</label>
                  <Input
                    placeholder="Sharma"
                    disabled={isSubmitting || success}
                    {...register('last_name')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
                <Input
                  type="email"
                  placeholder="owner@business.com"
                  autoComplete="email"
                  disabled={isSubmitting || success}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  autoComplete="new-password"
                  disabled={isSubmitting || success}
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full h-10 font-bold"
                disabled={isSubmitting || success}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Free Account'
                )}
              </Button>

              <div className="text-center text-xs text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="text-[#10B981] hover:underline font-semibold">
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
