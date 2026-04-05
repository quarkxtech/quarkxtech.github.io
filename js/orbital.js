/* ============================================================
   QuarkX — Quantum Orbital Canvas
   Interactive SPDF orbital particle simulation for the hero.
   Click or press Enter/Space to cycle: s → p → d → f → superposition.
   ============================================================ */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.getElementById('quantum-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity 2s cubic-bezier(0.22, 1, 0.36, 1)';

    function getCSSColor(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    let width, height, centerX, centerY;
    const particles = [];
    const mouse = { x: 0, y: 0 };
    const targetRot = { x: 0, y: 0 };
    const currentRot = { x: 0, y: 0 };

    let energyState = 0;
    const stateNames = ['s-orbital', 'p-orbital', 'd-orbital', 'f-orbital', 'superposition'];
    const stateCount = stateNames.length;

    let accentRGB = { r: 122, g: 47, b: 45 };
    let goldRGB = { r: 178, g: 108, b: 61 };
    let bgColor = 'rgba(244, 236, 227, 0.12)';

    function hexToRGB(hex) {
      hex = hex.replace('#', '');
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    }

    function updateColors() {
      const accent = getCSSColor('--accent') || '#7a2f2d';
      const gold = getCSSColor('--copper') || '#b26c3d';
      const bg = getCSSColor('--bg') || '#f4ece3';
      accentRGB = hexToRGB(accent);
      goldRGB = hexToRGB(gold);
      const bgRgb = hexToRGB(bg);
      bgColor = `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, 0.12)`;
    }
    updateColors();

    function resize() {
      const hero = document.getElementById('hero');
      if (!hero) return;
      width = hero.offsetWidth;
      height = hero.offsetHeight;
      canvas.width = width;
      canvas.height = height;
      centerX = width > 900 ? width * 0.66 : width * 0.5;
      centerY = height * 0.5;
    }
    window.addEventListener('resize', resize);
    resize();

    document.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      targetRot.y = (mouse.x - width / 2) * 0.0004;
      targetRot.x = (mouse.y - height / 2) * 0.0004;
    });

    // Hero background click cycles orbital state (canvas is pointer-events:none)
    const heroSection = document.getElementById('hero');
    if (heroSection) {
      heroSection.addEventListener('click', (e) => {
        // Only cycle if click was on the hero background, not on buttons/links
        if (e.target.closest('a, button')) return;
        toggleState();
      });
    }

    function toggleState() {
      energyState = (energyState + 1) % stateCount;
      particles.forEach((p) => { p.speed *= 3 + Math.random() * 2; });
    }

    class OrbitalParticle {
      constructor() {
        this.baseSpeed = 0.001 + Math.random() * 0.004;
        this.speed = this.baseSpeed;
        this.radius = Math.random() * 1.8 + 0.3;
        this.bright = Math.random() < 0.08;
        this.type = Math.random();
        this.theta = Math.random() * Math.PI * 2;
        this.phi = Math.acos(2 * Math.random() - 1);
        this.dist = 0;
        this.screenX = 0;
        this.screenY = 0;
        this.scale = 1;
        this.phiOffset = Math.random() * Math.PI * 2;
      }

      update() {
        this.speed += (this.baseSpeed - this.speed) * 0.04;
        this.theta += this.speed;

        const s = Math.min(width, height) / 900;
        const R = 390 * s;

        if (energyState === 0) {
          // ── s-orbital: sphere ──
          // Uniform spherical cloud — 1s probability shell
          // Particles distributed at varying radii with Gaussian-like falloff
          const shell = 0.3 + 0.7 * Math.pow(Math.abs(Math.sin(this.phiOffset * 3 + this.theta * 0.3)), 0.6);
          this.dist = R * 0.55 * shell;

        } else if (energyState === 1) {
          // ── p-orbital: dumbbell ──
          // Two lobes along the polar axis, node at the equator
          // p_z: ψ ∝ cos(θ), probability ∝ cos²(θ)
          const lobe = Math.abs(Math.cos(this.phi));
          this.dist = R * 0.85 * lobe;

        } else if (energyState === 2) {
          // ── d-orbital: clover / toroid ──
          if (this.type < 0.35) {
            // d_z² dumbbell lobes
            this.dist = R * 0.9 * Math.abs(Math.cos(this.theta * 2));
            this.phi = this.phiOffset * 0.1;
          } else if (this.type < 0.6) {
            // d_z² toroidal ring
            this.dist = R * 0.55 + Math.sin(this.theta * 6) * R * 0.04;
            this.phi = Math.PI / 2 + Math.sin(this.theta * 3) * 0.08;
          } else {
            // d_xy clover
            this.dist = R * Math.abs(Math.sin(this.theta * 2));
            this.phi = Math.PI / 2;
          }

        } else if (energyState === 3) {
          // ── f-orbital: complex multilobed ──
          this.dist = R * 1.1 * Math.abs(
            Math.sin(this.theta * 3) * Math.cos(this.phi * 2 + this.phiOffset)
          );

        } else {
          // ── superposition: chaotic interference ──
          const a = Math.sin(this.theta * 2) * Math.cos(this.phiOffset + this.theta * 0.5);
          const b = Math.cos(this.theta * 3) * Math.sin(this.phi * 2);
          this.dist = R * (Math.abs(a) + Math.abs(b) * 0.5);
        }

        // 3D → 2D projection
        const x = this.dist * Math.sin(this.phi) * Math.cos(this.theta);
        const y = this.dist * Math.sin(this.phi) * Math.sin(this.theta);
        const z = this.dist * Math.cos(this.phi);

        currentRot.x += (targetRot.x - currentRot.x) * 0.03;
        currentRot.y += (targetRot.y - currentRot.y) * 0.03;

        const t = Date.now() * 0.0003;
        const rX = currentRot.x + Math.sin(t * 0.4) * 0.15;
        const rY = currentRot.y + t;

        const cx = Math.cos(rX);
        const sx = Math.sin(rX);
        const y2 = y * cx - z * sx;
        const z2 = y * sx + z * cx;

        const cy = Math.cos(rY);
        const sy = Math.sin(rY);
        const x2 = x * cy + z2 * sy;
        const z3 = -x * sy + z2 * cy;

        this.screenX = centerX + x2;
        this.screenY = centerY + y2;
        this.scale = (500 + z3) / 500;
      }

      draw() {
        if (this.scale < 0.05) return;

        const r = this.radius * this.scale;
        let rgb;

        if (energyState === 0) {
          // s: copper
          rgb = goldRGB;
        } else if (energyState === 1) {
          // p: accent (oxblood)
          rgb = accentRGB;
        } else if (energyState === 2) {
          // d: blend
          const blend = (Math.sin(this.theta * 2) + 1) / 2;
          rgb = {
            r: Math.round(accentRGB.r + (goldRGB.r - accentRGB.r) * blend),
            g: Math.round(accentRGB.g + (goldRGB.g - accentRGB.g) * blend),
            b: Math.round(accentRGB.b + (goldRGB.b - accentRGB.b) * blend),
          };
        } else if (energyState === 3) {
          // f: copper
          rgb = goldRGB;
        } else {
          // superposition: chaotic blend
          const blend = (Math.sin(this.theta * 4) + 1) / 2;
          rgb = {
            r: Math.round(accentRGB.r + (goldRGB.r - accentRGB.r) * blend),
            g: Math.round(accentRGB.g + (goldRGB.g - accentRGB.g) * blend),
            b: Math.round(accentRGB.b + (goldRGB.b - accentRGB.b) * blend),
          };
        }

        let alpha = this.scale * 0.42;
        if (this.bright) alpha = Math.min(1, alpha * 2);

        ctx.beginPath();
        ctx.arc(this.screenX, this.screenY, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
        ctx.fill();
      }
    }

    const count = Math.min(720, Math.floor(width * height / 2400));
    for (let i = 0; i < count; i++) particles.push(new OrbitalParticle());

    function render() {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      particles.sort((a, b) => a.scale - b.scale);
      particles.forEach((p) => { p.update(); p.draw(); });
      requestAnimationFrame(render);
    }
    render();

    requestAnimationFrame(() => { canvas.style.opacity = ''; });
  });
})();
