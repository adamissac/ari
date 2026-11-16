import Link from 'next/link';
import styles from './landing.module.css';

const PROCESS = [
  { title: 'Connect your code', body: 'Choose a GitHub repository and tell Ari how it should behave. Approve the sandbox testing scope and choose how repairs can be delivered.', note: 'Your repository. Your permissions.' },
  { title: 'Review and investigate', body: 'The functional reviewer and security agents use shared repository context to investigate the change. Probe runs supported, reviewed security checks inside the approved sandbox.', note: 'Untested findings stay unconfirmed.' },
  { title: 'Repair, then verify', body: 'With your authorization, Ari prepares a candidate repair. Independent verification checks the change in a fresh sandbox, including whether the original problem is resolved.', note: 'A proposed fix is not a verified fix.' },
  { title: 'Deliver on your terms', body: 'Receive verified fixes as pull requests, keep delivery manual, or authorize direct commits where available. Enable automatic reviews to check eligible future pushes and pull requests.', note: 'Automatic reviews are optional.' },
] as const;

const AGENTS = [
  ['Scout', 'Find possible weaknesses'],
  ['Probe', 'Run approved checks'],
  ['Trace', 'Connect the evidence'],
  ['Diagnose', 'Identify the root cause'],
  ['Patch', 'Prepare a repair'],
  ['Verify', 'Check independently'],
  ['Fortify', 'Recommend hardening'],
] as const;

export function ProblemScene() {
  return (
    <section className={styles.context} aria-labelledby="problem-title">
      <p className={styles.eyebrow}>More than the changed lines</p>
      <div className={styles.contextGrid}>
        <h2 id="problem-title">Understand the change.<br /><span>Then challenge it.</span></h2>
        <div>
          <p>A change can look right and still break a business rule or an access boundary. Ari brings code understanding, functional review, and security investigation into the same assessment.</p>
          <p>Findings link back to source and recorded evidence. When a supported test cannot establish the result, the finding stays unconfirmed.</p>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className={styles.process} aria-labelledby="how-title">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>How it works</p>
        <h2 id="how-title">From your repository<br />to a checked repair.</h2>
      </div>
      <ol className={styles.processList}>
        {PROCESS.map((step, index) => (
          <li key={step.title}>
            <span className={styles.stepNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <h3>{step.title}</h3>
            <div><p>{step.body}</p><p className={styles.stepNote}>{step.note}</p></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Walkthrough() {
  return (
    <section className={styles.team} aria-labelledby="walk-title">
      <div className={styles.teamHeading}>
        <div><p className={styles.eyebrow}>The security team</p><h2 id="walk-title">Seven roles.<br />Shared context.</h2></div>
        <p>Each agent has a distinct job and permitted tools. The workflow follows the evidence, so later stages run only when their prerequisites are met. The functional code reviewer runs alongside this team.</p>
      </div>
      <ul className={styles.agentList}>
        {AGENTS.map(([name, role]) => <li key={name}><h3>{name}</h3><p>{role}</p></li>)}
      </ul>
    </section>
  );
}

export function ProofStats() {
  return (
    <section className={styles.controls} aria-labelledby="proof-title">
      <div><p className={styles.eyebrow}>Built around your decisions</p><h2 id="proof-title">You set the boundaries.</h2><Link href="/pricing" className={styles.secondary}>Explore the plans<span aria-hidden="true">↗</span></Link></div>
      <dl className={styles.controlList}>
        <div><dt>Approved scope</dt><dd>Executable security checks run only against approved sandbox targets. Authorizations expire and can be revoked.</dd></div>
        <div><dt>Independent verification</dt><dd>Patch and Verify use separate workspaces. Passing the required checks is what makes a repair eligible for delivery.</dd></div>
        <div><dt>Your delivery settings</dt><dd>Approve each repair manually, or authorize repairs in advance through pull request or available direct-commit delivery. Manual mode pushes nothing.</dd></div>
      </dl>
    </section>
  );
}
