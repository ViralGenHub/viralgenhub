'use client';

import { FC, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useVariables } from '@gitroom/react/helpers/variable.context';

// Cloudflare Turnstile on the email sign-up and login forms. It renders only
// when TURNSTILE_SITE_KEY is set (see (app)/layout.tsx); with no key the forms
// are exactly as before. The token goes to the API in the x-turnstile-token
// header and is single-use, so the widget is reset after every failed attempt.
const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | undefined;
const loadScript = () =>
  (scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('turnstile script failed'));
    };
    document.head.appendChild(script);
  }));

// The API refuses with a JSON body ({"message": "..."}) for guard errors and
// plain text for the controller's own errors; show the words either way.
export const responseErrorText = async (response: Response) => {
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    if (typeof json?.message === 'string') {
      return json.message as string;
    }
    if (Array.isArray(json?.message)) {
      return json.message.join(', ') as string;
    }
  } catch {
    // plain text
  }
  return text;
};

const TurnstileBox: FC<{
  siteKey: string;
  onToken: (token: string) => void;
  resetRef: { current: (() => void) | null };
}> = ({ siteKey, onToken, resetRef }) => {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) {
          return;
        }
        widgetId.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        });
        resetRef.current = () => {
          onToken('');
          window.turnstile?.reset(widgetId.current);
        };
      })
      .catch(() => onToken(''));
    return () => {
      cancelled = true;
      resetRef.current = null;
      if (widgetId.current) {
        window.turnstile?.remove(widgetId.current);
      }
    };
  }, [siteKey]);

  return <div ref={box} data-testid="turnstile-widget" />;
};

export const useTurnstile = (
  active: boolean = true
): {
  enabled: boolean;
  token: string;
  widget: ReactNode;
  headers: () => Record<string, string>;
  reset: () => void;
} => {
  const { turnstileSiteKey } = useVariables();
  const enabled = !!turnstileSiteKey && active;
  const [token, setToken] = useState('');
  const resetRef = useRef<(() => void) | null>(null);
  const reset = useCallback(() => resetRef.current?.(), []);

  return {
    enabled,
    token,
    widget: enabled ? (
      <TurnstileBox
        siteKey={turnstileSiteKey!}
        onToken={setToken}
        resetRef={resetRef}
      />
    ) : null,
    headers: () => (enabled && token ? { 'x-turnstile-token': token } : {}),
    reset,
  };
};
