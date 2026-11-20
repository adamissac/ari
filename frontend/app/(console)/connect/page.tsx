'use client';

import Link from 'next/link';
import { Avatar, GitHubMark } from '@/components/demo/ui';
import { BRAND_NAME } from '@/components/brand';
import { Details, ErrorState, Loading, PageTitle, Panel } from '@/components/ui';
import { RefreshFromGitHub } from '@/components/refresh-from-github';
import { SetupLayout } from '@/components/onboarding/stepper';
import { api } from '@/lib/api';
import { groupByOrg } from '@/lib/github-orgs';
import { useResource } from '@/lib/use-resource';

const PERMISSIONS: Array<[string, string]> = [
  ['Contents: read & write', 'Reads code to review. Writes only the build-recipe PR and fixes you approve'],
  ['Pull requests: read & write', 'Opens those PRs and leaves review comments if you turn them on'],
  ['Metadata: read-only', 'Repository names, branches and visibility'],
  ['Events: push, pull request, repository', 'Used only for reviews you enable. Automatic reviews are off by default'],
];

/** After GitHub sign-in: choose the organization (App installation account) to work in. */
export default function ConnectOrgsPage() {
  const list = useResource('github-repos', signal => api().githubRepositories({ signal }));

  return (
    <SetupLayout current={1}>
      <div className="flex min-w-0 flex-col gap-6" data-testid="connect-orgs">
        <PageTitle title="Organizations" subtitle="Choose an organization to see its repositories" actions={<RefreshFromGitHub />} />
        {list.status === 'loading' && <Loading label="Loading your GitHub organizations" />}
        {list.status === 'error' && <ErrorState error={list.error} onRetry={list.reload} context="Could not list your GitHub repositories" />}
        {list.status === 'ready' && (() => {
          const orgs = groupByOrg(list.data.items);
          const install = list.data.install_url;
          if (orgs.length === 0) {
            return (
              <Panel title="No repositories yet" className="text-center">
                <p data-testid="connect-empty" className="mx-auto max-w-md text-sm text-muted">Install the {BRAND_NAME} GitHub App on an organization or your account.</p>
                {install === null && <p className="mx-auto mt-3 max-w-md text-sm text-muted" data-testid="connect-no-install-link">If the App is already installed, use Refresh from GitHub above. Otherwise ask an owner of your GitHub organization to install it, then refresh.</p>}
                {install !== null && <a href={install} className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-on-brand hover:bg-brand-deep"><GitHubMark />Install the GitHub App</a>}
              </Panel>
            );
          }
          return (
            <section aria-label="Your organizations" className="overflow-hidden rounded-xl border border-line bg-panel">
              <ul className="divide-y divide-line">
                {orgs.map(org => (
                  <li key={org.login}>
                    <Link href={`/connect/${encodeURIComponent(org.login)}`} className="group flex min-w-0 items-center gap-4 px-5 py-4 transition-colors hover:bg-panel-2" data-testid={`connect-org-${org.login}`}>
                      <Avatar login={org.login} size={36} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-ink">{org.login}</span>
                        <span className="text-xs text-muted tabular-nums">
                          {org.repos.length} {org.repos.length === 1 ? 'repository' : 'repositories'}
                          {org.connected > 0 && <> · <span className="text-ink">{org.connected} connected</span></>}
                        </span>
                      </span>
                      <span aria-hidden="true" className="text-lg text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {install !== null && (
                <p className="border-t border-line px-5 py-3 text-xs text-muted">Missing an organization or repository? <a className="text-ink underline-offset-2 hover:underline" href={install}>Add it to the GitHub App</a></p>
              )}
            </section>
          );
        })()}
        <section aria-label="GitHub App permissions" className="rounded-xl border border-line bg-panel">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <h2 className="text-sm font-medium text-ink">GitHub App access</h2>
            <p className="text-xs text-muted"><strong className="font-medium text-ink">Revoke or limit access</strong> in GitHub → Settings → Installed GitHub Apps → Ari</p>
          </header>
          <dl className="divide-y divide-line text-sm">
            {PERMISSIONS.map(([permission, why]) => (
              <div key={permission} className="grid gap-1 px-5 py-3 sm:grid-cols-[18rem_1fr] sm:gap-4">
                <dt className="font-mono text-xs leading-5 text-ink">{permission}</dt>
                <dd className="text-muted">{why}</dd>
              </div>
            ))}
          </dl>
        </section>
        <Details summary="What happens when you connect a repository">
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="What happens next" data-testid="connect-next-steps">
            <li className="rounded-lg border border-line p-3"><p className="font-medium text-ink">1 · Nothing runs yet</p><p className="mt-1 text-muted">Connecting records the repository. If it has no build recipe, Ari proposes one as a pull request on <code className="font-mono text-xs">ari/build-recipe</code>. No tests run and nothing is pushed to your default branch.</p></li>
            <li className="rounded-lg border border-line p-3"><p className="font-medium text-ink">2 · You answer setup questions</p><p className="mt-1 text-muted">Including sandbox testing approval and how verified fixes reach you. Automatic reviews stay off unless you turn them on.</p></li>
            <li className="rounded-lg border border-line p-3"><p className="font-medium text-ink">3 · You start the first check</p><p className="mt-1 text-muted">The agents review one commit in an isolated copy and record findings with evidence. You approve any fix before it is built.</p></li>
          </ol>
        </Details>
      </div>
    </SetupLayout>
  );
}
