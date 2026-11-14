'use client';

import type {
  ComponentGraph,
  ConnectedApplication,
  DefenseHealth,
  DefenseRecommendation,
  Incident,
  LivePolicyDecision,
  MonitoringEvent,
  Project,
  ReassessmentRequest,
} from '@hackatl/frontend-transport';
import Link from 'next/link';
import { DefenseMap } from '@/components/defense-map';
import { DefenseSwitch } from '@/components/defense-switch';
import { HealthUnknownNote, SimulationCaveat, SourceTag } from '@/components/live-defense/common';
import { Async, Badge, Details, Empty, Mono, Panel, StatGrid, Tag, Time } from '@/components/ui';
import {
  actionInWords,
  defenseStatus,
  eventIncidentIds,
  isOpenIncidentState,
  liveDefenseHref,
  liveDefenseOverviewCopy,
  MISSING_LIVE_APIS,
  provenanceLabel,
  USED_LIVE_APIS,
  type LiveDefenseMode,
} from '@/lib/live-defense';
import { PREVIEW_EVENTS, PREVIEW_INCIDENTS, PREVIEW_LINKS, PREVIEW_NODES, PREVIEW_RECOMMENDATIONS, PREVIEW_STATES } from '@/lib/live-defense-preview';
import { STATE_LABEL } from '@/lib/incidents';
import { EVENT_STATUS } from '@/lib/status';
import type { Resource } from '@/lib/use-resource';

export function LiveOverview({
  mode,
  projectId,
  project,
  reloadProject,
  events,
  incidents,
  recs,
  decisions,
  reassess,
  health,
  graph,
  apps,
}: {
  mode: LiveDefenseMode;
  projectId: string | null;
  project?: Project;
  reloadProject?: () => void;
  events?: Resource<{ items: MonitoringEvent[] }>;
  incidents?: Resource<{ items: Incident[] }>;
  recs?: Resource<{ items: DefenseRecommendation[]; label: string }>;
  decisions?: Resource<{ items: LivePolicyDecision[]; label: string }>;
  reassess?: Resource<{ items: ReassessmentRequest[] }>;
  health?: Resource<DefenseHealth>;
  graph?: Resource<ComponentGraph>;
  apps?: Resource<{ items: ConnectedApplication[] }>;
}) {
  if (mode === 'layout-preview') return <PreviewOverview projectId={projectId} />;
  return (
    <LiveOverviewRecords
      projectId={projectId}
      project={project}
      reloadProject={reloadProject}
      events={events}
      incidents={incidents}
      recs={recs}
      decisions={decisions}
      reassess={reassess}
      health={health}
      graph={graph}
      apps={apps}
    />
  );
}

