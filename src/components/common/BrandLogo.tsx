import React from 'react';

export type BrandLogoVariant = 'inside' | 'symbol' | 'outside' | 'wordmark';
export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface BrandLogoProps {
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  className?: string;
  alt?: string;
  onClick?: () => void;
}

const DIMENSIONS: Record<BrandLogoVariant, { baseWidth: number; baseHeight: number; aspectRatio: number }> = {
  inside: { baseWidth: 497, baseHeight: 132, aspectRatio: 497 / 132 },
  symbol: { baseWidth: 189, baseHeight: 132, aspectRatio: 189 / 132 },
  outside: { baseWidth: 202, baseHeight: 202, aspectRatio: 1 },
  wordmark: { baseWidth: 290, baseHeight: 104, aspectRatio: 290 / 104 },
};

const PRESET_HEIGHTS: Record<BrandLogoVariant, Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number>> = {
  inside: {
    xs: 20,
    sm: 26,
    md: 34,
    lg: 44,
    xl: 60,
  },
  symbol: {
    xs: 20,
    sm: 26,
    md: 34,
    lg: 48,
    xl: 64,
  },
  outside: {
    xs: 20,
    sm: 28,
    md: 40,
    lg: 56,
    xl: 80,
  },
  wordmark: {
    xs: 14,
    sm: 18,
    md: 24,
    lg: 32,
    xl: 44,
  },
};

const ASSET_SOURCES: Record<BrandLogoVariant, { src1x: string; src2x?: string; svg: string }> = {
  inside: {
    src1x: '/branding/mycinema-inside-logo.png',
    src2x: '/branding/mycinema-inside-logo@2x.png',
    svg: '/branding/mycinema-inside-logo.svg',
  },
  symbol: {
    src1x: '/branding/mycinema-inside-symbol.png',
    src2x: '/branding/mycinema-inside-symbol@2x.png',
    svg: '/branding/mycinema-inside-symbol.svg',
  },
  outside: {
    src1x: '/branding/mycinema-outside-icon.png',
    src2x: '/branding/mycinema-outside-icon-512.png',
    svg: '/branding/mycinema-outside-icon.svg',
  },
  wordmark: {
    src1x: '/branding/mycinema-wordmark.png',
    src2x: '/branding/mycinema-wordmark@2x.png',
    svg: '/branding/mycinema-wordmark.png',
  },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'inside',
  size = 'md',
  className = '',
  alt = 'MYCINEMA',
  onClick,
}) => {
  const meta = DIMENSIONS[variant];
  const targetHeight =
    typeof size === 'number'
      ? size
      : PRESET_HEIGHTS[variant][size] || PRESET_HEIGHTS[variant].md;

  const targetWidth = Math.round(targetHeight * meta.aspectRatio);
  const assets = ASSET_SOURCES[variant];

  return (
    <div
      className={`inline-flex items-center justify-center flex-shrink-0 select-none ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
      style={{
        height: `${targetHeight}px`,
        width: `${targetWidth}px`,
      }}
    >
      <img
        src={assets.src1x}
        srcSet={assets.src2x ? `${assets.src1x} 1x, ${assets.src2x} 2x` : undefined}
        alt={alt}
        width={targetWidth}
        height={targetHeight}
        decoding="async"
        loading="eager"
        className="w-full h-full object-contain pointer-events-none"
        style={{
          aspectRatio: `${meta.aspectRatio}`,
        }}
      />
    </div>
  );
};
