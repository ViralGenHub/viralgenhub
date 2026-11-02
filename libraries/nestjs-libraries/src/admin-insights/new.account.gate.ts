// New workspaces cannot use the Public API (API key) for their first 24 hours
// unless they have connected a channel. This stops scripted sign-up -> API
// abuse. People who sign in through the website (including MCP via the web
// OAuth login) are not affected, and neither are excluded workspaces.
export const NEW_ACCOUNT_API_DELAY_MS = 24 * 60 * 60 * 1000;

// (the repo compiles without strictNullChecks, so this is not a tagged union)
export interface NewAccountGate {
  allowed: boolean;
  availableAt?: Date;
  msg?: string;
}

export const newAccountApiGate = (input: {
  createdAt: Date | string;
  now?: Date;
  channelCount: number;
  exempt: boolean;
}): NewAccountGate => {
  const now = input.now ?? new Date();
  const availableAt = new Date(
    new Date(input.createdAt).getTime() + NEW_ACCOUNT_API_DELAY_MS
  );
  if (input.exempt || input.channelCount > 0 || now >= availableAt) {
    return { allowed: true };
  }

  return {
    allowed: false,
    availableAt,
    msg:
      `The Public API opens 24 hours after you sign up, or as soon as you connect your first channel. ` +
      `It will work from ${availableAt.toISOString()}. You can use the website or connect a channel now.`,
  };
};
