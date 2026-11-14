// Mirrors apps/frontend/.../platform.icon.tsx youtubeIconSize (Google policy III.F.2a: >= 20px tall, 45:32).
// Kept as a pure copy of the formula so the frontend file (React, 'use client') need not load in jest.
import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(
  join(__dirname, '../../../../apps/frontend/src/components/launches/platform.icon.tsx'),
  'utf8'
);

const youtubeIconSize = (size: number) => {
  const height = Math.max(20, (size * 32) / 45);
  return {
    width: Math.round(height * (45 / 32) * 100) / 100,
    height: Math.round(height * 100) / 100,
  };
};

describe('YouTube icon size', () => {
  it('formula in platform.icon.tsx is the one tested here', () => {
    expect(src).toContain('Math.max(YOUTUBE_MIN_HEIGHT, (size * 32) / 45)');
    expect(src).toContain('YOUTUBE_MIN_HEIGHT = 20');
    expect(src).toContain('YOUTUBE_ASPECT = 45 / 32');
  });
  it.each([12, 14, 15, 16, 18.41, 20, 24, 28, 32, 42, 64])(
    'is never under 20px tall for requested size %s',
    (size) => {
      const { width, height } = youtubeIconSize(size);
      expect(height).toBeGreaterThanOrEqual(20);
      expect(width / height).toBeCloseTo(45 / 32, 1);
    }
  );
  it('small sizes give 28.13 x 20', () => {
    expect(youtubeIconSize(18.41)).toEqual({ width: 28.13, height: 20 });
  });
});
