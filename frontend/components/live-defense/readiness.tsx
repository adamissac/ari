'use client';

import type { EvidenceCheckStatus, RlReadinessAssessment } from '@hackatl/frontend-transport';
import { SourceTag } from '@/components/live-defense/common';
import { Async, Empty, Mono, Panel, Tag } from '@/components/ui';
import { RL_BLOCKED_COPY, type LiveDefenseMode } from '@/lib/live-defense';
import type { Resource } from '@/lib/use-resource';

const TONE: Record<EvidenceCheckStatus, 'ok' | 'warn' | 'info'> = {
  PASS: 'ok',
  FAIL: 'warn',
  BLOCKED: 'warn',
  'NOT VERIFIED': 'info',
};

export function ReadinessDashboard({
  mode,
  projectId,
  readiness,
}: {
  mode: LiveDefenseMode;
  projectId: string | null;
  readiness?: Resource<RlReadinessAssessment>;
}) {
  if (mode === 'layout-preview') {
    return (
      <Panel title="Sample readiness chrome" actions={<SourceTag mode="layout-preview" />}>
        <p className="text-sm text-ink" data-testid="live-defense-preview-readiness">
          Sample layout. This panel does not compute readiness. The live tab reads GET /rl-readiness from the backend.
        </p>
      </Panel>
    );
  }
  if (!projectId) return <Empty>Choose a project to load the backend readiness assessment.</Empty>;
  return (
    <div className="flex flex-col gap-4" data-testid="live-defense-readiness">
      <p className="rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm text-ink" data-testid="live-defense-rl-blocked-copy">
        {RL_BLOCKED_COPY}
      </p>
      {readiness ? (
        <Async resource={readiness} label="RL readiness">
          {item => <ReadinessBody assessment={item} />}
        </Async>
      ) : <Empty>Readiness was not requested.</Empty>}
    </div>
  );
}

function ReadinessBody({ assessment }: { assessment: RlReadinessAssessment }) {
  const passed = assessment.categories.filter(item => item.status === 'PASS').length;
  return (
    <>
      <Panel title="RL pilot readiness" actions={<SourceTag mode="live" />}>
        <p className="text-base font-medium text-ink" data-testid="live-defense-readiness-verdict">{assessment.verdict}</p>
        <p className="mt-1 text-sm text-muted">{passed} of {assessment.categories.length} checks pass</p>
        <ul className="mt-4 divide-y divide-line" data-testid="live-defense-readiness-categories">
          {assessment.categories.map(item => (
            <li key={item.category} className="flex items-center justify-between gap-3 py-2" title={item.summary} data-testid={`live-defense-readiness-${item.letter}`}>
              <span className="text-sm text-ink-2">{item.title}</span>
              <Tag tone={TONE[item.status]}>{item.status}</Tag>
            </li>
          ))}
        </ul>
      </Panel>
      <details className="ld-details">
        <summary>Technical details</summary>
        <Panel title="Evidence">
          <p className="text-sm text-ink">
            ready=<Mono>{String(assessment.ready)}</Mono>
            {' · '}infrastructure complete={String(assessment.infrastructure_complete)}
            {' · '}customer infra provisioned={String(assessment.customer_infra_provisioned)}
          </p>
          <p className="mt-2 text-xs text-muted" data-testid="live-defense-readiness-phase6">{assessment.phase6_verdict}</p>
          <p className="mt-2 text-xs text-muted">{assessment.caveat}</p>
          <ul className="mt-3 flex flex-col gap-1 text-xs text-muted">
            {assessment.categories.map(item => <li key={item.category}>{item.letter}. {item.title}: {item.summary}</li>)}
          </ul>
          <p className="mt-3 text-xs text-muted">Thresholds are unset pending RL-owner approval; pass-by-total-reward is forbidden.</p>
          <ul className="mt-1 text-xs text-muted">
            {assessment.evaluation_plan.metrics.map(metric => (
              <li key={metric.name}>{metric.name}: threshold {metric.threshold === null ? 'unset' : String(metric.threshold)} ({metric.threshold_status})</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            v6 passed new criteria: {String(assessment.hosted_inference.v6_passed_new_criteria)}.
            Approved checkpoint present: {String(assessment.hosted_inference.approved_checkpoint_present)}.
            Q-values are not probabilities.
          </p>
        </Panel>
      </details>
    </>
  );
}
