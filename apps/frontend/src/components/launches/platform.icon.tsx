'use client';

import type { FC, ReactEventHandler } from 'react';

/**
 * Single place that renders a social platform icon.
 *
 * YouTube API Services branding rules (developers.google.com/youtube/terms/branding-guidelines,
 * policy III.F.2a): use the official full-colour icon as supplied, at its own proportions (45:32),
 * never cropped into a circle/rounded shape, never given a border or other modification.
 * Joseph (11 Nov 2026): same footprint as the other platforms' icons, not larger.
 * Every other platform keeps its existing PNG + the caller's styling.
 */
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
  /** Requested box size in px. YouTube uses it as its width and keeps its 45:32 ratio. */
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
    // Same footprint as every other platform icon (a size x size box), but the official icon is
    // drawn at its own 45:32 proportions: never squashed, stretched, cropped or bordered.
    const width = size;
    const height = Math.round(((size * 32) / 45) * 100) / 100;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={YOUTUBE_ICON_SRC}
        alt={alt || 'YouTube'}
        className={youtubeSafeClassName(className)}
        style={{ width, height }}
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
