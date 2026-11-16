import Link from 'next/link';
import { Reveal } from '@/components/reveal';
import { LogoMark } from '@/components/brand';
import { LiquidBackground } from '@/components/liquid-bg';

const GROUPS = [
  { title: 'Product', links: [['The process', '#how'], ['Pricing', '/pricing']] },
  { title: 'Console', links: [['Your projects', '/projects'], ['Connect a repository', '/connect']] },
  { title: 'Resources', links: [['Source code', 'https://github.com/adamissac/ari-ai']] },
] as const;

/**
 * Landing footer: brand and link columns on one grid, then the hero's contour field as a band
 * with the ARI wordmark cut out of it, so the page ends the way it starts.
 */
export function LandingFooter() {
  return (
    <footer className="landing-footer" data-testid="landing-footer">
      <Reveal className="footer-top">
        <div className="footer-identity">
          <Link href="/" aria-label="Back to Ari home" className="footer-brand"><LogoMark size={28} decorative /><span className="ari-wordmark-text">ARI</span></Link>
          <p>Software moves fast.<br />Proof should keep up.</p>
        </div>
        <nav aria-label="Footer" className="footer-links">
          {GROUPS.map(group => <div key={group.title}><h2>{group.title}</h2>{group.links.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}</div>)}
        </nav>
      </Reveal>
      <div aria-hidden="true" className="footer-band">
        <LiquidBackground />
        <span className="footer-wordmark">ARI</span>
      </div>
      <Reveal className="footer-bottom" delay={100}>
        <span>© {new Date().getUTCFullYear()} ARI · Hackathon preview</span>
        <a href="#main" className="footer-top-link">Back to top <span aria-hidden="true">↑</span></a>
      </Reveal>
    </footer>
  );
}
