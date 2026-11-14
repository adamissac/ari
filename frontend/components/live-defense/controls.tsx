'use client';

import type { ConnectedApplication, EmergencyStop, LiveControl } from '@hackatl/frontend-transport';
import { useState } from 'react';
import { AuthorizeControlForm } from '@/components/live-defense/authorize';
import { OwnedTestBanner, SourceTag } from '@/components/live-defense/common';
import { Async, Button, Empty, ErrorState, Field, inputClass, Mono, Panel, Tag, Time } from '@/components/ui';
import { api } from '@/lib/api';
import {
  controlKindLabel,
  isActiveControl,
  isPendingControl,
  ttlRemaining,
  type LiveDefenseMode,
} from '@/lib/live-defense';
import type { Resource } from '@/lib/use-resource';

export function ControlsDashboard({
  mode,
  projectId,
  apps,
  controls,
  stops,
  onChange,
}: {
  mode: LiveDefenseMode;
  projectId: string | null;
  apps?: Resource<{ items: ConnectedApplication[] }>;
  controls?: Resource<{ items: LiveControl[]; label: string }>;
  stops?: Resource<{ items: EmergencyStop[]; active: boolean }>;
  onChange?: () => void;
}) {
  if (mode === 'layout-preview') {
    return (
      <Panel title="Sample controls chrome" actions={<SourceTag mode="layout-preview" />}>
        <p className="text-sm text-ink" data-testid="live-defense-preview-controls">
          Sample layout. This is not an active control, not a verified owned-test enforcement, and not live telemetry.
          Shadow recommendations stay on Explainability and remain Not executed.
        </p>
      </Panel>
    );
  }
  if (!projectId) return <Empty>Choose a project to authorize owned-test controls.</Empty>;
  const items = controls?.status === 'ready' ? controls.data.items : [];
  const unresolved = items.filter(item => item.unresolved);
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="live-defense-controls">
      <p className="max-w-3xl text-sm text-muted" data-testid="live-defense-tab-intro">A control is a temporary action on your app, such as slowing a noisy source or blocking it. Nothing runs by itself: you authorize each one here, Ari applies it, tests that it worked, and removes it when it expires or you roll it back.</p>
      <OwnedTestBanner />
      <p className="rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm text-ink" data-testid="live-defense-controls-gated-note">
        RL-gated shadow-only apps do not appear here for authorization. The server refuses grants, channels, and execute for those apps even if this form is used.
      </p>
      {unresolved.length > 0 && (
        <p className="rounded-xl border border-warn/60 bg-warn/15 px-4 py-3 text-sm text-warn" data-testid="live-defense-unresolved">
          Unresolved failed control(s) block further actions until rollback or emergency stop is verified.
        </p>
      )}
      <Panel title="Apply a temporary control" actions={<SourceTag mode="live" />}>
        {apps ? (
          <Async resource={apps} label="staging apps">
            {page => <AuthorizeControlForm apps={page.items} onSaved={onChange} />}
          </Async>
        ) : <Empty>Apps were not requested.</Empty>}
      </Panel>
      <Panel title="Waiting to run">
        <p className="mb-2 text-xs text-muted">Authorized by you, not applied yet.</p>
        {controls ? (
          <Async resource={controls} label="pending controls">
            {page => {
              const queued = page.items.filter(item => isPendingControl(item.status));
              return queued.length === 0 ? <Empty>Nothing waiting.</Empty> : (
                <ul className="flex flex-col gap-2">{queued.map(item => <ControlCard key={item.id} control={item} onChange={onChange} />)}</ul>
              );
            }}
          </Async>
        ) : <Empty>Controls were not requested.</Empty>}
      </Panel>
      <Panel title="Running now">
        <p className="mb-2 text-xs text-muted">Applied and tested with real requests against the app. Adapter HTTP 200 is not effectiveness: only the test result counts.</p>
        {controls ? (
          <Async resource={controls} label="active controls">
            {page => {
              const live = page.items.filter(item => isActiveControl(item.status));
              return (
                <>
                  <p className="mb-2 text-xs text-muted">Backend label: {page.label}</p>
                  {live.length === 0 ? <Empty>No control is running.</Empty> : (
                    <ul className="flex flex-col gap-2">{live.map(item => <ControlCard key={item.id} control={item} onChange={onChange} />)}</ul>
                  )}
                </>
              );
            }}
          </Async>
        ) : <Empty>Controls were not requested.</Empty>}
      </Panel>
      <Panel title="Finished">
        <p className="mb-2 text-xs text-muted">Expired, rolled back, rejected, failed or stopped.</p>
        {controls ? (
          <Async resource={controls} label="ended controls">
            {page => {
              const ended = page.items.filter(item => !isPendingControl(item.status) && !isActiveControl(item.status));
              return ended.length === 0 ? <Empty>Nothing finished yet.</Empty> : (
                <ul className="flex flex-col gap-2">{ended.map(item => <ControlCard key={item.id} control={item} onChange={onChange} />)}</ul>
              );
            }}
          </Async>
        ) : <Empty>Controls were not requested.</Empty>}
      </Panel>
      <EmergencyStopPanel projectId={projectId} stops={stops} onChange={onChange} />
    </div>
  );
}

