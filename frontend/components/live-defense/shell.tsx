'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { EnforcementNote, PreviewBanner, SourceTag } from '@/components/live-defense/common';
import { Details } from '@/components/ui';
import { liveDefenseHref, liveDefenseMode, liveDefenseTab, SHADOW_VS_CONTROLS_COPY, withLiveDefenseMode, type LiveDefenseMode } from '@/lib/live-defense';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'apps', label: 'Apps' },
  { id: 'controls', label: 'Controls' },
] as const;
/** For whoever runs the pilot; kept reachable, out of the owner's way. */
const ADVANCED = [
  { id: 'explain', label: 'Explainability' },
  { id: 'first-responder', label: 'First responder' },
  { id: 'readiness', label: 'Readiness' },
  { id: 'executions', label: 'Executions' },
] as const;

export function LiveDefenseShell({
  projectId,
  children,
  standalone = false,
}: {
  projectId: string | null;
  children: ReactNode;
  standalone?: boolean;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const mode: LiveDefenseMode = standalone ? 'layout-preview' : liveDefenseMode(params.get('preview'));
  const tab = liveDefenseTab(pathname);
  const toggle = () => {
    if (standalone) return;
    const next: LiveDefenseMode = mode === 'live' ? 'layout-preview' : 'live';
    router.replace(withLiveDefenseMode(pathname, next));
  };

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="live-defense" data-mode={mode}>
      <header className="monitor-head" data-testid="live-defense-head">
        <div>
          <p className="text-sm text-white/70">Live Defense</p>
          <h2 className="mt-1 text-xl font-medium text-white">Watches your running app for attacks, around the clock</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/80">Ari records what it sees and what it would do about it. It acts only through a control you authorize.</p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <SourceTag mode={mode} />
          {!standalone && (
            <button
              type="button"
              className="text-sm text-white/70 underline-offset-2 hover:text-white hover:underline"
              data-testid="live-defense-preview-toggle"
              aria-pressed={mode === 'layout-preview'}
              onClick={toggle}
            >
              {mode === 'layout-preview' ? 'Leave sample layout' : 'Open sample layout'}
            </button>
          )}
        </div>
      </header>
      {mode === 'layout-preview' && <PreviewBanner />}
      <nav aria-label="Live Defense" className="ld-tabs">
        {TABS.map(item => {
          const href = liveDefenseHref(standalone ? null : projectId, item.id, mode);
          const active = tab === item.id;
          return (
            <Link key={item.id} href={href} aria-current={active ? 'page' : undefined} className="ld-tab">
              {item.label}
            </Link>
          );
        })}
        <span className="ld-tabs-advanced">
          <span className="text-xs text-faint">Advanced</span>
          {ADVANCED.map(item => (
            <Link key={item.id} href={liveDefenseHref(standalone ? null : projectId, item.id, mode)} aria-current={tab === item.id ? 'page' : undefined} className="ld-tab ld-tab-quiet">
              {item.label}
            </Link>
          ))}
        </span>
      </nav>
      {children}
      <Details summary="Safety boundaries">
        <p data-testid="live-defense-shadow-vs-controls">{SHADOW_VS_CONTROLS_COPY}</p>
        <EnforcementNote />
        <p>Shadow recommendations stay Not executed. A separate owner authorization can apply a temporary control only on a registered owned-test loopback app after the deterministic gate. Production is not granted. RL cannot execute without that authorization.</p>
      </Details>
    </div>
  );
}
