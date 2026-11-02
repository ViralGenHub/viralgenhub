import {
  DISPOSABLE_EMAIL_MESSAGE,
  DisposableEmailGuard,
} from '@gitroom/nestjs-libraries/security/disposable-email.guard';
import {
  emailDomain,
  isDisposableEmail,
} from '@gitroom/nestjs-libraries/security/disposable-email';
import { DISPOSABLE_DOMAINS } from '@gitroom/nestjs-libraries/security/disposable-domains';

const ctx = (body: any): any => ({
  switchToHttp: () => ({ getRequest: () => ({ body }) }),
});

describe('isDisposableEmail', () => {
  it('ships a real list', () => {
    expect(DISPOSABLE_DOMAINS.length).toBeGreaterThan(300);
  });

  it('matches well-known disposable domains, any case', () => {
    expect(isDisposableEmail('a@mailinator.com')).toBe(true);
    expect(isDisposableEmail('A@MAILINATOR.COM')).toBe(true);
    expect(isDisposableEmail('a@guerrillamail.com')).toBe(true);
    expect(isDisposableEmail('a@yopmail.com')).toBe(true);
  });

  it('matches subdomains of a listed domain', () => {
    expect(isDisposableEmail('a@inbox.mailinator.com')).toBe(true);
  });

  it('does not match normal providers, company domains or look-alikes', () => {
    for (const e of [
      'a@gmail.com',
      'a@outlook.com',
      'a@icloud.com',
      'a@viralgenhub.com',
      'a@talkiru.co.uk',
      'a@xmailinator.example',
      'a@mailinator.com.example.org',
    ]) {
      expect(isDisposableEmail(e)).toBe(false);
    }
  });

  it('handles junk input', () => {
    expect(isDisposableEmail('')).toBe(false);
    expect(isDisposableEmail('no-at-sign')).toBe(false);
    expect(emailDomain('x@Example.COM.')).toBe('example.com');
  });
});

describe('DisposableEmailGuard', () => {
  const guard = new DisposableEmailGuard();

  it('refuses a disposable email sign-up with a plain message', () => {
    let error: any;
    try {
      guard.canActivate(ctx({ provider: 'LOCAL', email: 'a@mailinator.com' }));
    } catch (e) {
      error = e;
    }
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe(DISPOSABLE_EMAIL_MESSAGE);
  });

  it('allows a normal email and social sign-in', () => {
    expect(guard.canActivate(ctx({ provider: 'LOCAL', email: 'a@gmail.com' }))).toBe(true);
    expect(
      guard.canActivate(ctx({ provider: 'GOOGLE', providerToken: 'x', email: 'a@mailinator.com' }))
    ).toBe(true);
  });
});
