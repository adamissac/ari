import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HowItWorks, ProblemScene, ProofStats, Walkthrough } from '@/components/story';

afterEach(cleanup);

describe('static story accessibility', () => {
  it('keeps context and all process steps accessible without scrolling', () => {
    render(<><ProblemScene /><HowItWorks /></>);
    expect(screen.getByRole('heading', { name: /Understand the change/ })).toBeTruthy();
    expect(screen.getByText(/the finding stays unconfirmed/)).toBeTruthy();
    const process = screen.getByRole('region', { name: /From your repository/ });
    expect(within(process).getAllByRole('listitem')).toHaveLength(4);
    expect(within(process).getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual([
      'Connect your code', 'Review and investigate', 'Repair, then verify', 'Deliver on your terms',
    ]);
  });
  it('renders each security role and its permitted job as text', () => {
    render(<Walkthrough />);
    expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual([
      'Scout', 'Probe', 'Trace', 'Diagnose', 'Patch', 'Verify', 'Fortify',
    ]);
    expect(screen.getByText('Run approved checks')).toBeTruthy();
    expect(screen.getByText('Check independently')).toBeTruthy();
  });
  it('describes approval, verification and delivery boundaries', () => {
    render(<ProofStats />);
    expect(screen.getAllByRole('term').map(term => term.textContent)).toEqual([
      'Approved scope', 'Independent verification', 'Your delivery settings',
    ]);
    expect(screen.getByText(/Patch and Verify use separate workspaces/)).toBeTruthy();
    expect(screen.getByText(/Manual mode pushes nothing/)).toBeTruthy();
  });
});
