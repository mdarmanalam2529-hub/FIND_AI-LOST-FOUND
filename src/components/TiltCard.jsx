import React, { useRef, useState, useEffect } from 'react';

/**
 * TiltCard - Subtle 3D perspective tilt effect on hover with specular glare.
 * Uses lightweight CSS 3D transforms, runs at 60fps, and respects prefers-reduced-motion.
 */
export default function TiltCard({
  children,
  className = '',
  style = {},
  maxTilt = 7, // Restrained, professional tilt angle
  glare = true,
  scale = 1.02,
  id,
  onClick,
}) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleMouseMove = (e) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const tiltX = ((y - centerY) / centerY) * -maxTilt;
    const tiltY = ((x - centerX) / centerX) * maxTilt;

    setTilt({ x: tiltX, y: tiltY });

    if (glare) {
      setGlarePos({
        x: (x / rect.width) * 100,
        y: (y / rect.height) * 100,
        opacity: 0.18,
      });
    }
  };

  const handleMouseEnter = () => {
    if (reducedMotion) return;
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      id={id}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`tilt-card-wrapper ${className}`}
      style={{
        perspective: '1000px',
        transformStyle: 'preserve-3d',
        position: 'relative',
        transition: isHovered
          ? 'transform 0.1s ease-out'
          : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
        transform:
          !reducedMotion && isHovered
            ? `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale}) translateZ(4px)`
            : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1) translateZ(0px)',
        cursor: onClick ? 'pointer' : 'default',
        willChange: isHovered ? 'transform' : 'auto',
        ...style,
      }}
    >
      {children}

      {/* Dynamic Holographic Specular Glare Overlay */}
      {glare && !reducedMotion && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            pointerEvents: 'none',
            zIndex: 10,
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, ${glarePos.opacity}) 0%, rgba(99, 102, 241, 0.12) 30%, transparent 65%)`,
            transition: 'opacity 0.3s ease',
            opacity: isHovered ? 1 : 0,
          }}
        />
      )}
    </div>
  );
}
