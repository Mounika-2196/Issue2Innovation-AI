import { useEffect, useRef } from "react";

export default function ParticleCanvas({ active }) {
  const ref = useRef(null);
  const raf = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let particles = [];
    const PARTICLE_COUNT = Math.max(28, Math.floor((width * height) / 90000));

    function reset() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.4,
          r: 0.6 + Math.random() * 1.8,
          alpha: 0.08 + Math.random() * 0.24,
        });
      }
    }

    const onResize = () => reset();
    window.addEventListener('resize', onResize);
    reset();

    function draw() {
      if (!active) return;
      ctx.clearRect(0, 0, width, height);
      // subtle backdrop gradient
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, 'rgba(4,10,18,0.05)');
      g.addColorStop(1, 'rgba(6,14,25,0.06)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'lighter';

      for (let p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        ctx.beginPath();
        ctx.fillStyle = `rgba(80,210,185,${p.alpha})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // draw faint streaks between nearby particles
      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            const alpha = Math.max(0, 0.12 - dist / 900);
            ctx.strokeStyle = `rgba(80,210,185,${alpha})`;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      raf.current = requestAnimationFrame(draw);
    }

    if (active) raf.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', onResize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [active]);

  return (
    <canvas
      ref={ref}
      className="particle-canvas"
      style={{ position: 'fixed', inset: 0, zIndex: 10, pointerEvents: 'none' }}
    />
  );
}
