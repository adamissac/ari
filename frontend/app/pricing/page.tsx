import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND_NAME } from '@/components/brand';
import { Faq } from '@/components/faq';
import { Reveal } from '@/components/reveal';
import { RollText } from '@/components/ui';
import { DEMO_ONLY } from '@/lib/deployment';
import { perAssessment, PLANS, usd } from '@/lib/pricing';

const START = DEMO_ONLY ? '/access' : '/projects';

export const metadata: Metadata = {
  title: `Pricing · ${BRAND_NAME}`,
  description: `Proposed ${BRAND_NAME} plans: Founder, Growth, Scale and Enterprise, priced by full assessments and assessed source lines per month.`,
};

/* Preview pricing: the layout follows kairo.security's pricing page; plan contents describe
   what ARI does. Prices are proposals; nothing can be purchased. */
const INCLUDED = [
  'Intent-aware code review grounded in your repository and its expected behavior',
  'Generated tests for supported defects, with unverified findings clearly marked',
  'Seven specialized security agents, with executable checks limited to your approved sandbox scope',
  'Candidate repairs, independent verification and delivery controls you choose',
  'Optional GitHub reviews of eligible pushes and pull requests, subject to review limits',
  'Source references, available test evidence and agent run history for reviewing findings',
];

const ENTERPRISE_ADDS = [
  'Custom assessment and source-line volumes',
  'SARIF and rules-of-engagement reports for every assessment',
  'Findings mapped to CWE, CVSS, OWASP LLM Top 10, MITRE ATT&CK and D3FEND',
  'Scope and rules of engagement agreed in writing before any testing',
  'Two-person approval for containment and incident closure workflows',
  'A persisted audit trail of every approval and decision',
];

const FAQ = [
  { q: 'What is a full assessment?', a: 'One assessment of one repository commit. ARI reviews expected behavior, runs supported security checks within your approved scope, and independently verifies candidate fixes. Some checks can be skipped or remain inconclusive.' },
  { q: 'What counts as assessed source lines?', a: 'In this proposal, the source lines ARI reads across all full assessments in a month. Assessing a 50,000-line repository three times counts as 150,000 lines.' },
  { q: 'Does ARI ever change our code on its own?', a: 'An owner chooses the delivery mode. Manual requires approval for each repair and pushes nothing. Pull request mode, the default, preauthorizes repairs and opens PRs for independently verified fixes when repository writes are enabled. Auto mode can commit verified fixes directly when the service permits it, with a PR fallback.' },
  { q: 'Do reviews run automatically?', a: 'Automatic reviews start off. Enable them for your project and repository to review eligible pushes and pull requests. Branch and author settings, approved scope and review limits still apply.' },
  { q: 'What will ARI test?', a: 'Approved sandbox builds of connected repositories, using the check categories you authorize. Probe runs reviewed checks within that scope. Unsupported checks are not treated as proven findings; ARI does not target third-party systems.' },
  { q: 'Is the Defense Lab live network defense?', a: 'No. The Lab trains and evaluates policies in a simulated network and presents decision support. Nothing the Lab recommends is applied automatically.' },
  { q: 'Can I buy a plan today?', a: 'Not yet. These plans are proposals and nothing can be purchased. You can open the console to explore the product.' },
];

function Check({ dark }: { dark?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? 'text-white/70' : 'text-brand'}`}>
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cta({ href, children, tone }: { href: string; children: string; tone: 'light' | 'dark' }) {
  return (
    <Link href={href} className={`group label-mono inline-flex h-10 items-center rounded-md px-4 transition-colors duration-[250ms] ${tone === 'light' ? 'bg-white text-night hover:bg-brand hover:text-on-brand' : 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgb(255_247_242_/_14%)] hover:bg-brand'}`}>
      <RollText>{children}</RollText>
    </Link>
  );
}

