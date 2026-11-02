import { TurnstileGuard } from '@gitroom/nestjs-libraries/security/turnstile.guard';
import {
  TURNSTILE_MESSAGES,
  verifyTurnstile,
} from '@gitroom/nestjs-libraries/security/turnstile';

const ctx = (req: any): any => ({
  switchToHttp: () => ({ getRequest: () => req }),
});

const reply = (body: unknown, ok = true) =>
  ({ ok, json: async () => body } as any);

describe('Turnstile', () => {
  const savedSecret = process.env.TURNSTILE_SECRET_KEY;
  const savedFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  });
  afterEach(() => {
    global.fetch = savedFetch;
    if (savedSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = savedSecret;
  });

  it('allows everything when TURNSTILE_SECRET_KEY is unset (no call made)', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    await expect(verifyTurnstile(undefined, '1.2.3.4')).resolves.toEqual({
      ok: true,
      skipped: true,
    });
    const guard = new TurnstileGuard();
    await expect(
      guard.canActivate(ctx({ body: { provider: 'LOCAL' }, headers: {} }))
    ).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows a token Cloudflare accepts, and sends the secret, token and client ip', async () => {
    fetchMock.mockResolvedValue(reply({ success: true }));
    await expect(verifyTurnstile('tok', '203.0.113.9')).resolves.toEqual({
      ok: true,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    );
    const sent = new URLSearchParams(init.body);
    expect(sent.get('secret')).toBe('test-secret');
    expect(sent.get('response')).toBe('tok');
    expect(sent.get('remoteip')).toBe('203.0.113.9');
  });

  it('refuses a token Cloudflare rejects', async () => {
    fetchMock.mockResolvedValue(reply({ success: false }));
    await expect(verifyTurnstile('bad', '1.1.1.1')).resolves.toEqual({
      ok: false,
      message: TURNSTILE_MESSAGES.failed,
    });
  });

  it('refuses a missing token without calling Cloudflare', async () => {
    await expect(verifyTurnstile(undefined, '1.1.1.1')).resolves.toEqual({
      ok: false,
      message: TURNSTILE_MESSAGES.missing,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed with a clear message when Cloudflare is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(verifyTurnstile('tok', '1.1.1.1')).resolves.toEqual({
      ok: false,
      message: TURNSTILE_MESSAGES.unreachable,
    });
    fetchMock.mockResolvedValue(reply({}, false));
    await expect(verifyTurnstile('tok', '1.1.1.1')).resolves.toEqual({
      ok: false,
      message: TURNSTILE_MESSAGES.unreachable,
    });
  });

  describe('guard', () => {
    const guard = new TurnstileGuard();

    it('throws a 400 when the check fails', async () => {
      fetchMock.mockResolvedValue(reply({ success: false }));
      await expect(
        guard.canActivate(
          ctx({
            body: { provider: 'LOCAL' },
            headers: { 'x-turnstile-token': 'bad' },
            ip: '1.1.1.1',
          })
        )
      ).rejects.toMatchObject({ status: 400 });
    });

    it('passes when the check succeeds', async () => {
      fetchMock.mockResolvedValue(reply({ success: true }));
      await expect(
        guard.canActivate(
          ctx({
            body: { provider: 'LOCAL' },
            headers: { 'x-turnstile-token': 'good' },
            ip: '1.1.1.1',
          })
        )
      ).resolves.toBe(true);
    });

    it('skips social sign-in (the provider already verified the person)', async () => {
      await expect(
        guard.canActivate(
          ctx({ body: { provider: 'GOOGLE', providerToken: 'x' }, headers: {} })
        )
      ).resolves.toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
