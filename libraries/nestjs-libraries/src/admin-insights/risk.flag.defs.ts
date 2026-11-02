// Names, weights and tooltips of the sign-up risk flags. No imports, so the
// admin page can use it without pulling the disposable-domain list into the
// browser bundle.
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