export default function PricingPage() {
  return (
    <div className="pricing marketing-atmosphere">
      <header className="hero-ink bleed-hero -mt-6 pb-20 pt-16 md:pb-28 md:pt-24" aria-labelledby="pricing-title">
        <div className="mx-auto max-w-7xl px-4">
          <h1 id="pricing-title" className="display text-5xl font-semibold md:text-7xl">{BRAND_NAME} pricing</h1>
          <p className="mt-4 max-w-xl text-sm text-white/70 md:text-base">Review code changes, investigate supported defects and verify repairs before delivery.</p>
          <p className="mt-3 text-xs text-white/60" data-testid="pricing-proposal">Plans are proposals; nothing can be purchased yet.</p>
          <div className="mt-7"><Cta href={START} tone="light">Open the console</Cta></div>
        </div>
      </header>

      <section aria-label="Plans" className="pricing-plans -mt-12 grid gap-4 sm:grid-cols-2 md:-mt-16 xl:grid-cols-4">
        {PLANS.map(plan => {
          const dark = plan.recommended;
          return (
            <article key={plan.id} className={`pricing-card flex flex-col ${dark ? 'pricing-card-dark' : 'pricing-card-light'}`} aria-labelledby={`plan-${plan.id}`} data-testid={`plan-${plan.id}`}>
              <div className="flex items-start justify-between gap-3">
                <h2 id={`plan-${plan.id}`} className="text-2xl font-semibold">{plan.name}</h2>
                {plan.recommended && <span className="pricing-badge label-mono">Recommended</span>}
              </div>
              <p className={`mt-2 text-sm ${dark ? 'text-white/70' : 'text-muted'}`}>{plan.tagline}</p>
              <p className="mt-8 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-display text-5xl font-semibold tracking-tight">{plan.monthlyUsd === null ? 'Contact us' : usd(plan.monthlyUsd)}</span>
                {plan.monthlyUsd !== null && <span className={`label-mono ${dark ? 'text-white/60' : 'text-faint'}`}>/ month · proposed</span>}
              </p>
              <dl className={`pricing-quota mt-6 ${dark ? 'pricing-quota-dark' : ''}`}>
                <div><dt>Full assessments / month</dt><dd>{plan.assessments ?? 'Custom'}</dd></div>
                <div><dt>Assessed source lines / month</dt><dd>{plan.sourceLines}</dd></div>
                <div><dt>Per included assessment</dt><dd>{perAssessment(plan)}</dd></div>
              </dl>
              <div className="mt-auto pt-7">
                {plan.monthlyUsd === null
                  ? <Cta href="/#how" tone="dark">See how it works</Cta>
                  : <Cta href={START} tone={dark ? 'light' : 'dark'}>Open the console</Cta>}
              </div>
            </article>
          );
        })}
      </section>

      <section aria-label="What every plan includes" className="mt-10 grid border-t border-white/10 pt-8 md:grid-cols-2 md:divide-x md:divide-white/10">
        <div className="md:pr-10">
          <p className="label-mono text-faint">Every proposed plan includes</p>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-ink">
            {INCLUDED.map(f => <li key={f} className="flex gap-3"><Check />{f}</li>)}
          </ul>
        </div>
        <div className="mt-8 md:mt-0 md:pl-10">
          <p className="label-mono text-faint">Proposed Enterprise additions</p>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-ink">
            {ENTERPRISE_ADDS.map(f => <li key={f} className="flex gap-3"><Check />{f}</li>)}
          </ul>
        </div>
      </section>

      <p className="mt-14 text-center text-xs text-faint md:mt-16" data-testid="pricing-preview">Plans are proposals; nothing can be purchased yet. Prices in USD.</p>

      <Reveal>
        <section aria-labelledby="faq-title" className="pricing-faq mx-auto mt-24 max-w-3xl py-16 md:py-24">
          <div className="faq-aside flex flex-col items-center text-center">
            <h2 id="faq-title" className="display mt-5 text-4xl font-semibold md:text-5xl">Questions, answered</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">How plans, assessments and assessed lines would work, and what {BRAND_NAME} will and won’t do to your code.</p>
            <Link href="/#how" className="label-mono mt-6 inline-flex items-center gap-2 text-brand hover:text-brand-deep">See how it works <span aria-hidden="true">→</span></Link>
          </div>
          <div className="mt-10"><Faq items={FAQ} /></div>
        </section>
      </Reveal>

      <Reveal>
      <section aria-labelledby="pricing-cta" className="pricing-cta mb-16 mt-16 border-t border-white/10 px-6 py-12 text-center md:px-12 md:py-16">
        <h2 id="pricing-cta" className="display mx-auto max-w-2xl text-2xl font-semibold md:text-3xl">See what your code really does before an attacker does.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Cta href={START} tone="light">Open the console</Cta>
          <Link href="/#how" className="group label-mono inline-flex h-10 items-center rounded-md bg-white/10 px-4 text-white transition-colors duration-[250ms] hover:bg-white/20">
            <RollText>See how it works</RollText>
          </Link>
        </div>
      </section>
      </Reveal>
    </div>
  );
}
