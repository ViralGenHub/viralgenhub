'use client';

import type { FC, ReactEventHandler } from 'react';

/**
 * Single place that renders a social platform icon.
 *
 * YouTube API Services branding rules (developers.google.com/youtube/terms/branding-guidelines,
 * policy III.F.2a): use the official full-colour icon as supplied, at its own proportions (45:32),
 * never cropped into a circle/rounded shape, never given a border or other modification.
 * Google V.3 (12 Nov 2026): rendered height must never be under 20 CSS px, so the YouTube icon is
 * clamped to a 20px minimum height (>= 28.13px wide) wherever it is used, even as a small badge.
 * Every other platform keeps its existing PNG + the caller's styling.
 */
export const YOUTUBE_MIN_HEIGHT = 20;
export const YOUTUBE_ASPECT = 45 / 32;

/** Rendered size of the YouTube icon for a requested box size: 45:32, never under 20px tall. */
export const youtubeIconSize = (size: number) => {
  const height = Math.max(YOUTUBE_MIN_HEIGHT, (size * 32) / 45);
  return {
    width: Math.round(height * YOUTUBE_ASPECT * 100) / 100,
    height: Math.round(height * 100) / 100,
  };
};

export const YOUTUBE_ICON_SRC = '/icons/platforms/youtube.svg';

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
  /** Requested box size in px. YouTube keeps its 45:32 ratio and is never under 20px tall. */
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
    // Official icon at its own 45:32 proportions, never under 20px tall, never squashed,
    // stretched, cropped or bordered. Inline size wins over any caller class.
    const { width, height } = youtubeIconSize(size);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={YOUTUBE_ICON_SRC}
        alt={alt || 'YouTube'}
        className={youtubeSafeClassName(className)}
        style={{
          width,
          height,
          minWidth: width,
          minHeight: height,
          maxWidth: 'none',
          maxHeight: 'none',
          flexShrink: 0,
        }}
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