function LiveOverviewRecords({
  projectId, project, reloadProject, events, incidents, recs, decisions, reassess, health, graph, apps,
}: {
  projectId: string | null;
  project?: Project;
  reloadProject?: () => void;
  events?: Resource<{ items: MonitoringEvent[] }>;
  incidents?: Resource<{ items: Incident[] }>;
  recs?: Resource<{ items: DefenseRecommendation[]; label: string }>;
  decisions?: Resource<{ items: LivePolicyDecision[]; label: string }>;
  reassess?: Resource<{ items: ReassessmentRequest[] }>;
  health?: Resource<DefenseHealth>;
  graph?: Resource<ComponentGraph>;
  apps?: Resource<{ items: ConnectedApplication[] }>;
}) {
  const eventItems = events?.status === 'ready' ? events.data.items : [];
  const incidentItems = incidents?.status === 'ready' ? incidents.data.items : [];
  const recItems = recs?.status === 'ready' ? recs.data.items : [];
  const decisionItems = decisions?.status === 'ready' ? decisions.data.items : [];
  const open = incidentItems.filter(item => isOpenIncidentState(item.state));
  const copy = liveDefenseOverviewCopy({
    monitoringEnabled: project?.settings.monitoring_policy.enabled ?? false,
    eventsKnown: events?.status === 'ready',
    eventCount: eventItems.length,
    simulatedEventCount: eventItems.filter(item => item.simulated).length,
    incidentsKnown: incidents?.status === 'ready',
    openIncidentCount: open.length,
    simulatedIncidentCount: open.filter(item => item.simulated).length,
    recommendationsKnown: recs?.status === 'ready',
    recommendationCount: recItems.length,
    appsKnown: apps?.status === 'ready',
    appCount: apps?.status === 'ready' ? apps.data.items.length : 0,
    healthKnown: health?.status === 'ready',
    lastIngestAt: health?.status === 'ready' ? health.data.last_ingest_at : null,
    shadowKnown: decisions?.status === 'ready',
    shadowCount: decisionItems.length,
  });
  const appCount = apps?.status === 'ready' ? apps.data.items.length : null;
  const status = defenseStatus({
    enabled: project?.settings.monitoring_policy.enabled ?? false,
    apps: appCount,
    lastIngestAt: health?.status === 'ready' ? health.data.last_ingest_at : null,
    openIncidents: incidents?.status === 'ready' ? open.length : null,
    suggestions: recs?.status === 'ready' && decisions?.status === 'ready' ? recItems.length + decisionItems.length : null,
  });
  const pushes = eventItems.filter(item => item.source === 'github').length;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section aria-label="Live Defense status" className="ld-status" data-testid="live-defense-status" data-tone={status.tone}>
        <div className="min-w-0">
          <p className="ld-status-line"><span className="ld-status-dot" aria-hidden="true" />{status.headline}</p>
          <p className="mt-2 max-w-2xl text-sm text-muted">{status.detail}</p>
        </div>
        {project && reloadProject && <DefenseSwitch project={project} onChange={() => reloadProject()} />}
      </section>

      <Panel title="How Live Defense works, and what is running for this project">
        <ol className="ld-flow" data-testid="live-defense-flow">
          {status.stages.map((stage, index) => (
            <li key={stage.id} className="ld-stage" data-state={stage.state}>
              <span className="ld-stage-step">{index + 1}</span>
              <span className="ld-stage-title">{stage.title}</span>
              <span className="ld-stage-state">{stage.state === 'on' ? 'Running' : stage.state === 'manual' ? 'Your call' : 'Not yet'}</span>
              <span className="ld-stage-fact">{stage.fact}</span>
            </li>
          ))}
        </ol>
        {appCount === 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4" data-testid="live-defense-connect">
            <p className="max-w-2xl text-sm text-muted"><span className="text-ink">Connect your running app to start step 1.</span> Register the app, add the token to it, and it starts sending traffic counts. Ari never sees request bodies or secrets.</p>
            <Link className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-deep" href={liveDefenseHref(projectId, 'apps')}>Connect an app</Link>
          </div>
        )}
      </Panel>

        {graph ? (
        <Async resource={graph} label="recorded topology">
          {item => item.nodes.length === 0 ? null : (
            <Panel title="Connected apps and routes"><div data-testid="live-defense-graph">
              <p className="mb-2 text-xs text-muted">{item.note}</p>
              <ul className="flex flex-col gap-2">
                {item.nodes.map(node => {
                  const obs = item.observations.find(entry => entry.node_id === node.id);
                  return (
                    <li key={node.id} className="rounded-md border border-line bg-panel-2 p-2.5 text-sm text-ink">
                      <span className="font-medium">{node.label}</span>
                      <span className="mt-1 flex flex-wrap gap-1 text-xs">
                        <Tag>{node.kind}</Tag>
                        <Tag tone={obs?.state === 'attention' ? 'warn' : 'neutral'}>{obs?.state ?? 'unknown'}</Tag>
                        {obs?.simulated && <Tag tone="warn">simulated source</Tag>}
                        {obs?.last_checked_at && <span className="text-muted">last window <Time iso={obs.last_checked_at} /></span>}
                      </span>
                      {obs?.note && <p className="mt-1 text-xs text-muted">{obs.note}</p>}
                    </li>
                  );
                })}
              </ul>
            </div></Panel>
          )}
        </Async>
      ) : null}
      <section aria-label="Live Defense activity">
        <StatGrid items={[
          { label: 'Open incidents', value: incidents?.status === 'ready' ? open.length : '…' },
          { label: 'Suggested responses, none applied', value: recs?.status === 'ready' && decisions?.status === 'ready' ? recItems.length + decisionItems.length : '…' },
          { label: 'Code pushes seen (latest loaded)', value: events?.status === 'ready' ? pushes : '…' },
          { label: 'Code re-checks requested', value: reassess?.status === 'ready' ? reassess.data.items.length : '…' },
        ]} />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Open incidents" actions={<Link className="text-xs text-accent hover:underline" href={liveDefenseHref(projectId, 'incidents')}>All incidents</Link>}>
          {incidents ? (
            <Async resource={incidents} label="incidents">
              {page => {
                const openItems = page.items.filter(item => isOpenIncidentState(item.state));
                if (openItems.length === 0) return <Empty>No open incidents.</Empty>;
                return (
                  <ul className="divide-y divide-line">
                    {openItems.slice(0, 6).map(item => (
                      <li key={item.id}>
                        <Link href={liveDefenseHref(projectId, 'incidents') + `/${item.id}`} className="block py-3 text-sm text-ink hover:text-accent">
                          <span className="font-medium">{item.title}</span>
                          <span className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                            {item.simulated && <Tag tone="warn">Synthetic</Tag>}
                            <Tag>{STATE_LABEL[item.state]}</Tag>
                            opened <Time iso={item.opened_at} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                );
              }}
            </Async>
          ) : <Empty>Incidents were not requested.</Empty>}
        </Panel>
        <Panel title="Recent activity">
          {events ? (
            <Async resource={events} label="monitoring events">
              {page => page.items.length === 0 ? <Empty>Nothing received yet. Signed GitHub deliveries and signals from a connected app appear here.</Empty> : (
                <ol className="divide-y divide-line">
                  {page.items.slice(0, 8).map(event => {
                    const linked = eventIncidentIds(event.id, incidentItems);
                    return (
                      <li key={event.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm text-ink">
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span>{event.source === 'github' ? 'GitHub' : event.source} {event.type.replaceAll('_', ' ')}</span>
                          {(event.simulated || event.test_event) && <Tag tone="warn">{provenanceLabel(event)}</Tag>}
                          {linked.map(id => (
                            <Link key={id} className="text-xs text-accent hover:underline" href={`${liveDefenseHref(projectId, 'incidents')}/${id}`}>Incident</Link>
                          ))}
                        </span>
                        <span className="flex items-center gap-3 text-xs text-muted">
                          <Badge view={EVENT_STATUS[event.status]} />
                          <Time iso={event.received_at} />
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Async>
          ) : <Empty>Events were not requested.</Empty>}
        </Panel>
      </div>

      <Panel title="What Ari would do" actions={<Link className="text-xs text-accent hover:underline" href={liveDefenseHref(projectId, 'controls')}>Controls</Link>}>
        <p className="mb-3 text-sm text-muted">Suggestions only. None of these was applied. To act on one, authorize a temporary control on the Controls tab.</p>
        {decisions ? (
          <Async resource={decisions} label="shadow decisions">
            {page => page.items.length === 0 ? null : (
              <ul className="divide-y divide-line">
                {page.items.slice(0, 5).map(item => (
                  <li key={item.id} className="py-2.5 text-sm text-ink" data-testid={`live-defense-decision-${item.id}`}>
                    <p className="font-medium">{item.action ? actionInWords(item.action, item.node) : 'No action suggested'}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      From your app&apos;s traffic
                      <Tag tone="info">Not executed</Tag>
                      {item.simulated ? <Tag tone="warn">simulated source</Tag> : <Tag tone="ok">authenticated source</Tag>}
                      <Link className="text-accent hover:underline" href={`${liveDefenseHref(projectId, 'explain')}#${item.id}`}>Why</Link>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        ) : null}
        {recs ? (
          <Async resource={recs} label="recommendations">
            {page => page.items.length === 0 ? null : (
              <ul className="divide-y divide-line border-t border-line">
                {page.items.slice(0, 5).map(rec => (
                  <li key={rec.id} className="py-2.5 text-sm text-ink">
                    <p className="font-medium">{actionInWords(rec.action, rec.node)}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      From a practice simulation, not from a real attack
                      <Link className="text-accent hover:underline" href={`${liveDefenseHref(projectId, 'explain')}#${rec.id}`}>Why</Link>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        ) : null}
        {recs?.status === 'ready' && decisions?.status === 'ready' && recItems.length + decisionItems.length === 0 && <Empty>No suggestion yet. They appear once a connected app sends traffic.</Empty>}
      </Panel>

      <Details summary="Engineering details">
        <p className="text-xs text-muted" data-testid="live-defense-summary">{copy}</p>
        <HealthUnknownNote />
        {health ? (
          <Async resource={health} label="defense health">
            {item => (
              <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-3 gap-y-1 text-sm text-ink" data-testid="live-defense-health">
                <dt className="text-muted">Status</dt><dd>{item.status}</dd>
                <dt className="text-muted">Reason</dt><dd>{item.status_reason}</dd>
                <dt className="text-muted">Worker</dt><dd>{item.worker_status} — {item.worker_status_reason}</dd>
                <dt className="text-muted">Telemetry</dt><dd>{item.telemetry_status} — {item.telemetry_status_reason}</dd>
                <dt className="text-muted">Policy</dt><dd>{item.policy_status} — {item.policy_status_reason}</dd>
                <dt className="text-muted">Worker last heartbeat</dt><dd>{item.worker_seen_at ? <Time iso={item.worker_seen_at} /> : 'unavailable'}</dd>
                <dt className="text-muted">Queue depth (this project)</dt><dd>{item.queue_depth ?? 'unavailable'}</dd>
                <dt className="text-muted">Last ingest window</dt><dd>{item.last_ingest_at ? <Time iso={item.last_ingest_at} /> : 'unavailable'}</dd>
                <dt className="text-muted">Last runtime event</dt><dd>{item.last_runtime_event_at ? <Time iso={item.last_runtime_event_at} /> : 'unavailable'}</dd>
              </dl>
            )}
          </Async>
        ) : null}
        <IntegrationStatus />
      </Details>
    </div>
  );
}

function PreviewOverview({ projectId }: { projectId: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="live-defense-preview-overview">
      <p className="min-w-0 rounded-xl border border-line bg-panel p-5 sm:p-6 text-sm text-ink">
        Sample layout only. Counts, map states and Q-values below are fixtures. They are not telemetry and not a loaded policy.
      </p>
      <DefenseMap
        nodes={PREVIEW_NODES}
        links={PREVIEW_LINKS}
        states={PREVIEW_STATES}
        title="Illustrative components (sample layout)"
        footnote="Sample layout. States are drawn so the map chrome can be reviewed. They are not recorded health checks."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Example event feed" actions={<SourceTag mode="layout-preview" />}>
          <ol className="flex flex-col gap-2">
            {PREVIEW_EVENTS.map(event => (
              <li key={event.id} className="rounded-md border border-line bg-panel-2 p-2.5 text-sm text-ink">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone="warn">Sample</Tag>
                  <span className="font-medium">{event.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{event.detail}</p>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Example incidents" actions={<Link className="text-xs text-accent hover:underline" href={liveDefenseHref(projectId, 'incidents', 'layout-preview')}>Investigate sample</Link>}>
          <ul className="flex flex-col gap-2">
            {PREVIEW_INCIDENTS.map(item => (
              <li key={item.id} className="rounded-md border border-line bg-panel-2 p-2.5 text-sm text-ink">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-muted">{item.summary}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="Example recommendation chrome" actions={<Link className="text-xs text-accent hover:underline" href={liveDefenseHref(projectId, 'explain', 'layout-preview')}>Sample explainability</Link>}>
        <SimulationCaveat text={PREVIEW_RECOMMENDATIONS[0]?.caveat} />
        <p className="mt-2 text-sm text-ink">{actionInWords(PREVIEW_RECOMMENDATIONS[0]?.action ?? 'noop', PREVIEW_RECOMMENDATIONS[0]?.node ?? null)}</p>
      </Panel>
      <IntegrationStatus />
    </div>
  );
}

function IntegrationStatus() {
  return (
    <div data-testid="live-defense-api-coverage">
    <Panel title="API coverage for this dashboard">
      <p className="mb-3 text-sm text-muted">Live mode uses the endpoints that exist. Missing ones stay empty — they are not filled with mock telemetry.</p>
      <h3 className="label-mono mb-2 text-xs text-ink">In use</h3>
      <ul className="mb-4 divide-y divide-line text-sm">
        {USED_LIVE_APIS.map(item => (
          <li key={`${item.method} ${item.path}`} className="flex flex-wrap justify-between gap-2 py-1.5">
            <Mono>{item.method} {item.path}</Mono>
            <span className="text-xs text-muted">{item.use}</span>
          </li>
        ))}
      </ul>
      <h3 className="label-mono mb-2 text-xs text-ink">Not in the control plane yet</h3>
      <ul className="divide-y divide-line text-sm">
        {MISSING_LIVE_APIS.map(item => (
          <li key={item.id} className="py-1.5">
            <p className="font-medium text-ink">{item.title}</p>
            <p className="text-xs text-muted">{item.reason}</p>
          </li>
        ))}
      </ul>
    </Panel>
    </div>
  );
}
