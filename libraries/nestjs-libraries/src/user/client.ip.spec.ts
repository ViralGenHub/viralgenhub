// #507: the stored sign-up / login IP must be the visitor, not the
// Cloudflare edge address that express reports as req.ip.
import { clientIpFromContext } from '@gitroom/nestjs-libraries/user/client.ip';

const ctx = (req: Record<string, any>): any => ({
  switchToHttp: () => ({ getRequest: () => req }),
});

describe('clientIpFromContext (#507)', () => {
  const saved = process.env.TRUST_CF_CONNECTING_IP;
  afterEach(() => {
    if (saved === undefined) delete process.env.TRUST_CF_CONNECTING_IP;
    else process.env.TRUST_CF_CONNECTING_IP = saved;
  });

  const req = () => ({
    ip: '172.71.10.5', // a Cloudflare edge address
    headers: { 'cf-connecting-ip': '203.0.113.9' },
  });

  it('uses CF-Connecting-IP when TRUST_CF_CONNECTING_IP is set', () => {
    process.env.TRUST_CF_CONNECTING_IP = '1';
    expect(clientIpFromContext(undefined, ctx(req()))).toBe('203.0.113.9');
  });

  it('uses req.ip when the env is not set (a client cannot pick its address)', () => {
    delete process.env.TRUST_CF_CONNECTING_IP;
    expect(clientIpFromContext(undefined, ctx(req()))).toBe('172.71.10.5');
  });

  it('uses req.ip when the header is missing', () => {
    process.env.TRUST_CF_CONNECTING_IP = '1';
    expect(
      clientIpFromContext(undefined, ctx({ ip: '198.51.100.7', headers: {} }))
    ).toBe('198.51.100.7');
  });
});
