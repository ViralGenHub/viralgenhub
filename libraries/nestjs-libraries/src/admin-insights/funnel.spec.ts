import { buildFunnel } from '@gitroom/nestjs-libraries/admin-insights/funnel';

const u = (o: Partial<Record<string, boolean>>) => ({
  confirmed: false, channel: false, scheduled: false, published: false, paid: false, ...o,
});

describe('buildFunnel', () => {
  it('counts each step and the drop-off from the step before', () => {
    const steps = buildFunnel([
      u({ confirmed: true, channel: true, scheduled: true, published: true, paid: true }),
      u({ confirmed: true, channel: true, scheduled: true }),
      u({ confirmed: true, channel: true }),
      u({ confirmed: true }),
      u({}),
    ]);
    expect(steps.map((s) => s.count)).toEqual([5, 4, 3, 2, 1, 1]);
    expect(steps.map((s) => s.dropOffPct)).toEqual([0, 20, 25, 33.3, 50, 0]);
    expect(steps[2].pctOfSignups).toBe(60);
  });

  it('handles nobody, and never shows a negative drop-off', () => {
    expect(buildFunnel([]).every((s) => s.count === 0 && s.pctOfSignups === 0)).toBe(true);
    const odd = buildFunnel([u({ paid: true })]);
    expect(odd[5].dropOffPct).toBe(0);
  });
});
