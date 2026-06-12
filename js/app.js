/* ============================================================
   QuarkX — app orchestrator
   Lenis smooth scroll + GSAP ScrollTrigger + WebGL experience
   ============================================================ */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { createExperience } from "./experience.js";

document.documentElement.classList.add("js");
document.documentElement.classList.remove("preload");

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduced) document.documentElement.classList.add("reduced-motion");

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.105, wheelMultiplier: 1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToTarget(target, offset = 0) {
  if (lenis) {
    lenis.scrollTo(target, { offset, duration: 1.4 });
  } else {
    const y =
      typeof target === "number"
        ? target
        : target.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
  }
}

// anchor links
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id.length <= 1) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(el, id === "#expertise" ? 1 : -70);
  });
});

/* ---------- WebGL ---------- */
const canvas = document.getElementById("gl");
let xp = null;
try {
  xp = createExperience(canvas);
} catch (err) {
  console.warn("WebGL unavailable:", err);
}
if (!xp) {
  document.getElementById("gl-stage").style.display = "none";
} else {
  xp.setReduced(reduced);
  gsap.ticker.add((time) => xp.update(time));
}

/* ---------- loader ---------- */
const loader = document.getElementById("loader");
const loaderFill = document.getElementById("loader-fill");
let bootDone = false;

function finishBoot() {
  if (bootDone) return;
  bootDone = true;
  loaderFill.style.width = "100%";
  setTimeout(() => {
    loader.classList.add("is-done");
    introTimeline();
  }, 380);
}

(function fakeProgress() {
  let p = 0;
  const tick = () => {
    if (bootDone) return;
    p = Math.min(p + Math.random() * 18, 92);
    loaderFill.style.width = p + "%";
    if (p < 92) setTimeout(tick, 140);
  };
  tick();
})();

Promise.all([
  document.fonts ? document.fonts.ready : Promise.resolve(),
  new Promise((r) => setTimeout(r, 900)),
]).then(finishBoot);
setTimeout(finishBoot, 4000); // hard cap

/* ---------- hero intro ---------- */
function introTimeline() {
  if (reduced) return;
  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
  tl.to(".hl-line > span", { y: 0, duration: 1.3, stagger: 0.12 }, 0.1)
    .to(
      ".hero [data-reveal], .hero-foot [data-reveal]",
      { opacity: 1, y: 0, duration: 1.1, stagger: 0.08 },
      0.55
    );
}

/* ---------- header ---------- */
const header = document.getElementById("site-header");
let lastY = 0;
function onScrollHeader() {
  const y = window.scrollY;
  header.classList.toggle("is-scrolled", y > 30);
  if (y > 500 && y > lastY + 6) header.classList.add("is-hidden");
  else if (y < lastY - 4) header.classList.remove("is-hidden");
  lastY = y;
}
window.addEventListener("scroll", onScrollHeader, { passive: true });

/* ---------- mobile menu ---------- */
const menuToggle = document.getElementById("menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");

function closeMenu() {
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open menu");
  mobileMenu.classList.remove("is-open");
  mobileMenu.setAttribute("aria-hidden", "true");
  document.documentElement.classList.remove("menu-open");
  document.body.classList.remove("menu-open");
  mobileMenu.querySelectorAll(".mobile-link").forEach((l) => (l.tabIndex = -1));
}

