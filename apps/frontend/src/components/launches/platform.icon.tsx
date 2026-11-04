'use client';

import type { FC, ReactEventHandler } from 'react';

/**
 * Single place that renders a social platform icon.
 *
 * YouTube API Services branding rules (developers.google.com/youtube/terms/branding-guidelines,
 * policy III.F.2a): use the official full-colour logo as supplied, never smaller than 20dp tall,
 * never cropped into a circle/rounded shape, never given a border or other modification.
 * Every other platform keeps its existing PNG + the caller's styling.
 */
export const YOUTUBE_ICON_SRC = '/icons/platforms/youtube.svg';
export const YOUTUBE_MIN_HEIGHT = 20;

export const isYoutube = (identifier?: string | null) =>
  identifier === 'youtube';

export const platformIconSrc = (identifier?: string | null) =>
  isYoutube(identifier)
    ? YOUTUBE_ICON_SRC
    : `/icons/platforms/${identifier}.png`;

// Classes that would crop, outline or shrink the logo. Removed for YouTube only.
const YOUTUBE_FORBIDDEN_CLASSES =
  /(^|\s)(rounded(-[^\s]+)?|border(-[^\s]+)?|aspect-square|overflow-hidden|opacity-[^\s]+|w-\[[^\]]+\]|h-\[[^\]]+\]|min-w-\[[^\]]+\]|min-h-\[[^\]]+\]|w-full|h-full)(?=\s|$)/g;

export const youtubeSafeClassName = (className?: string) =>
  (className || '').replace(YOUTUBE_FORBIDDEN_CLASSES, ' ').replace(/\s+/g, ' ').trim();

type Props = {
  identifier?: string | null;
  /** Requested box size in px. YouTube is raised to at least 20px tall. */
  size?: number;
  className?: string;
  alt?: string;
  onError?: ReactEventHandler<HTMLImageElement>;
};

export const PlatformIcon: FC<Props> = ({
  identifier,
  size = 20,
  className,
  alt,
  onError,
}) => {
  if (isYoutube(identifier)) {
    const height = Math.max(size, YOUTUBE_MIN_HEIGHT);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={YOUTUBE_ICON_SRC}
        alt={alt || 'YouTube'}
        className={youtubeSafeClassName(className)}
        style={{ height, minHeight: YOUTUBE_MIN_HEIGHT, width: 'auto' }}
        onError={onError}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={platformIconSrc(identifier)}
      alt={alt || identifier || ''}
      className={className}
      width={size}
      height={size}
      onError={onError}
    />
  );
};
