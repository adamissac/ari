'use client';

import { LandingFooter } from '@/components/landing-footer';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { BRAND_NAME } from '@/components/brand';
import { HowItWorks, ProblemScene, ProofStats, Walkthrough } from '@/components/story';
import { HeroStage } from '@/components/hero';
import { IntroLoader } from '@/components/intro-loader';
import { OptionalUserBar } from '@/components/user-bar';
import { DEMO_ONLY } from '@/lib/deployment';
import { RollText } from '@/components/ui';

// A demo-only build has no backend, so the calls to action open the access-code sign-in.
const START = DEMO_ONLY ? { href: '/access', hero: 'Sign in' } : { href: '/projects', hero: 'Go to projects' };

const i = (n: number) => ({ '--i': n }) as CSSProperties;

export default function HomePage() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="home-deep marketing-atmosphere">
      <IntroLoader onReveal={() => setRevealed(true)} />
      <HeroStage className="hero-full px-6 pb-14 pt-36 md:px-12 md:pt-28" labelledBy="hero-title" play={revealed} liquid>
        <div className="hero-center mx-auto w-full max-w-6xl text-center">
          <h1 id="hero-title" className="hero-headline hero-ari display font-bold hero-in" style={i(0)}>
            <span data-glow={BRAND_NAME} className="hero-line">{BRAND_NAME}</span>
          </h1>
          <div className="hero-in mt-10 flex flex-wrap justify-center gap-3" style={i(1)}>
            <Link href={START.href} className="group label-mono inline-flex h-11 items-center rounded-md bg-white px-4 text-night transition-colors duration-[250ms] hover:bg-brand hover:text-on-brand">
              <RollText>{START.hero}</RollText>
            </Link>
            <a href="#how" className="group label-mono inline-flex h-11 items-center rounded-md bg-white/10 px-4 text-white transition-colors duration-[250ms] hover:bg-white/20">
              <RollText>How It Works</RollText>
            </a>
          </div>
        </div>
      </HeroStage>

      <div className="hero-cover -mb-6 pt-6">
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
