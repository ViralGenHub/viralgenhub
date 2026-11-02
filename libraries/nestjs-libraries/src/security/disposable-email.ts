import { DISPOSABLE_DOMAINS } from '@gitroom/nestjs-libraries/security/disposable-domains';

let set: Set<string> | undefined;
const domains = () => (set ??= new Set(DISPOSABLE_DOMAINS));

export const emailDomain = (email: string): string => {
  const at = String(email || '').lastIndexOf('@');
  return at < 0
    ? ''
    : email
        .slice(at + 1)
        .trim()
        .toLowerCase()
        .replace(/\.$/, '');
};

// True when the domain, or any parent domain of it, is on the list
// (so "x.mailinator.com" matches "mailinator.com"; "co.uk" style public
// suffixes are not on the list, so a parent walk cannot over-match them).
export const isDisposableEmail = (email: string): boolean => {
  const parts = emailDomain(email).split('.').filter(Boolean);
  for (let i = 0; i < parts.length - 1; i++) {
    if (domains().has(parts.slice(i).join('.'))) {
      return true;
    }
  }
  return false;
};