function ControlCard({ control, onChange }: { control: LiveControl; onChange?: () => void }) {
  const [error, setError] = useState<unknown>(null);
  const rollback = async () => {
    setError(null);
    try {
      await api().rollbackLiveControl(control.id, { reason: 'analyst rollback from owned-test dashboard' });
      onChange?.();
    } catch (err) {
      setError(err);
    }
  };
  const canRollback = control.status === 'verified' || control.status === 'failed' || control.status === 'executing';
  return (
    <li className="rounded-md border border-line bg-panel-2 p-3 text-sm text-ink" data-testid={`live-defense-control-${control.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{controlKindLabel(control.kind)}</span>
        <Tag tone={control.environment_label === 'PRODUCTION' ? 'warn' : 'ok'}>{control.environment_label}</Tag>
        <Tag>{control.status.replaceAll('_', ' ')}</Tag>
        <Tag tone="info">origin {control.origin}</Tag>
        {control.simulated === false && <Tag>not sample</Tag>}
        {control.unresolved && <Tag tone="warn">unresolved</Tag>}
      </div>
      <p className="mt-1 text-xs text-muted">
        target {control.target.type} {control.target.value || '—'} · duration {control.duration_s}s · TTL {ttlRemaining(control.expires_at)}
      </p>
      <p className="mt-1 text-xs text-muted">
        requested <Time iso={control.requested_at} />
        {control.expires_at && <> · expires <Time iso={control.expires_at} /></>}
      </p>
      {control.verification && (
        <p className="mt-1 text-xs" data-testid={`live-defense-verify-${control.id}`}>
          observed effect: {control.verification.observed_effect ? 'yes' : 'no'} ·
          adapter HTTP {control.verification.adapter_http_status ?? 'unavailable'} ·
          probes [{control.verification.probe_http_statuses.join(', ') || 'none'}] ·
          {control.verification.adapter_http_200_is_not_effectiveness ? ' HTTP 200 is not effectiveness' : ''}
        </p>
      )}
      <p className="mt-1 text-xs text-muted">{control.caveat}</p>
      {canRollback && (
        <Button className="mt-2 !px-2 !py-0.5 text-xs" onClick={() => void rollback()}>Request rollback</Button>
      )}
      {error !== null && <div className="mt-2"><ErrorState error={error} /></div>}
    </li>
  );
}

function EmergencyStopPanel({
  projectId,
  stops,
  onChange,
}: {
  projectId: string;
  stops?: Resource<{ items: EmergencyStop[]; active: boolean }>;
  onChange?: () => void;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);
  const engage = async () => {
    setError(null);
    try {
      await api().createEmergencyStop(projectId, { application_id: null, note: note.trim() ? note.trim() : null });
      onChange?.();
    } catch (err) {
      setError(err);
    }
  };
  const clear = async (id: string) => {
    setError(null);
    try {
      await api().clearEmergencyStop(id);
      onChange?.();
    } catch (err) {
      setError(err);
    }
  };
  const active = stops?.status === 'ready' ? stops.data.active : false;
  return (
    <Panel title="Emergency stop">
      <p className="text-sm text-muted">
        Stops everything: refuses new controls and removes the running ones. Ari reports it as done only after it has checked the controls are gone.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Note (optional)">
          <input className={inputClass} value={note} onChange={e => setNote(e.target.value)} maxLength={500} />
        </Field>
        <Button variant="danger" onClick={() => void engage()}>Engage emergency stop</Button>
      </div>
      {active && <p className="mt-2 text-sm text-warn" data-testid="live-defense-kill-switch-active">Kill switch is active. New authorizations fail closed.</p>}
      {error !== null && <div className="mt-2"><ErrorState error={error} /></div>}
      {stops ? (
        <Async resource={stops} label="emergency stops">
          {page => page.items.length === 0 ? <p className="mt-3 text-xs text-muted">No emergency stop recorded.</p> : (
            <ul className="mt-3 flex flex-col gap-2">
              {page.items.map(item => (
                <li key={item.id} className="text-xs text-ink" data-testid={`live-defense-stop-${item.id}`}>
                  <Mono>{item.id}</Mono> · {item.active ? 'active' : 'cleared'} ·
                  verified cleared: {item.verified_cleared ? 'yes' : 'not claimed'} ·
                  <Time iso={item.requested_at} />
                  {item.active && (
                    <Button className="ml-2 !h-6 !px-2 !py-0 text-xs" onClick={() => void clear(item.id)}>Clear kill switch</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Async>
      ) : null}
    </Panel>
  );
}
