import {
  RiskInput,
  hasNoActivityAfter48h,
  isCloudflareIp,
  isImpossiblySpeedy,
  isScriptedUserAgent,
  isSharedIp,
  riskFor,
  riskScore,
} from '@gitroom/nestjs-libraries/admin-insights/risk.flags';

const now = new Date('2026-11-02T12:00:00Z');
const at = (iso: string) => new Date(iso);

describe('isScriptedUserAgent', () => {
  it.each([
    'curl/8.4.0',
    'Wget/1.21',
    'python-requests/2.31.0',
    'python-httpx/0.27',
    'Go-http-client/2.0',
    'node-fetch/1.0',
    'axios/1.6.0',
    'Mozilla/5.0 HeadlessChrome/120.0',
  ])('flags %s', (agent) => expect(isScriptedUserAgent(agent)).toBe(true));

  it.each([
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    '',
    null,
    undefined,
  ])('does not flag %s', (agent) => expect(isScriptedUserAgent(agent as any)).toBe(false));
});

describe('isCloudflareIp / isSharedIp', () => {
  it('recognises Cloudflare ranges (v4 and v6)', () => {
    expect(isCloudflareIp('172.71.10.5')).toBe(true);
    expect(isCloudflareIp('104.23.1.1')).toBe(true);
    expect(isCloudflareIp('162.159.140.9')).toBe(true);
    expect(isCloudflareIp('2606:4700:3030::1')).toBe(true);
    expect(isCloudflareIp('::ffff:172.71.10.5')).toBe(true);
  });
  it('does not treat ordinary addresses as Cloudflare', () => {
    expect(isCloudflareIp('203.0.113.9')).toBe(false);
    expect(isCloudflareIp('138.201.118.3')).toBe(false);
    expect(isCloudflareIp('2a00:1450::1')).toBe(false);
    expect(isCloudflareIp(null)).toBe(false);
  });
  it('flags a shared ordinary address only', () => {
    expect(isSharedIp('203.0.113.9', 1)).toBe(true);
    expect(isSharedIp('203.0.113.9', 0)).toBe(false);
    expect(isSharedIp('172.71.10.5', 5)).toBe(false); // Cloudflare edge = unknown
    expect(isSharedIp(null, 5)).toBe(false);
  });
});

describe('hasNoActivityAfter48h', () => {
  const base = { now, channelCount: 0, postCount: 0 };
  it('flags a 3 day old empty account', () => {
    expect(hasNoActivityAfter48h({ ...base, createdAt: at('2026-10-30T12:00:00Z') })).toBe(true);
  });
  it('does not flag a 1 day old account, or one with a channel or a post', () => {
    expect(hasNoActivityAfter48h({ ...base, createdAt: at('2026-11-01T12:00:00Z') })).toBe(false);
    expect(hasNoActivityAfter48h({ ...base, channelCount: 1, createdAt: at('2026-10-01T00:00:00Z') })).toBe(false);
    expect(hasNoActivityAfter48h({ ...base, postCount: 1, createdAt: at('2026-10-01T00:00:00Z') })).toBe(false);
  });
});

describe('isImpossiblySpeedy', () => {
  const created = at('2026-11-02T10:00:00Z');
  it('flags an email account confirmed within 60 seconds', () => {
    expect(
      isImpossiblySpeedy({ providerName: 'LOCAL', activated: true, createdAt: created, updatedAt: at('2026-11-02T10:00:20Z') })
    ).toBe(true);
  });
  it('does not flag a confirmation after a few minutes', () => {
    expect(
      isImpossiblySpeedy({ providerName: 'LOCAL', activated: true, createdAt: created, updatedAt: at('2026-11-02T10:05:00Z') })
    ).toBe(false);
  });
  it('does not use the update time for social sign-in or unconfirmed accounts', () => {
    expect(
      isImpossiblySpeedy({ providerName: 'GOOGLE', activated: true, createdAt: created, updatedAt: at('2026-11-02T10:00:05Z') })
    ).toBe(false);
    expect(
      isImpossiblySpeedy({ providerName: 'LOCAL', activated: false, createdAt: created, updatedAt: at('2026-11-02T10:00:05Z') })
    ).toBe(false);
  });
  it('flags a first API action within 60 seconds, any provider', () => {
    expect(
      isImpossiblySpeedy({ providerName: 'GOOGLE', activated: true, createdAt: created, updatedAt: at('2026-11-02T11:00:00Z'), firstApiActionAt: at('2026-11-02T10:00:30Z') })
    ).toBe(true);
    expect(
      isImpossiblySpeedy({ providerName: 'GOOGLE', activated: true, createdAt: created, updatedAt: at('2026-11-02T11:00:00Z'), firstApiActionAt: at('2026-11-02T10:30:00Z') })
    ).toBe(false);
  });
});

describe('riskFor', () => {
  const clean: RiskInput = {
    email: 'person@gmail.com',
    agent: 'Mozilla/5.0 Safari',
    ip: '203.0.113.9',
    otherUsersWithSameIp: 0,
    providerName: 'LOCAL',
    activated: true,
    createdAt: at('2026-11-02T10:00:00Z'),
    updatedAt: at('2026-11-02T10:10:00Z'),
    channelCount: 1,
    postCount: 0,
    now,
  };

  it('a normal sign-up scores 0', () => {
    expect(riskFor(clean)).toEqual({ flags: [], score: 0 });
  });

  it('adds the flags up and caps at 100', () => {
    const bad = riskFor({
      ...clean,
      email: 'x@mailinator.com',
      agent: 'curl/8.4.0',
      otherUsersWithSameIp: 2,
      updatedAt: at('2026-11-02T10:00:10Z'),
    });
    expect(bad.flags).toEqual(['disposable_domain', 'scripted_user_agent', 'shared_ip', 'impossible_speed']);
    expect(bad.score).toBe(100);
  });

  it('scores one flag by its weight', () => {
    expect(riskScore(['scripted_user_agent'])).toBe(25);
    expect(riskScore([])).toBe(0);
  });
});
