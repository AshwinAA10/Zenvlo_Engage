'use client';

import React, { useState } from 'react';

interface ZenvloLogoProps {
  collapsed?: boolean;
  className?: string;
}

export function ZenvloLogo({ collapsed = false, className = '' }: ZenvloLogoProps) {
  const [imageError, setImageError] = useState(false);

  if (collapsed) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        {!imageError ? (
          <img
            src="/favicon.png"
            alt="Zenvlo Engage"
            className="w-8 h-8 rounded-lg object-contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center shadow-[0_2px_10px_rgba(16,185,129,0.2)]">
            <svg
              className="w-5 h-5 text-[#10B981]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {!imageError ? (
        <img
          src="/logo.png"
          alt="Zenvlo Engage"
          className="h-8 max-w-[150px] object-contain"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center shadow-[0_2px_12px_rgba(16,185,129,0.25)]">
            <svg
              className="w-5 h-5 text-[#10B981]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-foreground">ZENVLO</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.15)] text-[#10B981] border border-[#10B981]/30">
                Engage
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground tracking-wider uppercase font-medium">
              Automation Cloud
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
