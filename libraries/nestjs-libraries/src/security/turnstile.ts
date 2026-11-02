// Cloudflare Turnstile (bot check on email sign-up and login).
//
// Off unless TURNSTILE_SECRET_KEY is set, so self-hosters are unaffected.
// The browser sends the widget token in the `x-turnstile-token` header
// (header, not body, so the auth DTOs stay as upstream).
//
// Fail closed: when Cloudflare cannot be reached the request is refused
// with a plain "try again" message rather than let a bot through.
export const TURNSTILE_HEADER = 'x-turnstile-token';
export const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// (the repo compiles without strictNullChecks, so this is not a tagged union)
export interface TurnstileResult {
  ok: boolean;
  skipped?: boolean;
  message?: string;
}

export const TURNSTILE_MESSAGES = {
  missing: 'Please complete the security check and try again.',
  failed: 'The security check did not pass. Please try again.',
  unreachable:
    'We could not run the security check right now. Please try again in a minute.',
};

export const turnstileEnabled = () => !!process.env.TURNSTILE_SECRET_KEY;

export const verifyTurnstile = async (
  token: string | undefined,
  ip: string | undefined
): Promise<TurnstileResult> => {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: true, skipped: true };
  }

  if (!token || typeof token !== 'string') {
    return { ok: false, message: TURNSTILE_MESSAGES.missing };
  }

  try {
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token);
    if (ip) {
      form.set('remoteip', ip);
    }

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { ok: false, message: TURNSTILE_MESSAGES.unreachable };
    }

    const data = (await res.json()) as { success?: boolean };
    return data?.success === true
      ? { ok: true }
      : { ok: false, message: TURNSTILE_MESSAGES.failed };
  } catch {
    return { ok: false, message: TURNSTILE_MESSAGES.unreachable };
  }
};
