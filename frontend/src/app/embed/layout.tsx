import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Social Proof Widget – Zenvlo Engage',
  description: 'Verified reviews & testimonials powered by Zenvlo Engage.',
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-full min-h-screen bg-transparent">
      {children}
    </div>
  );
}
