import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { RlDecisionActivity, RlRuntimeStatus, RlSmokeSummary } from '@hackatl/frontend-transport';
import { RlRuntimeCard } from '@/components/live-defense/rl-runtime';
import { ReadinessDashboard } from '@/components/live-defense/readiness';

const PIN = '8113a37f4ff9360a9efed2e9f499c4b2ae36e97bfb78372436f97da106fc05f1';

const NOT_LOADED: RlRuntimeStatus = {
  loaded: false,
  label: 'RL runtime: not loaded',
  reason: 'torch is not importable in this backend process: import of torch halted',
  mode: 'shadow, recommendation only',
  checkpoint_path: 'rl-defense/results/live-retrain-v6/candidate_online.pt',
  pinned_sha256: PIN,
  checkpoint_sha256: PIN,
  policy_version: null,
  torch_available: false,
  checked_at: '2026-11-17T08:00:00Z',
};

const LOADED: RlRuntimeStatus = {
  ...NOT_LOADED,
  loaded: true,
  label: 'RL runtime: loaded',
  reason: null,
  policy_version: 'LiveDefense-payments-lite-v3@8113a37f4ff9',
  torch_available: true,
};

const ACTIVITY: RlDecisionActivity = {
  window_hours: 24,
  last_decision_at: '2026-11-17T08:01:00Z',
  last_decision_status: 'ran',
  recommendations: 3,
  abstentions: 2,
  reason: null,
};

const SMOKE: RlSmokeSummary = {
  available: true,
  reason: null,
  source_path: 'rl-defense/runs/live-smoke/summary.json',
  passed: true,
  finished_at: '2026-11-17T08:02:00Z',
  episodes: 1,
  steps: 10,
  transitions_written: 10,
  compromise_rate: 0,
  availability: 0.683,
  checkpoint_sha256: PIN,
  device: 'cpu',
};

afterEach(() => cleanup());

it('renders not loaded with the backend reason and no invented values', () => {
  render(<RlRuntimeCard runtime={NOT_LOADED} decisions={null} smoke={null} />);
  expect(screen.getByTestId('live-defense-rl-runtime-state').textContent).toContain('RL runtime: not loaded');
  expect(screen.getByTestId('live-defense-rl-runtime-reason').textContent).toMatch(/torch is not importable/);
  expect(screen.getByTestId('live-defense-rl-counts').textContent).toMatch(/not available/);
  expect(screen.getByTestId('live-defense-rl-smoke').textContent).toMatch(/not available/);
  expect(screen.getByTestId('live-defense-rl-runtime').textContent).toContain('shadow, recommendation only');
  expect(screen.getByTestId('live-defense-rl-caveat')).toBeTruthy();
  expect(screen.queryByText('RL runtime: loaded')).toBeNull();
});

it('renders a loaded runtime with short hash, 24 hour counts and smoke result', () => {
  render(<RlRuntimeCard runtime={LOADED} decisions={ACTIVITY} smoke={SMOKE} />);
  const card = screen.getByTestId('live-defense-rl-runtime');
  expect(screen.getByTestId('live-defense-rl-runtime-state').textContent).toBe('RL runtime: loaded');
  expect(card.textContent).toContain(PIN.slice(0, 12));
  expect(card.textContent).not.toContain(PIN);
  expect(screen.getByTestId('live-defense-rl-counts').textContent).toBe('3 recommendations, 2 abstentions');
  expect(screen.getByTestId('live-defense-rl-smoke').textContent).toMatch(/passed/);
  expect(screen.getByTestId('live-defense-rl-smoke').textContent).toMatch(/10 transitions/);
  expect(document.body.textContent).toMatch(/simulation-derived recommendation/);
});

it('shows not available with a reason when the backend sent no runtime status', () => {
  render(<RlRuntimeCard unavailableReason="defense-health was not requested" />);
  expect(screen.getByTestId('live-defense-rl-runtime-state').textContent).toBe('not available: defense-health was not requested');
  expect(screen.queryByText(/RL runtime: loaded/)).toBeNull();
});

it('sample readiness layout never claims a loaded runtime', () => {
  render(<ReadinessDashboard mode="layout-preview" projectId={null} />);
  expect(screen.getByTestId('live-defense-rl-runtime-state').textContent).toMatch(/^not available: sample layout/);
});
