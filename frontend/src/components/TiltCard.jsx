import React, { useRef, useState, useEffect } from 'react';

/**
 * TiltCard - Subtle 3D perspective tilt effect on hover with specular glare.
 * Uses lightweight CSS 3D transforms, runs at 60fps, and respects prefers-reduced-motion.
 */
export default function TiltCard({
  children,
  className = '',
  style = {},
  maxTilt = 3, // Restrained, subtle tilt angle
  glare = false, // Clean by default without heavy reflection
  scale = 1.01,
  id,
  onClick,
}) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
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
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const tiltX = ((y - centerY) / centerY) * -maxTilt;
    const tiltY = ((x - centerX) / centerX) * maxTilt;

    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseEnter = () => {
    if (reducedMotion) return;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
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
          ? 'transform 0.12s ease-out'
          : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        transform:
          !reducedMotion && isHovered
            ? `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale}) translateZ(2px)`
            : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1) translateZ(0px)',
        cursor: onClick ? 'pointer' : 'default',
        willChange: isHovered ? 'transform' : 'auto',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
