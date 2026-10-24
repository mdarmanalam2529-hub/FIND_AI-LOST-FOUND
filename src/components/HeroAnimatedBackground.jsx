import React, { useEffect, useRef, useState } from 'react';
import AiOrb3D from './AiOrb3D';

/**
 * HeroAnimatedBackground - Multi-layer, GPU-friendly atmospheric background
 * Built for FindAI's approved LIGHT BLUE + WHITE + CYAN design system.
 * Features:
 * - Clean light blue base (#F0F7FF) with luminous cyan (#22D3EE) & primary blue (#2563EB) ambient glows
 * - Lightweight Canvas2D neural particle network with proximity connection vectors
 * - Parallax mouse response with smooth damping
 * - Subtle floating radial glows with slow, organic float animations
 * - Fine geometric grid lines with radial fade mask
 * - Flexible variants: 'hero' (full constellation), 'ambient' (dashboard/auth), 'minimal' (report forms)
 * - Respects prefers-reduced-motion and pauses when scrolled out of view
 * - Fully non-interactive (pointer-events: none) and behind all content
 */
export default function HeroAnimatedBackground({
  showOrb = false,
  variant = 'hero',
  className = '',
  style = {},
  bottomFade = variant === 'hero',
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameId = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

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

  // Neural Particle Constellation Canvas (active for 'hero' and 'ambient')
  useEffect(() => {
    if (variant === 'minimal') return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isVisible = true;
    let observer;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        ([entry]) => {
          isVisible = entry.isIntersecting;
          if (isVisible && !reducedMotion && !animFrameId.current) {
            lastTime = performance.now();
            animFrameId.current = requestAnimationFrame(render);
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(container);
    }

    let width = (canvas.width = container.clientWidth);
    let height = (canvas.height = container.clientHeight);

    const handleResize = () => {
      if (!container || !canvas) return;
      width = canvas.width = container.clientWidth;
      height = canvas.height = container.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle pool setup - restrained count for optimal 60fps performance
    const baseCount = variant === 'ambient' ? 14 : 26;
    const particleCount = Math.min(baseCount, Math.max(10, Math.floor(width / (variant === 'ambient' ? 70 : 45))));
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (variant === 'ambient' ? 0.2 : 0.32),
        vy: (Math.random() - 0.5) * (variant === 'ambient' ? 0.2 : 0.32),
        radius: 1.4 + Math.random() * 1.6,
        alpha: variant === 'ambient' ? 0.25 + Math.random() * 0.35 : 0.35 + Math.random() * 0.45,
        // Approved palette: Cyan (8, 145, 178), Primary Blue (37, 99, 235), Sky (2, 132, 199)
        color: i % 3 === 0 ? '8, 145, 178' : i % 3 === 1 ? '37, 99, 235' : '2, 132, 199',
      });
    }

    let lastTime = performance.now();
    const maxConnectDist = variant === 'ambient' ? 110 : 135;
    const maxConnectDistSq = maxConnectDist * maxConnectDist;

    function render(now) {
      if (!isVisible) {
        animFrameId.current = null;
        return;
      }

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Mouse lerp damping
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      ctx.clearRect(0, 0, width, height);

      // Render connected lines
      ctx.lineWidth = 0.85;
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];

        if (!reducedMotion) {
          p1.x += p1.vx * (dt * 60);
          p1.y += p1.vy * (dt * 60);

          // Wrap edges smoothly
          if (p1.x < -20) p1.x = width + 20;
          if (p1.x > width + 20) p1.x = -20;
          if (p1.y < -20) p1.y = height + 20;
          if (p1.y > height + 20) p1.y = -20;
        }

        const renderX1 = p1.x + mouse.x * 12;
        const renderY1 = p1.y + mouse.y * 12;

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const renderX2 = p2.x + mouse.x * 12;
          const renderY2 = p2.y + mouse.y * 12;

          const dx = renderX1 - renderX2;
          const dy = renderY1 - renderY2;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxConnectDistSq) {
            const dist = Math.sqrt(distSq);
            const lineAlpha = (1 - dist / maxConnectDist) * (variant === 'ambient' ? 0.16 : 0.28);
            ctx.strokeStyle = `rgba(37, 99, 235, ${lineAlpha})`;
            ctx.beginPath();
            ctx.moveTo(renderX1, renderY1);
            ctx.lineTo(renderX2, renderY2);
            ctx.stroke();
          }
        }
      }

      // Render particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const px = p.x + mouse.x * 16;
        const py = p.y + mouse.y * 16;

        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reducedMotion) {
        animFrameId.current = requestAnimationFrame(render);
      }
    }

    if (reducedMotion) {
      render(performance.now());
    } else {
      animFrameId.current = requestAnimationFrame(render);
    }

    // Parallax mouse move listener on window
    const handleMouseMove = (e) => {
      if (reducedMotion) return;
      const nx = (e.clientX / window.innerWidth) - 0.5;
      const ny = (e.clientY / window.innerHeight) - 0.5;
      mouseRef.current.targetX = nx;
      mouseRef.current.targetY = ny;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [reducedMotion, variant]);

  return (
    <div
      ref={containerRef}
      className={`hero-animated-bg-container ${className}`}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        background: 'radial-gradient(ellipse 90% 65% at 50% -12%, #E0F2FE 0%, #F0F7FF 60%, #F8FAFC 100%)',
        ...style,
      }}
    >
      {/* Layer 1: Ambient Floating Radial Light Glows (Cyan & Royal Blue) */}
      <div
        className="hero-glow-blob hero-glow-blob-cyan"
        style={{
          position: 'absolute',
          top: '-15%',
          right: '5%',
          width: 'min(640px, 80vw)',
          height: 'min(640px, 80vw)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.28) 0%, rgba(34, 211, 238, 0.08) 50%, transparent 70%)',
          filter: 'blur(75px)',
          opacity: variant === 'minimal' ? 0.5 : 0.85,
          willChange: 'transform',
        }}
      />

      <div
        className="hero-glow-blob hero-glow-blob-blue"
        style={{
          position: 'absolute',
          top: '25%',
          left: '-10%',
          width: 'min(580px, 75vw)',
          height: 'min(580px, 75vw)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.16) 0%, rgba(37, 99, 235, 0.04) 55%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: variant === 'minimal' ? 0.45 : 0.8,
          willChange: 'transform',
        }}
      />

      <div
        className="hero-glow-blob hero-glow-blob-violet"
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '25%',
          width: 'min(480px, 60vw)',
          height: 'min(480px, 60vw)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, rgba(99, 102, 241, 0.02) 50%, transparent 70%)',
          filter: 'blur(70px)',
          opacity: variant === 'minimal' ? 0.35 : 0.65,
          willChange: 'transform',
        }}
      />

      {/* Layer 2: Fine Geometric Grid Lines with Edge Vignette */}
      {variant !== 'minimal' && (
        <div
          className="hero-grid-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(to right, rgba(37, 99, 235, 0.045) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(37, 99, 235, 0.045) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 85% 75% at 50% 35%, black 40%, transparent 88%)',
            WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 50% 35%, black 40%, transparent 88%)',
            opacity: 0.85,
          }}
        />
      )}

      {/* Layer 3: Floating Neural Constellation Canvas */}
      {variant !== 'minimal' && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            width: '100%',
            height: '100%',
          }}
        />
      )}

      {/* Layer 4: Floating 3D AI Orb behind the Hero Showcase Area */}
      {showOrb && (
        <div
          className="hero-orb-backdrop"
          style={{
            position: 'absolute',
            top: '8%',
            right: '2%',
            width: 'min(500px, 50vw)',
            height: 'min(500px, 50vw)',
            opacity: 0.75,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AiOrb3D size={460} showBadge={false} interactive={false} />
        </div>
      )}

      {/* Layer 5: Bottom Soft Transition Gradient (Hero section only) */}
      {bottomFade && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '100px',
            background: 'linear-gradient(to bottom, transparent, var(--bg-surface, #ffffff))',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
