/* ============================================================
   QuarkX Tamagotchi — Quantum Pets with Pet House
   Click pets → they sing and emit hearts (original behavior).
   House = toggle: click → all go home, click again → all come out.
   State persisted in localStorage.
   ============================================================ */

(function () {
  "use strict";

  const STORAGE_KEY = "quarkx-pets-home";

  const PETS = [
    {
      name: "Qubit",
      color: "#7a2f2d",
      personality: "curious",
      speed: 0.8,
      size: 20,
    },
    {
      name: "Photon",
      color: "#b26c3d",
      personality: "bouncy",
      speed: 1.3,
      size: 17,
    },
    {
      name: "Fermion",
      color: "#866d60",
      personality: "sleepy",
      speed: 0.4,
      size: 16,
    },
  ];

  const PET_SPRITES = {
    idle: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 0, 1, 0, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 0, 1, 1, 0, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 0, 0, 0, 0, 1, 0],
    ],
    walk1: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 0, 1, 0, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 0, 1, 1, 0, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
    ],
    walk2: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 0, 1, 0, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 0, 1, 1, 0, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 0, 0, 0, 0, 1, 0],
    ],
    happy: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 0, 1, 0, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 1, 0, 0, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 0, 1, 1, 0, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
    ],
    sleep: [
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 0, 0, 1, 1, 0],
      [0, 0, 1, 1, 1, 1, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
    ],
  };

  const HOUSE_SPRITE = [
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1],
    [1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1],
    [1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1],
    [1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ];

  function renderSprite(grid, color, px) {
    const c = document.createElement("canvas");
    c.width = grid[0].length * px;
    c.height = grid.length * px;
    const ctx = c.getContext("2d");
    for (let r = 0; r < grid.length; r++)
      for (let col = 0; col < grid[r].length; col++)
        if (grid[r][col]) {
          ctx.fillStyle = color;
          ctx.fillRect(col * px, r * px, px, px);
        }
    return c.toDataURL();
  }

  // ========== Pet House (toggle) ==========
  class PetHouse {
    constructor(onToggle) {
      this.onToggle = onToggle;
      this.allHome = false;

      this.el = document.createElement("div");
      this.el.className = "tama-house";
      this.el.setAttribute("role", "button");
      this.el.setAttribute("tabindex", "0");
      this.el.setAttribute("aria-label", "Pet house — click to toggle pets");
      this.el.style.cssText = `
        position: fixed; bottom: 6px; left: 28px; z-index: 58;
        cursor: pointer; image-rendering: pixelated;
        transition: transform 0.15s ease, filter 0.15s ease;
      `;

      const img = document.createElement("img");
      img.src = renderSprite(HOUSE_SPRITE, "#7a6a60", 2);
      img.alt = "";
      img.style.cssText =
        "width:24px;height:24px;image-rendering:pixelated;pointer-events:none;";
      this.el.appendChild(img);

      // Badge
      this.badge = document.createElement("span");
      this.badge.style.cssText = `
        position: absolute; top: -4px; right: -4px;
        min-width: 16px; height: 16px;
        display: flex; align-items: center; justify-content: center;
        padding: 0 4px; border-radius: 999px;
        background: var(--accent, #7a2f2d); color: var(--text-inverse, #f8f2eb);
        font-size: 9px; font-weight: 700; font-family: ui-monospace, monospace;
        opacity: 0; transition: opacity 0.2s; pointer-events: none;
      `;
      this.el.appendChild(this.badge);

      // Tooltip
      this.tooltip = document.createElement("span");
      this.tooltip.style.cssText = `
        position: absolute; bottom: calc(100% + 6px); left: -10px;
        font-size: 9px;
        font-family: ui-monospace, monospace; color: #7a6a60;
        white-space: nowrap; opacity: 0; transition: opacity 0.2s;
        pointer-events: none; padding: 3px 7px;
        background: rgba(244, 236, 227, 0.92); border-radius: 999px;
        border: 1px solid rgba(31, 24, 20, 0.08);
        box-shadow: 0 8px 18px rgba(83, 54, 37, 0.08);
      `;
      this.el.appendChild(this.tooltip);

      this.el.addEventListener("mouseenter", () => {
        this.tooltip.textContent = this.allHome
          ? "knock knock! 🚪"
          : "send pets home";
        this.tooltip.style.opacity = "1";
      });
      this.el.addEventListener("mouseleave", () => {
        this.tooltip.style.opacity = "0";
      });
      this.el.addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggle();
      });
      this.el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this._toggle();
        }
      });

      document.body.appendChild(this.el);
    }

    _toggle() {
      // Shake
      this.el.style.transform = "rotate(-8deg)";
      setTimeout(() => {
        this.el.style.transform = "rotate(8deg)";
      }, 80);
      setTimeout(() => {
        this.el.style.transform = "rotate(-4deg)";
      }, 160);
      setTimeout(() => {
        this.el.style.transform = "rotate(0)";
      }, 240);

      this.allHome = !this.allHome;
      this.onToggle(this.allHome);
    }

    updateBadge(n) {
      this.badge.textContent = n;
      this.badge.style.opacity = n > 0 ? "1" : "0";
    }

    destroy() {
      this.el.remove();
    }
  }

  // ========== Pet ==========
  class TamagotchiPet {
    constructor(config, index, houseX) {
      this.name = config.name;
      this.color = config.color;
      this.personality = config.personality;
      this.baseSpeed = config.speed;
      this.size = config.size;
      this.pixelSize = Math.ceil(config.size / 8);
      this.houseX = houseX;
      this.isHome = false;
      this.goingHome = false;

      this.sprites = {};
      for (const [key, grid] of Object.entries(PET_SPRITES))
        this.sprites[key] = renderSprite(grid, config.color, this.pixelSize);

      this.x = 60 + Math.random() * (window.innerWidth - 160);
      this.y = window.innerHeight - this.size - 8;
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = 0;
      this.grounded = true;
      this.facingRight = this.vx > 0;

      this.state = "idle";
      this.frame = 0;
      this.stateTimer = 0;
      this.happiness = 50;
      this.energy = 100;
      this.petCount = 0;

      // DOM — role="button" for keyboard accessibility
      this.el = document.createElement("div");
      this.el.className = "tama-pet";
      this.el.setAttribute("role", "button");
      this.el.setAttribute("tabindex", "0");
      this.el.setAttribute(
        "aria-label",
        this.name + " — click or press Enter to pet",
      );
      this.el.style.cssText = `
        position: fixed; z-index: 59; cursor: pointer;
        transition: filter 0.12s ease, opacity 0.3s ease;
        image-rendering: pixelated; pointer-events: auto;
        will-change: transform;
      `;

      this.imgEl = document.createElement("img");
      this.imgEl.src = this.sprites.idle;
      this.imgEl.alt = "";
      this.imgEl.style.cssText = `width:${this.size}px;height:${this.size}px;image-rendering:pixelated;pointer-events:none;`;
      this.el.appendChild(this.imgEl);

      // Name tag
      this.nameTag = document.createElement("span");
      this.nameTag.textContent = this.name;
      this.nameTag.style.cssText = `
        position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
        font-size: 9px; font-family: ui-monospace, monospace; color: ${this.color};
        white-space: nowrap; opacity: 0; transition: opacity 0.2s; pointer-events: none;
        padding: 3px 7px; background: rgba(244, 236, 227, 0.92); border-radius: 999px;
        border: 1px solid rgba(31, 24, 20, 0.08); box-shadow: 0 8px 18px rgba(83, 54, 37, 0.08);
      `;
      this.el.appendChild(this.nameTag);

      // Speech bubble
      this.tooltipEl = document.createElement("div");
      this.tooltipEl.style.cssText = `
        position: absolute; bottom: calc(100% + 16px); left: 50%; transform: translateX(-50%);
        font-size: 10px; font-family: ui-monospace, monospace; color: ${this.color};
        white-space: nowrap; opacity: 0; transition: opacity 0.3s; pointer-events: none;
        padding: 5px 9px; background: rgba(244, 236, 227, 0.96); border-radius: 10px;
        border: 1px solid rgba(31, 24, 20, 0.1); box-shadow: 0 10px 26px rgba(83, 54, 37, 0.1);
      `;
      this.el.appendChild(this.tooltipEl);

      // Particle container
      this.particleContainer = document.createElement("div");
      this.particleContainer.style.cssText =
        "position:absolute;inset:0;pointer-events:none;overflow:visible;";
      this.el.appendChild(this.particleContainer);

      // Events — click to PET (hearts + singing), NOT to send home
      this.el.addEventListener("mouseenter", () => {
        if (!this.isHome) this.nameTag.style.opacity = "1";
      });
      this.el.addEventListener("mouseleave", () => {
        this.nameTag.style.opacity = "0";
      });
      this.el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!this.isHome && !this.goingHome) this.onPet();
      });

      document.body.appendChild(this.el);
    }

    onPet() {
      this.petCount++;
      this.happiness = Math.min(100, this.happiness + 15);
      this.state = "happy";
      this.stateTimer = 120;

      // Emit hearts
      for (let i = 0; i < 3; i++)
        setTimeout(() => this.emitParticle("❤️"), i * 150);

      // Show speech
      const phrases = [
        this.name + " is happy!",
        "♪ ♫ ♪",
        "purrr~",
        "(◕ᴗ◕✿)",
        this.name + " loves you!",
      ];
      this.showSpeech(phrases[this.petCount % phrases.length]);

      // Little jump
      this.vy = -4;
      this.grounded = false;
    }

    sendHome() {
      if (this.isHome || this.goingHome) return;
      this.goingHome = true;
      this.showSpeech("bye bye~");
      this.nameTag.style.opacity = "0";
    }

    comeOut() {
      if (!this.isHome) return;
      this.isHome = false;
      this.el.style.opacity = "1";
      this.el.style.pointerEvents = "auto";
      this.x = this.houseX + 18;
      this.y = window.innerHeight - this.size - 8;
      this.vx = 1.5 + Math.random() * 2;
      this.facingRight = true;
      this.state = "happy";
      this.stateTimer = 120;
      this.showSpeech("hello!");
    }

    showSpeech(text) {
      this.tooltipEl.textContent = text;
      this.tooltipEl.style.opacity = "1";
      clearTimeout(this._st);
      this._st = setTimeout(() => {
        this.tooltipEl.style.opacity = "0";
      }, 2000);
    }

    emitParticle(char) {
      const p = document.createElement("span");
      p.textContent = char;
      p.style.cssText = `
        position:absolute;left:50%;bottom:100%;font-size:12px;
        pointer-events:none;animation:tama-float 1s ease-out forwards;z-index:61;
      `;
      this.particleContainer.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }

    update(mouseX) {
      if (this.isHome) return;
      this.frame++;
      this.stateTimer = Math.max(0, this.stateTimer - 1);

      // Going home animation
      if (this.goingHome) {
        const dx = this.houseX + 12 - this.x;
        if (Math.abs(dx) < 4) {
          this.isHome = true;
          this.goingHome = false;
          this.el.style.opacity = "0";
          this.el.style.pointerEvents = "none";
          return;
        }
        this.vx = dx > 0 ? 2 : -2;
        this.facingRight = dx > 0;
        this.x += this.vx;
        this.state = "walk";
        this._render();
        return;
      }

      // Gravity
      if (!this.grounded) {
        this.vy += 0.25;
        this.y += this.vy;
        const ground = window.innerHeight - this.size - 8;
        if (this.y >= ground) {
          this.y = ground;
          this.vy = 0;
          this.grounded = true;
        }
      }

      // Decay
      if (this.frame % 300 === 0) {
        this.happiness = Math.max(0, this.happiness - 1);
        this.energy = Math.max(0, this.energy - 0.5);
      }

      // State machine
      if (this.stateTimer <= 0) {
        if (this.energy < 20) {
          this.state = "sleep";
          this.stateTimer = 600;
        } else if (this.happiness > 70) {
          this.state = "happy";
          this.stateTimer = 180;
        } else if (Math.random() < 0.4) {
          this.state = "idle";
          this.stateTimer = 120 + Math.random() * 180;
        } else {
          this.state = "walk";
          this.stateTimer = 200 + Math.random() * 300;
          this.vx = (Math.random() - 0.5) * this.baseSpeed * 2;
        }
      }

      // Personality
      if (this.personality === "curious" && this.state === "walk") {
        const dx = mouseX - this.x;
        if (Math.abs(dx) > 100) this.vx += dx > 0 ? 0.02 : -0.02;
      }
      if (
        this.personality === "bouncy" &&
        this.state !== "sleep" &&
        this.grounded &&
        Math.random() < 0.005
      ) {
        this.vy = -3 - Math.random() * 2;
        this.grounded = false;
      }
      if (
        this.personality === "sleepy" &&
        this.state === "sleep" &&
        this.frame % 90 === 0
      )
        this.emitParticle("💤");

      // Movement
      if (this.state === "walk" || this.state === "happy") {
        this.x += this.vx;
        this.facingRight = this.vx > 0;
      }

      // Boundaries
      const maxX = window.innerWidth - this.size;
      if (this.x < 60) {
        this.x = 60;
        this.vx = Math.abs(this.vx);
      }
      if (this.x > maxX) {
        this.x = maxX;
        this.vx = -Math.abs(this.vx);
      }

      this._render();
    }

    _render() {
      let s;
      switch (this.state) {
        case "walk":
          s = this.frame % 30 < 15 ? this.sprites.walk1 : this.sprites.walk2;
          break;
        case "happy":
          s = this.sprites.happy;
          break;
        case "sleep":
          s = this.sprites.sleep;
          break;
        default:
          s = this.sprites.idle;
      }
      this.imgEl.src = s;
      this.el.style.left = this.x + "px";
      this.el.style.top = this.y + "px";
      this.el.style.transform = this.facingRight ? "scaleX(1)" : "scaleX(-1)";
    }

    destroy() {
      this.el.remove();
    }
  }

  // ========== Main ==========
  document.addEventListener("DOMContentLoaded", () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 600) return;

    const style = document.createElement("style");
    style.textContent = `
      @keyframes tama-float {
        0% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -30px) scale(0.5); }
      }
      .tama-pet:hover { filter: brightness(1.06) drop-shadow(0 8px 18px rgba(122, 47, 45, 0.12)); }
      .tama-house:hover { transform: scale(1.08); filter: drop-shadow(0 6px 14px rgba(83, 54, 37, 0.12)); }
    `;
    document.head.appendChild(style);

    const houseX = 36;
    let mouseX = window.innerWidth / 2;
    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
    });

    const pets = PETS.map((cfg, i) => new TamagotchiPet(cfg, i, houseX));

    const house = new PetHouse((sendHome) => {
      if (sendHome) {
        pets.forEach((p) => p.sendHome());
      } else {
        pets.forEach((p) => {
          if (p.isHome) p.comeOut();
        });
      }
      saveState(sendHome);
      updateBadge();
    });

    function updateBadge() {
      house.updateBadge(pets.filter((p) => p.isHome).length);
    }

    function saveState(allHome) {
      try {
        localStorage.setItem(STORAGE_KEY, allHome ? "home" : "out");
      } catch (e) {}
    }

    // Restore state
    try {
      if (localStorage.getItem(STORAGE_KEY) === "home") {
        house.allHome = true;
        pets.forEach((p) => {
          p.isHome = true;
          p.el.style.opacity = "0";
          p.el.style.pointerEvents = "none";
        });
        updateBadge();
      }
    } catch (e) {}

    function loop() {
      let changed = false;
      pets.forEach((p) => {
        const was = p.goingHome;
        p.update(mouseX);
        if (was && p.isHome) changed = true;
      });
      if (changed) updateBadge();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
})();
