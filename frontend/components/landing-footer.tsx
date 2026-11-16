import Link from 'next/link';
import { Reveal } from '@/components/reveal';
import { LogoMark } from '@/components/brand';

const GROUPS = [
  { title: 'Product', links: [['The process', '#how'], ['Pricing', '/pricing']] },
  { title: 'Console', links: [['Your projects', '/projects'], ['Connect a repository', '/connect']] },
  { title: 'Resources', links: [['Source code', 'https://github.com/adamissac/ari-ai']] },
] as const;

/**
 * Landing footer: brand and link columns on one grid, then a legal row with a small status note and
 * a back-to-top control.
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
      <Reveal className="footer-bottom" delay={100}>
        <span className="footer-legal"><span>© {new Date().getUTCFullYear()} ARI</span><span aria-hidden="true">·</span><span>Hackathon preview</span></span>
        <span className="footer-status"><span aria-hidden="true" className="footer-status-dot" />Prices and plans are proposals</span>
        <a href="#main" className="footer-top-link">Back to top <span aria-hidden="true">↑</span></a>
      </Reveal>
    </footer>
  );
}
