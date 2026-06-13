import { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  borderWidth?: number;
  speed?: number;
  glowIntensity?: number;
  colors?: string[];
}

/**
 * A rotating gradient neon border glow card.
 *
 * Works by layering an absolutely-positioned rotating conic-gradient behind
 * an inner content wrapper that is inset by `borderWidth`px — the narrow gap
 * reveals the spinning gradient, creating the border effect. A blurred copy
 * of the gradient beneath it supplies the neon glow.
 */
export default function RotatingBorderCard({
  children,
  className = '',
  borderWidth = 2,
  speed = 4,
  glowIntensity = 12,
  colors,
}: Props) {
  const palette = colors ?? ['#00e5ff', '#2a5aff', '#00e676', '#66f0ff'];
  const gradient = `conic-gradient(${palette.join(', ')})`;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        // Outer container clips both the glow blur and the rotating gradient
        isolation: 'isolate',
      }}
    >
      {/* Glow layer — blurred gradient behind the border */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: gradient,
          filter: `blur(${glowIntensity}px)`,
          opacity: 0.6,
          animation: `rotate-gradient ${speed}s linear infinite`,
        }}
      />

      {/* Rotating gradient border layer */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: gradient,
          animation: `rotate-gradient ${speed}s linear infinite`,
        }}
      />

      {/* Inner content — sits on top, inset to reveal the border */}
      <div
        className="relative rounded-2xl"
        style={{
          margin: `${borderWidth}px`,
          background: 'rgba(8, 4, 26, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {children}
      </div>
    </div>
  );
}