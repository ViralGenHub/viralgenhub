// Funnel maths for /admin/funnel. Pure, so the page and the tests agree.
export interface FunnelUser {
  confirmed: boolean;
  channel: boolean;
  scheduled: boolean;
  published: boolean;
  paid: boolean;
}

export interface FunnelStep {
  id: 'signed_up' | 'confirmed' | 'channel' | 'scheduled' | 'published' | 'paid';
  label: string;
  count: number;
  // share of everyone who signed up, 0-100, one decimal
  pctOfSignups: number;
  // share lost since the step before, 0-100 (0 for the first step)
  dropOffPct: number;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

export const buildFunnel = (users: FunnelUser[]): FunnelStep[] => {
  const counts: Array<[FunnelStep['id'], string, number]> = [
    ['signed_up', 'Signed up', users.length],
    ['confirmed', 'Email confirmed', users.filter((u) => u.confirmed).length],
    ['channel', 'Connected a channel', users.filter((u) => u.channel).length],
    ['scheduled', 'Scheduled a post', users.filter((u) => u.scheduled).length],
    ['published', 'Published a post', users.filter((u) => u.published).length],
    ['paid', 'Paid', users.filter((u) => u.paid).length],
  ];
  return counts.map(([id, label, count], i) => ({
    id,
    label,
    count,
    pctOfSignups: pct(count, users.length),
    dropOffPct:
      i === 0 ? 0 : Math.max(0, pct(counts[i - 1][2] - count, counts[i - 1][2])),
  }));
};
