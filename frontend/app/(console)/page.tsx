import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingFooter } from '@/components/landing-footer';
import { HeroStage } from '@/components/hero';
import { ProductPreview } from '@/components/product-preview';
import { HowItWorks, ProblemScene, ProofStats, Walkthrough } from '@/components/story';
import { OptionalUserBar } from '@/components/user-bar';
import { DEMO_ONLY } from '@/lib/deployment';
import styles from '@/components/landing.module.css';

export const metadata: Metadata = {
  title: 'ARI — Code review with proof',
  description: 'Code review and security testing for GitHub. Investigate bugs, test supported findings in an approved sandbox, and independently verify repairs.',
  openGraph: {
    title: 'ARI — Code review with proof',
    siteName: 'ARI',
    description: 'Find bugs and security risks in your GitHub code, with approved testing and independent repair verification.',
  },
  twitter: {
    card: 'summary',
    title: 'ARI — Code review with proof',
    description: 'Find bugs and security risks in your GitHub code, with approved testing and independent repair verification.',
  },
};

// A demo-only build has no backend, so the calls to action open the access-code sign-in.
const START = DEMO_ONLY ? { href: '/access', hero: 'Sign in' } : { href: '/projects', hero: 'Connect a repository' };

export default function HomePage() {
  return (
    <div className={styles.landing}>
      <HeroStage className={`hero-full ${styles.hero}`} labelledBy="hero-title" play={false}>
        <div className={styles.heroInner}>
          <div className={styles.heroIntro}>
            <div>
              <p className={styles.eyebrow}>For the code you ship</p>
              <h1 id="hero-title" className={styles.headline}>Code review.<br /><span>With proof.</span></h1>
            </div>
            <div className={styles.heroCopy}>
              <p className={styles.heroDescription}>Find bugs and security risks in your GitHub code. Ari investigates the change, tests in an approved sandbox, and checks proposed fixes independently.</p>
              <div className={styles.actions}>
                <Link href={START.href} className={styles.primary}>{START.hero}<span aria-hidden="true">↗</span></Link>
                <a href="#how" className={styles.secondary}>How it works<span aria-hidden="true">↓</span></a>
              </div>
              <p className={styles.heroNote}>Automatic reviews are off until you enable them.</p>
            </div>
          </div>
          <ProductPreview />
        </div>
      </HeroStage>

      <div className={styles.chapters}>
        {!DEMO_ONLY && <OptionalUserBar />}

        <ProblemScene />
        <HowItWorks />
        <Walkthrough />
        <ProofStats />
        <LandingFooter />
      </div>
    </div>
  );
}
