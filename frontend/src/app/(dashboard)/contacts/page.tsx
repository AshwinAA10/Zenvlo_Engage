'use client';

import React, { useState } from 'react';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Plus, Upload, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function ContactsPage() {
  const [contacts] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contacts & Audiences</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage tenant-scoped subscriber profiles, phone numbers, and custom metadata
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="w-4 h-4" /> Import CSV
          </Button>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Add Contact
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, phone, or tags..." className="pl-9" />
        </div>
      </div>

      {contacts.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="flex flex-col items-center justify-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center text-[#10B981] mb-4">
              <Users className="w-6 h-6" />
            </div>
            <CardTitle className="text-lg">No Contacts Registered</CardTitle>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Add individual contacts or import your audience to segment recipients and
              trigger automated messaging workflows.
            </p>
            <Button size="sm" className="mt-6 gap-2">
              <Plus className="w-4 h-4" /> Add First Contact
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
