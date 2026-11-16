'use client';

import type { ReactNode } from 'react';
import { BRAND_NAME, LogoMark } from '@/components/brand';
import { LiquidBackground } from '@/components/liquid-bg';
import { useMarkAuthStage } from '@/lib/auth-stage-presence';

/**
 * Sign-in layout: the form in a narrow column on the left, where the eye starts, and the hero's
 * contour field with the brand line on the right (desktop only), as split sign-in pages such as
 * Supabase's do. No floating card, glow or orbit decoration.
 */
export function AuthStage({
  kicker = BRAND_NAME,
  title,
  subtitle,
  children,
  footnote,
  testId,
}: {
  kicker?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footnote?: ReactNode;
  testId?: string;
}) {
  useMarkAuthStage();
  return (
    <section className="auth-stage auth-split" aria-labelledby="auth-title">
      <div className="auth-pane">
        <div className="auth-card w-full" data-testid={testId}>
          <div className="flex items-center gap-2.5">
            <LogoMark size={22} decorative priority />
            <p className="auth-kicker text-sm text-muted">{kicker}</p>
          </div>
          <h1 id="auth-title" className="mt-6 text-3xl font-medium tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footnote && <div className="auth-footnote mt-8">{footnote}</div>}
        </div>
      </div>
      <div className="auth-visual" aria-hidden="true">
        <LiquidBackground />
        <p className="auth-visual-line">Find the flaw.<br />Prove the fix.</p>
      </div>
    </section>
  );
}

/** A small padlock for footnotes. */
export function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="7" rx="1.6" />
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" strokeLinecap="round" />
    </svg>
  );
}
