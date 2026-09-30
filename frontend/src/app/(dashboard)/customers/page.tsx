'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
  Users,
  UserPlus,
  Upload,
  Search,
  Trash2,
  Edit2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  FileSpreadsheet,
  Send,
  MessageSquare,
  Check,
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  tags: string[];
  last_request_sent_at?: string | null;
  request_count?: number;
  created_on: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Selection & WhatsApp Request states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [batchSending, setBatchSending] = useState(false);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form states
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
    tags: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // CSV Import state
  const [csvContent, setCsvContent] = useState('');
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/customers', {
        params: { search: search || undefined, page, limit: 20 },
      });
      setCustomers(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setForm({ name: '', phone: '', email: '', notes: '', tags: '' });
    setErrorMsg(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      notes: c.notes || '',
      tags: c.tags ? c.tags.join(', ') : '',
    });
    setErrorMsg(null);
    setIsAddOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setErrorMsg('Name and Phone number are required.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      notes: form.notes.trim() || undefined,
      tags: form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    };

    try {
      if (editingCustomer) {
        await apiClient.patch(`/customers/${editingCustomer.id}`, payload);
      } else {
        await apiClient.post('/customers', payload);
      }
      setIsAddOpen(false);
      fetchCustomers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this customer?')) return;
    try {
      await apiClient.delete(`/customers/${id}`);
      fetchCustomers();
    } catch (err) {
      console.error('Failed to delete customer', err);
    }
  };

  const handleImportCsv = async () => {
    if (!csvContent.trim()) {
      setErrorMsg('Please enter or upload CSV data.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setImportSummary(null);

    try {
      const res = await apiClient.post('/customers/import-csv', {
        csv_content: csvContent,
      });
      setImportSummary(res.data);
      fetchCustomers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to import CSV.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleSendSingleRequest = async (c: Customer) => {
    try {
      setSendingId(c.id);
      await apiClient.post('/requests/send', {
        customer_id: c.id,
      });
      setRequestSuccess(`WhatsApp review request dispatched to ${c.name}!`);
      setTimeout(() => setRequestSuccess(null), 3500);
      fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to dispatch WhatsApp request');
    } finally {
      setSendingId(null);
    }
  };

  const handleBatchSendRequests = async () => {
    if (selectedIds.length === 0) return;
    try {
      setBatchSending(true);
      await apiClient.post('/requests/batch', {
        customer_ids: selectedIds,
      });
      setRequestSuccess(`Dispatched WhatsApp requests to ${selectedIds.length} selected contacts!`);
      setTimeout(() => setRequestSuccess(null), 3500);
      setSelectedIds([]);
      fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to dispatch batch WhatsApp requests');
    } finally {
      setBatchSending(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === customers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(customers.map((c) => c.id));
    }
  };

  const toggleSelectCustomer = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Customer Directory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your client contacts for WhatsApp testimonial and review requests
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCsvContent('');
              setImportSummary(null);
              setErrorMsg(null);
              setIsImportOpen(true);
            }}
            className="gap-2 text-xs"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </Button>
          <Button size="sm" onClick={handleOpenAdd} className="gap-2 text-xs font-bold">
            <UserPlus className="w-4 h-4" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, phone, or email..."
              className="pl-9 h-10 text-xs"
            />
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>Total Contacts:</span>
            <span className="font-bold text-foreground">{total}</span>
          </div>
        </CardContent>
      </Card>

      {/* Request Success Banner */}
      {requestSuccess && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{requestSuccess}</span>
        </div>
      )}

      {/* Batch Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="p-3 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-between gap-4">
          <div className="text-xs text-foreground font-semibold flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[10px] font-bold">
              {selectedIds.length}
            </span>
            <span>Contacts Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="h-8 text-xs"
            >
              Clear Selection
            </Button>
            <Button
              size="sm"
              onClick={handleBatchSendRequests}
              disabled={batchSending}
              className="h-8 text-xs font-bold gap-1.5"
            >
              {batchSending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Dispatching...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Send WhatsApp Request ({selectedIds.length})
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Customer List Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#10B981]" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center mx-auto text-muted-foreground">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">No Customers Found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {search
                    ? 'No customers match your search query.'
                    : 'Start building your customer list to send WhatsApp testimonial requests.'}
                </p>
              </div>
              {!search && (
                <Button size="sm" onClick={handleOpenAdd} className="gap-2 text-xs">
                  <UserPlus className="w-3.5 h-3.5" /> Add First Customer
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === customers.length && customers.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-border accent-[#10B981]"
                      />
                    </th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">WhatsApp Phone</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Tags</th>
                    <th className="py-3 px-4">WhatsApp Requests</th>
                    <th className="py-3 px-4">Added On</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((c) => {
                    const isSelected = selectedIds.includes(c.id);
                    const isSendingThis = sendingId === c.id;

                    return (
                      <tr
                        key={c.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-[#10B981]/5' : 'hover:bg-muted/30'
                        }`}
                      >
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectCustomer(c.id)}
                            className="rounded border-border accent-[#10B981]"
                          />
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">{c.name}</td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-[#10B981]" /> {c.phone}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {c.email ? (
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3" /> {c.email}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {c.tags && c.tags.length > 0 ? (
                              c.tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="text-[10px] py-0 px-2 font-normal"
                                >
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {c.request_count && c.request_count > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                              <span className="font-semibold text-foreground">
                                Sent {c.request_count}x
                              </span>
                              {c.last_request_sent_at && (
                                <span className="text-[10px] text-muted-foreground">
                                  ({new Date(c.last_request_sent_at).toLocaleDateString()})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">Not sent yet</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(c.created_on).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSendSingleRequest(c)}
                              disabled={isSendingThis}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 transition-colors text-[11px] font-medium cursor-pointer disabled:opacity-50"
                              title="Send WhatsApp testimonial request"
                            >
                              {isSendingThis ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Send className="w-3 h-3" />
                              )}
                              <span>Request</span>
                            </button>
                            <button
                              onClick={() => handleOpenEdit(c)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Add / Edit Customer Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveCustomer}>
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </DialogTitle>
              <DialogDescription>
                Customer contact details for sending personalized review requests.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Full Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Meera Nair"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  WhatsApp Phone Number *
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="meera@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Tags (Comma separated)
                </label>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="VIP, Regular, Facial"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Internal Notes</label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Visited clinic on Tuesday"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Customer'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#10B981]" /> Import Customers from CSV
            </DialogTitle>
            <DialogDescription>
              Upload or paste a CSV file containing columns: <code className="text-[#10B981]">name, phone, email, tags</code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {importSummary && (
              <div className="p-3.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Import Complete
                </p>
                <p>
                  Successfully imported: <strong>{importSummary.imported}</strong>, Skipped:{' '}
                  <strong>{importSummary.skipped}</strong>
                </p>
                {importSummary.errors.length > 0 && (
                  <ul className="text-red-400 list-disc list-inside mt-2 text-[11px]">
                    {importSummary.errors.slice(0, 3).map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Select File (.csv)</label>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="cursor-pointer text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Or Paste CSV Text</label>
              <textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="name,phone,email,tags&#10;Aarav Gupta,+919811223344,aarav@gmail.com,Regular&#10;Meera Nair,9877112233,meera@gmail.com,New"
                rows={5}
                className="w-full rounded-xl border border-border bg-background p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#10B981]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsImportOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleImportCsv}
              disabled={submitting || !csvContent.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Importing...
                </>
              ) : (
                'Import Customers'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
