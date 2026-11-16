import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND_NAME } from '@/components/brand';
import { Faq } from '@/components/faq';
import { DEMO_ONLY } from '@/lib/deployment';
import { perAssessment, PLANS, usd } from '@/lib/pricing';

const START = DEMO_ONLY ? '/access' : '/projects';

export const metadata: Metadata = {
  title: `Pricing · ${BRAND_NAME}`,
  description: `${BRAND_NAME} plans: Founder, Growth, Scale and Enterprise, priced by full assessments and assessed source lines per month.`,
};

/* Preview pricing: prices are proposals; nothing can be purchased. */
const INCLUDED = [
  'Intent-aware review of every pull request against what the code is meant to do',
  'A failing test generated to reproduce each functional defect it reports',
  'Seven security agents probing only inside the sandbox scope you approve',
  'Fixes proposed only after human approval, and closed only when independent tests pass',
  'Signed GitHub monitoring that re-checks every push for regressions',
  'Evidence for every claim: source spans, test reports and agent transcripts',
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
  { q: 'What is a full assessment?', a: 'One run on one commit: intent review, the seven security agents inside your approved scope, and independent verification of any fix.' },
  { q: 'What counts as assessed source lines?', a: 'In this proposal, the source lines ARI reads across all full assessments in a month. Assessing a 50,000-line repository three times counts as 150,000 lines.' },
  { q: 'Does ARI ever change our code on its own?', a: 'No. Patches are proposed only after a person approves remediation, and a fix only counts when independent, executed tests agree.' },
  { q: 'What will ARI test?', a: 'Only the scope you approve, such as sandbox builds of your own repositories. It never targets third-party systems.' },
  { q: 'Can I buy a plan today?', a: 'Not yet. This is a hackathon preview: the plans above are proposals and nothing can be purchased. You can open the console and try the product.' },
];

function Check() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-muted">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cta({ href, children, primary }: { href: string; children: string; primary?: boolean }) {
  return <Link href={href} className={`plan-cta ${primary ? 'plan-cta-primary' : ''}`}>{children}</Link>;
}

export default function PricingPage() {
  const selfServe = PLANS.filter(plan => plan.monthlyUsd !== null);
  const enterprise = PLANS.find(plan => plan.monthlyUsd === null);
  return (
    <div className="pricing mx-auto max-w-6xl">
      <header className="pt-12 md:pt-20" aria-labelledby="pricing-title">
        <h1 id="pricing-title" className="font-display text-4xl font-medium tracking-tight md:text-6xl">{BRAND_NAME} pricing</h1>
        <p className="mt-4 max-w-xl text-base text-muted">Priced by full assessments and assessed source lines per month. Every plan runs the same review, attack and verification loop.</p>
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-faint" data-testid="pricing-proposal">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warn" />Preview: plans are proposals
        </p>
      </header>

      <section aria-label="Plans" className="mt-12 grid gap-4 md:grid-cols-3">
        {selfServe.map(plan => (
          <article key={plan.id} className={`plan ${plan.recommended ? 'plan-featured' : ''}`} aria-labelledby={`plan-${plan.id}`} data-testid={`plan-${plan.id}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 id={`plan-${plan.id}`} className="text-lg font-medium">{plan.name}</h2>
              {plan.recommended && <span className="plan-badge">Recommended</span>}
            </div>
            <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
            <p className="mt-8 flex items-baseline gap-2">
              <span className="font-display text-4xl font-medium tabular-nums tracking-tight">{usd(plan.monthlyUsd ?? 0)}</span>
              <span className="text-sm text-faint">per month</span>
            </p>
            <dl className="plan-quota mt-6">
              <div><dt>Full assessments</dt><dd>{plan.assessments}</dd></div>
              <div><dt>Source lines</dt><dd>{plan.sourceLines}</dd></div>
              <div><dt>Per assessment</dt><dd>{perAssessment(plan)}</dd></div>
            </dl>
            <div className="mt-auto pt-8"><Cta href={START} primary={plan.recommended}>Open the console</Cta></div>
          </article>
        ))}
      </section>

      {enterprise && (
        <section aria-labelledby={`plan-${enterprise.id}`} className="plan plan-wide mt-4" data-testid={`plan-${enterprise.id}`}>
          <div className="md:w-72 md:shrink-0">
            <h2 id={`plan-${enterprise.id}`} className="text-lg font-medium">{enterprise.name}</h2>
            <p className="mt-1 text-sm text-muted">{enterprise.tagline}</p>
            <p className="mt-6 font-display text-2xl font-medium">Contact us</p>
            <div className="mt-6"><Cta href="/#how">See how it works</Cta></div>
          </div>
          <ul className="plan-list md:border-l md:border-line md:pl-10">
            {ENTERPRISE_ADDS.map(f => <li key={f}><Check />{f}</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="included-title" className="mt-20 grid gap-8 border-t border-line pt-10 md:grid-cols-[18rem_1fr] md:gap-10">
        <h2 id="included-title" className="text-lg font-medium">Every plan includes</h2>
        <ul className="plan-list md:grid-cols-2">
          {INCLUDED.map(f => <li key={f}><Check />{f}</li>)}
        </ul>
      </section>

      <section aria-labelledby="faq-title" className="mt-20 grid gap-8 border-t border-line pt-10 md:grid-cols-[18rem_1fr] md:gap-10">
        <div>
          <h2 id="faq-title" className="text-lg font-medium">Questions</h2>
          <p className="mt-2 text-sm text-muted">How plans, assessments and assessed lines would work.</p>
        </div>
        <Faq items={FAQ} />
      </section>

      <section aria-labelledby="pricing-cta" className="pricing-cta mb-16 mt-20 grid gap-x-10 gap-y-2 border-t border-line pt-10 md:grid-cols-[1fr_auto] md:items-center">
        <h2 id="pricing-cta" className="max-w-xl text-2xl font-medium tracking-tight">See what your code really does before an attacker does.</h2>
        <div className="row-span-2 mt-4 flex gap-2 md:col-start-2 md:row-start-1 md:mt-0">
          <Cta href={START} primary>Open the console</Cta>
          <Cta href="/#how">See how it works</Cta>
        </div>
        <p className="text-sm text-faint" data-testid="pricing-preview">Prices in USD. These plans are proposals and nothing can be purchased yet.</p>
      </section>
    </div>
  );
}
