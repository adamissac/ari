import type { Metadata } from 'next';
import Link from 'next/link';
import { Fragment } from 'react';
import { BRAND_NAME } from '@/components/brand';
import { Faq } from '@/components/faq';
import { DEMO_ONLY } from '@/lib/deployment';
import { perAssessment, PLANS, usd, type Plan } from '@/lib/pricing';

const START = DEMO_ONLY ? '/access' : '/projects';

export const metadata: Metadata = {
  title: `Pricing · ${BRAND_NAME}`,
  description: `${BRAND_NAME} plans: Founder, Growth, Scale and Enterprise, priced by full assessments and assessed source lines per month.`,
};

/* Preview pricing: prices are proposals; nothing can be purchased.
   Layout follows the connected-grid pattern of developer-tool pricing pages: one panel with a
   column per plan, the action right under the price, then one grouped comparison table. */
const INCLUDED = [
  'Intent-aware review of every pull request',
  'A failing test that reproduces each functional defect',
  'Seven security agents inside the sandbox scope you approve',
  'Fixes proposed only after human approval',
  'Fixes closed only when independent tests pass',
  'Signed GitHub monitoring of every push',
  'Evidence for every claim: source spans, test reports, transcripts',
];

const ENTERPRISE_ADDS = [
  'SARIF and rules-of-engagement reports',
  'Findings mapped to CWE, CVSS, OWASP LLM Top 10, ATT&CK, D3FEND',
  'Scope and rules of engagement agreed in writing',
  'Two-person approval for containment and incident closure',
  'Persisted audit trail of every approval and decision',
];

const FAQ = [
  { q: 'What is a full assessment?', a: 'One run on one commit: intent review, the seven security agents inside your approved scope, and independent verification of any fix.' },
  { q: 'What counts as assessed source lines?', a: 'In this proposal, the source lines ARI reads across all full assessments in a month. Assessing a 50,000-line repository three times counts as 150,000 lines.' },
  { q: 'Does ARI ever change our code on its own?', a: 'No. Patches are proposed only after a person approves remediation, and a fix only counts when independent, executed tests agree.' },
  { q: 'What will ARI test?', a: 'Only the scope you approve, such as sandbox builds of your own repositories. It never targets third-party systems.' },
  { q: 'Can I buy a plan today?', a: 'Not yet. This is a hackathon preview: the plans above are proposals and nothing can be purchased. You can open the console and try the product.' },
];

function Check({ label }: { label: string }) {
  return (
    <svg role="img" aria-label={label} viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-muted">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const isEnterprise = (plan: Plan) => plan.monthlyUsd === null;

const TABLE: { group: string; rows: { label: string; value: (plan: Plan) => string | boolean }[] }[] = [
  { group: 'Usage per month', rows: [
    { label: 'Full assessments', value: plan => plan.assessments === null ? 'Custom' : String(plan.assessments) },
    { label: 'Assessed source lines', value: plan => plan.sourceLines },
    { label: 'Price per included assessment', value: perAssessment },
  ] },
  { group: 'Review, attack and verification', rows: INCLUDED.map(label => ({ label, value: () => true })) },
  { group: 'Reporting and governance', rows: ENTERPRISE_ADDS.map(label => ({ label, value: isEnterprise })) },
];

export default function PricingPage() {
  return (
    <div className="pricing mx-auto max-w-6xl">
      <header className="pt-12 md:pt-20" aria-labelledby="pricing-title">
        <h1 id="pricing-title" className="font-display text-4xl font-medium tracking-tight md:text-6xl">{BRAND_NAME} pricing</h1>
        <p className="mt-4 max-w-xl text-base text-muted">Pay for the commits you assess. Every plan runs the same review, safe attack and independent verification.</p>
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-faint" data-testid="pricing-proposal">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warn" />Preview: plans are proposals
        </p>
      </header>

      <section aria-label="Plans" className="price-grid mt-12">
        {PLANS.map(plan => (
          <article key={plan.id} className={`price-col ${plan.recommended ? 'price-col-featured' : ''}`} aria-labelledby={`plan-${plan.id}`} data-testid={`plan-${plan.id}`}>
            <div className="flex h-6 items-center justify-between gap-3">
              <h2 id={`plan-${plan.id}`} className="text-base font-medium">{plan.name}</h2>
              {plan.recommended && <span className="plan-badge">Recommended</span>}
            </div>
            <p className="mt-1 min-h-10 text-sm text-muted">{plan.tagline}</p>
            <p className="mt-6 flex h-10 items-baseline gap-2">
              <span className="font-display text-4xl font-medium tabular-nums tracking-tight">{isEnterprise(plan) ? 'Custom' : usd(plan.monthlyUsd ?? 0)}</span>
              {!isEnterprise(plan) && <span className="text-sm text-faint">per month</span>}
            </p>
            <div className="mt-6">
              {isEnterprise(plan)
                ? <Link href="/#how" className="plan-cta w-full">See how it works</Link>
                : <Link href={START} className={`plan-cta w-full ${plan.recommended ? 'plan-cta-primary' : ''}`}>Open the console</Link>}
            </div>
            <p className="mt-8 text-sm text-ink">
              {isEnterprise(plan)
                ? <>Volumes agreed with you</>
                : <><span className="font-display text-2xl font-medium tabular-nums">{plan.assessments}</span> <span className="text-muted">full assessments a month</span></>}
            </p>
            <p className="mt-1 text-sm text-muted">{isEnterprise(plan) ? 'Everything in Scale, plus reporting and governance' : `${plan.sourceLines} source lines · ${perAssessment(plan)} each`}</p>
          </article>
        ))}
      </section>

      <section aria-labelledby="compare-title" className="mt-20">
        <h2 id="compare-title" className="text-lg font-medium">Compare plans</h2>
        <div className="mt-6 overflow-x-auto">
          <table className="price-table">
            <thead>
              <tr><th scope="col"><span className="sr-only">Feature</span></th>{PLANS.map(plan => <th key={plan.id} scope="col">{plan.name}</th>)}</tr>
            </thead>
            <tbody>
              {TABLE.map(section => (
                <Fragment key={section.group}>
                  <tr className="price-table-group"><th scope="rowgroup" colSpan={PLANS.length + 1}>{section.group}</th></tr>
                  {section.rows.map(row => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      {PLANS.map(plan => {
                        const v = row.value(plan);
                        return <td key={plan.id}>{v === true ? <Check label="Included" /> : v === false ? <span className="text-faint" aria-label="Not included">–</span> : v}</td>;
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
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
          <Link href={START} className="plan-cta plan-cta-primary">Open the console</Link>
          <Link href="/#how" className="plan-cta">See how it works</Link>
        </div>
        <p className="text-sm text-faint" data-testid="pricing-preview">Prices in USD. These plans are proposals and nothing can be purchased yet.</p>
      </section>
    </div>
  );
}
