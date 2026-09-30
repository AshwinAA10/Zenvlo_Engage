'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';
import { Building, ShieldCheck, User as UserIcon, Loader2, CheckCircle2, AlertCircle, ExternalLink, UploadCloud, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const { user, business, setBusiness } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    category: '',
    phone: '',
    website: '',
    location: '',
    logo_url: '',
  });

  useEffect(() => {
    setMounted(true);
    const loadProfile = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/business/profile');
        if (res.data) {
          setBusiness(res.data);
          setForm({
            name: res.data.name || '',
            category: res.data.category || '',
            phone: res.data.phone || '',
            website: res.data.website || '',
            location: res.data.location || '',
            logo_url: res.data.logo_url || '',
          });
        }
      } catch {
        if (business) {
          setForm({
            name: business.name || '',
            category: business.category || '',
            phone: business.phone || '',
            website: business.website || '',
            location: business.location || '',
            logo_url: business.logo_url || '',
          });
        }
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [business, setBusiness]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await apiClient.patch('/business/profile', form);
      setBusiness(res.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update business profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Logo image size must not exceed 5MB');
      return;
    }

    setLogoUploading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const res = await apiClient.post('/storage/upload', {
          data: base64,
          filename: file.name,
          category: 'logo',
        });
        setForm((prev) => ({ ...prev, logo_url: res.data.url }));
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to upload logo image');
      } finally {
        setLogoUploading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read logo file');
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings & Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your business branding, contact channels, and account security
        </p>
      </div>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="w-4 h-4 text-[#10B981]" /> Business Profile
            </CardTitle>
            <CardDescription>
              Your public business information displayed on review requests and website widgets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Business profile updated successfully!</span>
              </div>
            )}

            {/* Business Logo Upload */}
            <div className="space-y-2 pb-4 border-b border-border">
              <label className="text-xs font-semibold text-muted-foreground">Business Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl border border-border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt="Business Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building className="w-7 h-7 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center justify-center rounded-xl text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-border bg-card hover:bg-accent text-foreground h-8 px-3">
                      {logoUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 text-[#10B981]" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3.5 h-3.5 mr-1.5 text-[#10B981]" />
                          Upload New Logo
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        disabled={logoUploading || saving}
                        onChange={handleLogoUpload}
                      />
                    </label>
                    {form.logo_url && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30"
                        onClick={() => setForm({ ...form, logo_url: '' })}
                        disabled={logoUploading || saving}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Recommended: Square PNG, JPG, or WebP. Max 5MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Business Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Green Orchid Salon"
                  disabled={loading || saving}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Business Category</label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Salon & Spa"
                  disabled={loading || saving}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">WhatsApp Sender Phone</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  disabled={loading || saving}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Website URL</label>
                <Input
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://example.com"
                  disabled={loading || saving}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Physical Location / City</label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Indiranagar, Bengaluru"
                disabled={loading || saving}
              />
            </div>

            {business?.slug && (
              <div className="p-3.5 rounded-xl bg-muted/60 border border-border flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-foreground">Public Feedback Link:</span>
                  <div className="text-muted-foreground font-mono mt-0.5">
                    /submit/{business.slug}
                  </div>
                </div>
                <div className="text-[10px] text-[#10B981] font-bold uppercase tracking-wider flex items-center gap-1">
                  Active <ExternalLink className="w-3 h-3" />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" size="sm" disabled={saving || loading}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-[#10B981]" /> User Account
          </CardTitle>
          <CardDescription>Account credentials and authenticated session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
              <Input value={user?.email || ''} readOnly className="bg-muted text-xs font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Account Role</label>
              <Input value="Business Owner (Superadmin)" readOnly className="bg-muted text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#10B981]" /> Multi-Tenant Security Status
          </CardTitle>
          <CardDescription>
            Strict server-side tenant isolation enforced via verified JWT context
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span>Tenant Isolation Boundary</span>
            <span className="text-[#10B981] font-semibold">Server-Derived Business Context (JWT)</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span>Client Header Spoofing Protection</span>
            <span className="text-[#10B981] font-semibold">Active (Headers Ignored)</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span>Database Partitioning</span>
            <span className="text-[#10B981] font-semibold">TypeORM Active Record (TenantBaseEntity)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