menuToggle.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") === "true";
  if (open) {
    closeMenu();
  } else {
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close menu");
    mobileMenu.classList.add("is-open");
    mobileMenu.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("menu-open");
    document.body.classList.add("menu-open");
    mobileMenu.querySelectorAll(".mobile-link").forEach((l) => (l.tabIndex = 0));
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

/* ---------- journey scrub ---------- */
const steps = Array.from(document.querySelectorAll(".journey-step"));
const stepHeads = Array.from(document.querySelectorAll(".step-head"));
const journeyEl = document.querySelector(".journey");
let activeStep = -1;

function setActiveStep(idx) {
  if (idx === activeStep) return;
  activeStep = idx;
  steps.forEach((s, i) => {
    s.classList.toggle("is-active", i === idx);
    s.querySelector(".step-head").setAttribute(
      "aria-expanded",
      i === idx ? "true" : "false"
    );
  });
}

// step boundaries matched to where the camera actually enters each zone
const STEP_BOUNDS = [0.36, 0.56, 0.84];
function stepForProgress(p) {
  if (p < STEP_BOUNDS[0]) return 0;
  if (p < STEP_BOUNDS[1]) return 1;
  if (p < STEP_BOUNDS[2]) return 2;
  return 3;
}

const journeyStage = document.getElementById("journey-stage");

ScrollTrigger.create({
  trigger: journeyEl,
  start: "top top",
  end: "bottom bottom",
  scrub: true,
  onUpdate(self) {
    const p = self.progress;
    if (xp) xp.setProgress(p);
    setActiveStep(stepForProgress(p));
    // fade the stage UI out before the statement scrolls in,
    // so the two sections never overlap
    const fade = p > 0.92 ? Math.max(0, 1 - (p - 0.92) / 0.06) : 1;
    journeyStage.style.opacity = fade;
    journeyStage.style.pointerEvents = fade < 0.4 ? "none" : "";
  },
});

// gentle approach before the journey pins (camera already at path start)
ScrollTrigger.create({
  trigger: journeyEl,
  start: "top bottom",
  end: "top top",
  onLeaveBack() {
    if (xp) xp.setProgress(0);
  },
});

// pause rendering when the GL stage is fully covered by opaque sections
const paperEl = document.querySelector(".paper");
ScrollTrigger.create({
  trigger: paperEl,
  start: "top top",
  end: "max",
  onToggle(self) {
    if (xp) xp.setPaused(self.isActive);
  },
});

// clicking a step scrolls to the middle of its segment
stepHeads.forEach((head, i) => {
  head.addEventListener("click", () => {
    const rect = journeyEl.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const span = journeyEl.offsetHeight - window.innerHeight;
    const lo = i === 0 ? 0 : STEP_BOUNDS[i - 1];
    const hi = i === 3 ? 1 : STEP_BOUNDS[i];
    scrollToTarget(top + span * ((lo + hi) / 2));
  });
});

/* ---------- split text ---------- */
document.querySelectorAll("[data-split]").forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words
    .map(
      (w) =>
        `<span class="split-word"><span>${w}</span></span>`
    )
    .join(" ");
});

if (!reduced) {
  document.querySelectorAll("[data-split]").forEach((el) => {
    gsap.to(el.querySelectorAll(".split-word > span"), {
      y: 0,
      duration: 1.05,
      ease: "power4.out",
      stagger: 0.028,
      scrollTrigger: {
        trigger: el,
        start: "top 82%",
        once: true,
      },
    });
  });

  // statement: words brighten one by one as you scroll (scrubbed)
  const statementWords = document.querySelectorAll(
    ".statement-text .split-word > span"
  );
  if (statementWords.length) {
    gsap.fromTo(
      statementWords,
      { color: "#cdbda7" },
      {
        color: "#221a13",
        stagger: 0.5,
        ease: "none",
        scrollTrigger: {
          trigger: ".statement-text",
          start: "top 78%",
          end: "bottom 45%",
          scrub: true,
        },
      }
    );
  }

  /* ---------- generic reveals (outside hero) ---------- */
  const revealEls = Array.from(
    document.querySelectorAll("[data-reveal]")
  ).filter((el) => !el.closest(".hero"));
  ScrollTrigger.batch(revealEls, {
    start: "top 88%",
    once: true,
    onEnter(batch) {
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power3.out",
        stagger: 0.09,
      });
    },
  });
} else {
  gsap.set("[data-reveal]", { opacity: 1, y: 0 });
}

/* ---------- FAQ ---------- */
document.querySelectorAll(".faq-item").forEach((item) => {
  const summary = item.querySelector(".faq-question");
  const answer = item.querySelector(".faq-answer");
  summary.addEventListener("click", (e) => {
    if (reduced) return; // native toggle
    e.preventDefault();
    if (item.open) {
      gsap.to(answer, {
        height: 0,
        opacity: 0,
        duration: 0.45,
        ease: "power3.inOut",
        onComplete() {
          item.open = false;
          answer.style.height = "";
          answer.style.opacity = "";
        },
      });
    } else {
      item.open = true;
      gsap.fromTo(
        answer,
        { height: 0, opacity: 0 },
        {
          height: "auto",
          opacity: 1,
          duration: 0.55,
          ease: "power3.out",
          onComplete() {
            answer.style.height = "";
          },
        }
      );
    }
  });
});

/* ---------- magnetic buttons ---------- */
if (!reduced && window.matchMedia("(pointer: fine)").matches) {
  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    const strength = 0.32;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      gsap.to(el, {
        x: x * strength,
        y: y * strength,
        duration: 0.4,
        ease: "power2.out",
      });
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.45)" });
    });
  });
}

ScrollTrigger.refresh();
