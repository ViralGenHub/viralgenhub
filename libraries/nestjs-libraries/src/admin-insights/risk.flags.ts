// Sign-up risk flags for the admin Insights page. Every flag is a small pure
// function so it can be tested alone; riskFor() adds them up into a 0-100
// score. A flag is a hint for a person to look at, never an automatic block.
import { isDisposableEmail } from '@gitroom/nestjs-libraries/security/disposable-email';

export type RiskFlagId =
  | 'disposable_domain'
  | 'scripted_user_agent'
  | 'shared_ip'
  | 'no_activity_48h'
  | 'impossible_speed';

export interface RiskFlagDef {
  id: RiskFlagId;
  label: string;
  weight: number;
  tooltip: string;
}

export const RISK_FLAGS: RiskFlagDef[] = [
  {
    id: 'disposable_domain',
    label: 'Disposable email',
    weight: 30,
    tooltip: 'The email address is on a throwaway-mail service.',
  },
  {
    id: 'scripted_user_agent',
    label: 'Scripted client',
    weight: 25,
    tooltip:
      'The sign-up came from a script or headless browser (curl, wget, python-requests, httpx, Go, node-fetch, axios, Headless).',
  },
  {
    id: 'shared_ip',
    label: 'Same IP as another sign-up',
    weight: 20,
    tooltip:
      'Another account signed up from the same network address. Only checked for sign-ups that stored the visitor address (after the Cloudflare fix); Cloudflare addresses count as unknown.',
  },
  {
    id: 'no_activity_48h',
    label: 'No activity after 48 h',
    weight: 10,
    tooltip:
      'Two days after sign-up there is still no channel and no post.',
  },
  {
    id: 'impossible_speed',
    label: 'Impossibly fast',
    weight: 35,
    tooltip:
      'An email account was confirmed, or the first API/MCP/CLI action happened, less than 60 seconds after sign-up. Confirmation time is estimated from the account update time.',
  },
];

const SCRIPT_AGENT =
  /curl\/|^curl|wget|python-requests|python-urllib|httpx|go-http-client|node-fetch|undici|axios|headless|okhttp\/|java\/|libwww|aiohttp|scrapy|postman/i;

export const isScriptedUserAgent = (agent?: string | null): boolean =>
  !!agent && SCRIPT_AGENT.test(agent);

// --- Cloudflare edge ranges (https://www.cloudflare.com/ips/, snapshot
// 2026-11-02). A sign-up stored before the #507 fix holds one of these, which
// says nothing about the visitor, so it is treated as unknown.
const CF_V4: Array<[string, number]> = [
  ['173.245.48.0', 20],
  ['103.21.244.0', 22],
  ['103.22.200.0', 22],
  ['103.31.4.0', 22],
  ['141.101.64.0', 18],
  ['108.162.192.0', 18],
  ['190.93.240.0', 20],
  ['188.114.96.0', 20],
  ['197.234.240.0', 22],
  ['198.41.128.0', 17],
  ['162.158.0.0', 15],
  ['104.16.0.0', 13],
  ['104.24.0.0', 14],
  ['172.64.0.0', 13],
  ['131.0.72.0', 22],
];
const CF_V6 = [
  /^2400:cb00:/,
  /^2606:4700:/,
  /^2803:f800:/,
  /^2405:b500:/,
  /^2405:8100:/,
  /^2c0f:f248:/,
  /^2a06:98c[0-7]:/,
];

const v4ToInt = (ip: string): number | null => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n;
};

export const isCloudflareIp = (raw?: string | null): boolean => {
  const ip = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^::ffff:/, '');
  if (!ip) return false;
  if (ip.includes(':')) {
    return CF_V6.some((re) => re.test(ip));
  }
  const n = v4ToInt(ip);
  if (n === null) return false;
  return CF_V4.some(([base, bits]) => {
    const b = v4ToInt(base)!;
    const size = 2 ** (32 - bits);
    return Math.floor(n / size) === Math.floor(b / size);
  });
};

// An address we can compare: present and not a Cloudflare edge.
export const isUsableIp = (ip?: string | null): boolean =>
  !!ip && String(ip).trim() !== '' && !isCloudflareIp(ip);

export const isSharedIp = (
  ip: string | null | undefined,
  otherUsersWithSameIp: number
): boolean => isUsableIp(ip) && otherUsersWithSameIp > 0;

const HOUR = 3600 * 1000;

export const hasNoActivityAfter48h = (input: {
  createdAt: Date;
  now: Date;
  channelCount: number;
  postCount: number;
}): boolean =>
  input.now.getTime() - input.createdAt.getTime() >= 48 * HOUR &&
  input.channelCount === 0 &&
  input.postCount === 0;

// Email sign-ups only for the confirmation half: social sign-in is "confirmed"
// at once by the provider, so a quick update proves nothing there.
export const isImpossiblySpeedy = (input: {
  providerName: string;
  activated: boolean;
  createdAt: Date;
  updatedAt: Date;
  firstApiActionAt?: Date | null;
}): boolean => {
  const created = input.createdAt.getTime();
  const quickConfirm =
    input.providerName === 'LOCAL' &&
    input.activated &&
    input.updatedAt.getTime() - created < 60 * 1000;
  const quickApi =
    !!input.firstApiActionAt &&
    input.firstApiActionAt.getTime() - created < 60 * 1000;
  return quickConfirm || quickApi;
};

export interface RiskInput {
  email: string;
  agent?: string | null;
  ip?: string | null;
  otherUsersWithSameIp: number;
  providerName: string;
  activated: boolean;
  createdAt: Date;
  updatedAt: Date;
  channelCount: number;
  postCount: number;
  firstApiActionAt?: Date | null;
  now: Date;
}

export const riskFlagIds = (input: RiskInput): RiskFlagId[] => {
  const ids: RiskFlagId[] = [];
  if (isDisposableEmail(input.email)) ids.push('disposable_domain');
  if (isScriptedUserAgent(input.agent)) ids.push('scripted_user_agent');
  if (isSharedIp(input.ip, input.otherUsersWithSameIp)) ids.push('shared_ip');
  if (hasNoActivityAfter48h(input)) ids.push('no_activity_48h');
  if (isImpossiblySpeedy(input)) ids.push('impossible_speed');
  return ids;
};

export const riskScore = (ids: RiskFlagId[]): number =>
  Math.min(
    100,
    RISK_FLAGS.filter((f) => ids.includes(f.id)).reduce(
      (sum, f) => sum + f.weight,
      0
    )
  );

export const riskFor = (input: RiskInput) => {
  const flags = riskFlagIds(input);
  return { flags, score: riskScore(flags) };
};
