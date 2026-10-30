import React, { useEffect, useRef, useState } from 'react';

/**
 * AiOrb3D - A futuristic, lightweight 3D holographic AI neural orb
 * Built with pure Canvas2D and 3D vector projection math.
 * Zero heavy 3D engine overhead, 60fps GPU-accelerated rendering,
 * responsive to cursor tilt, and respects prefers-reduced-motion.
 */
export default function AiOrb3D({
  size = 420,
  className = '',
  showBadge = true,
  interactive = true,
  style = {},
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameId = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, isHovered: false });
  const [reducedMotion, setReducedMotion] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isVisible = true;
    let observer;
    if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          isVisible = entry.isIntersecting;
          if (isVisible && !reducedMotion && !animFrameId.current) {
            lastTime = performance.now();
            animFrameId.current = requestAnimationFrame(renderLoop);
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(containerRef.current);
    }

    // High DPI Scaling
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displaySize = size;
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.maxWidth = `${displaySize}px`;
    canvas.style.maxHeight = `${displaySize}px`;

    // 3D Sphere Nodes Generator (Fibonacci sphere algorithm for balanced node distribution)
    const nodeCount = 54;
    const sphereRadius = displaySize * 0.32;
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle in radians
    const nodes = [];

    for (let i = 0; i < nodeCount; i++) {
      const y = 1 - (i / (nodeCount - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y); // radius at y
      const theta = phi * i; // golden angle increment
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      nodes.push({
        baseX: x * sphereRadius,
        baseY: y * sphereRadius,
        baseZ: z * sphereRadius,
        pulseOffset: Math.random() * Math.PI * 2,
        pulseSpeed: 1.5 + Math.random() * 1.5,
      });
    }

    // Ambient floating stardust particles
    const particleCount = 28;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      const rad = sphereRadius * (0.9 + Math.random() * 0.8);
      const theta = Math.random() * Math.PI * 2;
      const phiAngle = (Math.random() - 0.5) * Math.PI;
      particles.push({
        x: rad * Math.cos(phiAngle) * Math.cos(theta),
        y: rad * Math.sin(phiAngle),
        z: rad * Math.cos(phiAngle) * Math.sin(theta),
        speed: 0.0008 + Math.random() * 0.0015,
        orbitRadius: rad,
        angle: theta,
        size: 1 + Math.random() * 2,
        alpha: 0.2 + Math.random() * 0.5,
      });
    }

    // Angles and speeds
    let rotY = 0;
    let rotX = 0.25;
    let ringAngle1 = 0;
    let ringAngle2 = Math.PI / 3;
    let lastTime = performance.now();

    const focalLength = displaySize * 1.1;
    const centerX = (displaySize * dpr) / 2;
    const centerY = (displaySize * dpr) / 2;

    // 3D Rotation helper
    function rotate3D(x, y, z, pitch, yaw) {
      // Rotate around X (pitch)
      const cosX = Math.cos(pitch);
      const sinX = Math.sin(pitch);
      const y1 = y * cosX - z * sinX;
      const z1 = y * sinX + z * cosX;

      // Rotate around Y (yaw)
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const x2 = x * cosY + z1 * sinY;
      const z2 = -x * sinY + z1 * cosY;

      return { x: x2, y: y1, z: z2 };
    }

    function renderLoop(now) {
      if (!isVisible) {
        animFrameId.current = null;
        return;
      }

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Smooth mouse lerp
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      if (!reducedMotion) {
        rotY += 0.35 * dt;
        ringAngle1 += 0.5 * dt;
        ringAngle2 -= 0.38 * dt;
      }

      const activePitch = rotX + mouse.y * 0.35;
      const activeYaw = rotY + mouse.x * 0.45;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Deep Volumetric Core Glow
      const corePulse = 0.88 + 0.12 * Math.sin(now * 0.0025);
      const coreGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        sphereRadius * 0.1 * dpr,
        centerX,
        centerY,
        sphereRadius * 1.15 * dpr * corePulse
      );
      coreGrad.addColorStop(0, 'rgba(34, 211, 238, 0.45)'); // Luminous Cyan #22D3EE
      coreGrad.addColorStop(0.35, 'rgba(37, 99, 235, 0.28)'); // Primary Blue #2563EB
      coreGrad.addColorStop(0.7, 'rgba(99, 102, 241, 0.12)'); // Soft Indigo
      coreGrad.addColorStop(1, 'rgba(240, 247, 255, 0)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, sphereRadius * 1.2 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // 2. Project 3D Nodes
      const projectedNodes = [];
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        // Subtle node breathing
        const rOffset = 1 + 0.04 * Math.sin(now * 0.003 * node.pulseSpeed + node.pulseOffset);
        const rotated = rotate3D(
          node.baseX * rOffset,
          node.baseY * rOffset,
          node.baseZ * rOffset,
          activePitch,
          activeYaw
        );

        const depth = focalLength / (focalLength + rotated.z);
        const px = centerX + rotated.x * depth * dpr;
        const py = centerY + rotated.y * depth * dpr;

        projectedNodes.push({
          px,
          py,
          z: rotated.z,
          depth,
          original: node,
        });
      }

      // Sort by Z for realistic depth occlusion (back nodes drawn first)
      projectedNodes.sort((a, b) => a.z - b.z);

      // 3. Draw Connecting Neural Vectors
      ctx.lineWidth = 1 * dpr;
      const maxConnectDistSq = Math.pow(sphereRadius * 0.65 * dpr, 2);

      for (let i = 0; i < projectedNodes.length; i++) {
        const p1 = projectedNodes[i];
        // Connect each node to nearby nodes in 3D projection
        for (let j = i + 1; j < projectedNodes.length; j++) {
          const p2 = projectedNodes[j];
          const dx = p1.px - p2.px;
          const dy = p1.py - p2.py;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxConnectDistSq) {
            const dist = Math.sqrt(distSq);
            const lineAlpha = (1 - dist / (sphereRadius * 0.65 * dpr)) * 0.28;
            // Closer to front => brighter cyan, further back => deep indigo
            const avgZ = (p1.z + p2.z) / 2;
            const normZ = (avgZ + sphereRadius) / (2 * sphereRadius); // 0 to 1
            const clampedNormZ = Math.max(0, Math.min(1, normZ));

            ctx.strokeStyle = `rgba(${Math.round(6 + 93 * (1 - clampedNormZ))}, ${Math.round(182 - 80 * (1 - clampedNormZ))}, 241, ${lineAlpha * (0.3 + 0.7 * clampedNormZ)})`;
            ctx.beginPath();
            ctx.moveTo(p1.px, p1.py);
            ctx.lineTo(p2.px, p2.py);
            ctx.stroke();
          }
        }
      }

      // 4. Draw Gyroscopic Holographic Rings
      const ringRadius1 = sphereRadius * 1.28;
      const ringRadius2 = sphereRadius * 1.42;

      function draw3DEllipseRing(radius, tiltAngle, yawAngle, colorHex, photonProgress) {
        const ringSegments = 48;
        const points = [];
        for (let s = 0; s <= ringSegments; s++) {
          const angle = (s / ringSegments) * Math.PI * 2;
          // Unrotated flat ring in X-Z plane
          const rx = radius * Math.cos(angle);
          const rz = radius * Math.sin(angle);
          const ry = 0;

          // Apply fixed ring inclination tilt, then active scene rotation
          const tiltedY = ry * Math.cos(tiltAngle) - rz * Math.sin(tiltAngle);
          const tiltedZ = ry * Math.sin(tiltAngle) + rz * Math.cos(tiltAngle);

          const finalRot = rotate3D(rx, tiltedY, tiltedZ, activePitch, activeYaw + yawAngle);
          const depth = focalLength / (focalLength + finalRot.z);
          points.push({
            px: centerX + finalRot.x * depth * dpr,
            py: centerY + finalRot.y * depth * dpr,
            z: finalRot.z,
          });
        }

        // Draw ring segments
        for (let s = 0; s < points.length - 1; s++) {
          const pt1 = points[s];
          const pt2 = points[s + 1];
          const avgZ = (pt1.z + pt2.z) / 2;
          const frontAlpha = Math.max(0.12, (avgZ + radius) / (2 * radius) * 0.6);

          ctx.strokeStyle = `rgba(${colorHex}, ${frontAlpha})`;
          ctx.lineWidth = (avgZ > 0 ? 1.6 : 0.8) * dpr;
          ctx.beginPath();
          ctx.moveTo(pt1.px, pt1.py);
          ctx.lineTo(pt2.px, pt2.py);
          ctx.stroke();
        }

        // Draw traveling photon along this ring
        const pAngle = photonProgress * Math.PI * 2;
        const px = radius * Math.cos(pAngle);
        const pz = radius * Math.sin(pAngle);
        const tiltedPY = -pz * Math.sin(tiltAngle);
        const tiltedPZ = pz * Math.cos(tiltAngle);
        const pRot = rotate3D(px, tiltedPY, tiltedPZ, activePitch, activeYaw + yawAngle);
        const pDepth = focalLength / (focalLength + pRot.z);
        const photonScreenX = centerX + pRot.x * pDepth * dpr;
        const photonScreenY = centerY + pRot.y * pDepth * dpr;

        // Photon glow
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 10 * dpr;
        ctx.beginPath();
        ctx.arc(photonScreenX, photonScreenY, (pRot.z > 0 ? 3.5 : 2) * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }

      // Ring 1: Electric Cyan Ring
      draw3DEllipseRing(ringRadius1, 0.45, ringAngle1, '6, 182, 212', (now * 0.0003) % 1);
      // Ring 2: Electric Indigo Ring
      draw3DEllipseRing(ringRadius2, -0.65, ringAngle2, '129, 140, 248', (now * 0.00022 + 0.5) % 1);

      // 5. Render Projected 3D Nodes
      for (let i = 0; i < projectedNodes.length; i++) {
        const p = projectedNodes[i];
        const normZ = (p.z + sphereRadius) / (2 * sphereRadius); // 0 (back) to 1 (front)
        const isFront = p.z > 0;
        const radius = (isFront ? 2.5 + normZ * 2 : 1.5) * dpr;
        const alpha = isFront ? 0.65 + normZ * 0.35 : 0.2 + normZ * 0.3;

        // Node Glow
        if (isFront && normZ > 0.6) {
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 8 * dpr;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = isFront
          ? `rgba(34, 211, 238, ${alpha})`
          : `rgba(99, 102, 241, ${alpha})`;

        ctx.beginPath();
        ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 6. Draw Ambient Floating Stardust Particles
      for (let i = 0; i < particles.length; i++) {
        const pt = particles[i];
        if (!reducedMotion) {
          pt.angle += pt.speed;
        }
        const curX = pt.orbitRadius * Math.cos(pt.angle);
        const curZ = pt.orbitRadius * Math.sin(pt.angle);
        const pRot = rotate3D(curX, pt.y, curZ, activePitch * 0.5, activeYaw * 0.5);
        const depth = focalLength / (focalLength + pRot.z);
        const sx = centerX + pRot.x * depth * dpr;
        const sy = centerY + pRot.y * depth * dpr;

        ctx.fillStyle = `rgba(165, 243, 252, ${pt.alpha * (pRot.z > 0 ? 0.9 : 0.3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, pt.size * dpr * (depth * 0.9), 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reducedMotion) {
        animFrameId.current = requestAnimationFrame(renderLoop);
      }
    }

    // Start loop
    animFrameId.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
      if (observer) {
        observer.disconnect();
      }
    };
  }, [size, reducedMotion]);

  // Handle interactive mouse tilt
  const handleMouseMove = (e) => {
    if (!interactive || reducedMotion) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseRef.current.targetX = x;
    mouseRef.current.targetY = y;
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    mouseRef.current.targetX = 0;
    mouseRef.current.targetY = 0;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`ai-orb-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: `${size}px`,
        aspectRatio: '1 / 1',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        ...style,
      }}
      aria-label="3D AI Holographic Neural Engine Orb"
      role="img"
    >
      {/* Background Soft Glow Aura */}
      <div
        style={{
          position: 'absolute',
          inset: '12%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.25) 0%, rgba(37, 99, 235, 0.12) 45%, transparent 70%)',
          filter: 'blur(32px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Main 3D Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          position: 'relative',
          zIndex: 1,
          maxWidth: '100%',
          height: 'auto',
          filter: 'drop-shadow(0 0 25px rgba(34, 211, 238, 0.35))',
        }}
      />

      {/* Holographic Center Lens Ring Badge - Frosted White with Cyan Accent */}
      {showBadge && (
        <div
          className="holographic-center-badge"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 2,
            pointerEvents: 'none',
            padding: '0.35rem 0.75rem',
            borderRadius: '9999px',
            background: 'rgba(255, 255, 255, 0.94)',
            border: '1px solid #BFDBFE',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 10px rgba(37, 99, 235, 0.12), 0 0 14px rgba(34, 211, 238, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#22d3ee',
              boxShadow: '0 0 8px #22d3ee',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#0F172A',
            }}
          >
            Neural Core Active
          </span>
        </div>
      )}
    </div>
  );
}
