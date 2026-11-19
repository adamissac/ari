'use client';

import type { RlDecisionActivity, RlRuntimeStatus, RlSmokeSummary } from '@hackatl/frontend-transport';
import { SimulationCaveat } from '@/components/live-defense/common';
import { Mono, Panel, Tag, Time } from '@/components/ui';

export const RL_RUNTIME_NOT_AVAILABLE = 'not available';

function NotAvailable({ reason }: { reason: string }) {
  return <span className="text-muted">{RL_RUNTIME_NOT_AVAILABLE}: <span className="text-ink">{reason}</span></span>;
}

function shortHash(value: string): string {
  return value.slice(0, 12);
}

function ratio(value: number | null | undefined): string {
  return value === null || value === undefined ? 'not measured' : value.toFixed(3);
}

export function RlRuntimeCard({
  runtime,
  decisions,
  smoke,
  unavailableReason,
}: {
  runtime?: RlRuntimeStatus | null;
  decisions?: RlDecisionActivity | null;
  smoke?: RlSmokeSummary | null;
  unavailableReason?: string;
}) {
  const missing = unavailableReason ?? 'the backend did not report an RL runtime status';
  return (
    <Panel title="RL runtime">
      <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-3 gap-y-1 text-sm text-ink" data-testid="live-defense-rl-runtime">
        <dt className="text-muted">Runtime</dt>
        <dd data-testid="live-defense-rl-runtime-state">
          {runtime ? (
            <>
              <Tag tone={runtime.loaded ? 'ok' : 'warn'}>{runtime.label}</Tag>
              {runtime.reason && <span className="ml-2 text-xs text-muted" data-testid="live-defense-rl-runtime-reason">{runtime.reason}</span>}
            </>
          ) : <NotAvailable reason={missing} />}
        </dd>
        <dt className="text-muted">Checkpoint</dt>
        <dd>
          {runtime?.checkpoint_sha256
            ? <Mono>{shortHash(runtime.checkpoint_sha256)}</Mono>
            : <NotAvailable reason={runtime ? 'checkpoint file was not readable' : missing} />}
          {runtime && <span className="ml-2 text-xs text-muted">pin <Mono>{shortHash(runtime.pinned_sha256)}</Mono></span>}
        </dd>
        <dt className="text-muted">Mode</dt>
        <dd>{runtime ? runtime.mode : <NotAvailable reason={missing} />}</dd>
        <dt className="text-muted">Last decision</dt>
        <dd data-testid="live-defense-rl-last-decision">
          {decisions?.last_decision_at
            ? <><Time iso={decisions.last_decision_at} />{decisions.last_decision_status && <span className="ml-2 text-xs text-muted">{decisions.last_decision_status}</span>}</>
            : <NotAvailable reason={decisions?.reason ?? missing} />}
        </dd>
        <dt className="text-muted">Last 24 hours</dt>
        <dd data-testid="live-defense-rl-counts">
          {decisions
            ? `${decisions.recommendations} recommendations, ${decisions.abstentions} abstentions`
            : <NotAvailable reason={missing} />}
        </dd>
        <dt className="text-muted">Live-loop smoke</dt>
        <dd data-testid="live-defense-rl-smoke">
          {smoke?.available ? (
            <>
              <Tag tone={smoke.passed ? 'ok' : 'warn'}>{smoke.passed ? 'passed' : 'failed'}</Tag>
              <span className="ml-2 text-xs text-muted">
                {smoke.finished_at && <Time iso={smoke.finished_at} />}
                {` · ${smoke.steps ?? 0} steps, ${smoke.transitions_written ?? 0} transitions, compromise rate ${ratio(smoke.compromise_rate)}, availability ${ratio(smoke.availability)}`}
                {smoke.device && ` · ${smoke.device}`}
              </span>
            </>
          ) : <NotAvailable reason={smoke?.reason ?? missing} />}
        </dd>
      </dl>
      <p className="mt-2 text-xs text-muted">Shadow only. Every decision is a simulation-derived recommendation and is never executed.</p>
      <div className="mt-2"><SimulationCaveat /></div>
    </Panel>
  );
}
