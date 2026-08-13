/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/*
 * Page orchestrator.
 *
 * Wires the document to the three systems that animate it: Lenis for smooth
 * scrolling, GSAP ScrollTrigger for scroll-linked timelines, and the WebGL
 * experience in js/experience.js.
 *
 * Responsibilities:
 *   - smooth scroll and anchor navigation
 *   - boot loader and hero intro
 *   - header, mobile menu and FAQ behaviour
 *   - the journey scrub that drives the diorama and the step list
 *   - text reveals, magnetic buttons and the copy-to-clipboard fallback
 *
 * Every animated path is gated on prefers-reduced-motion; in reduced mode the
 * page falls back to native scrolling with content shown in its final state.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { createExperience } from "./experience.js?v=3";

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
  // Lenis is driven off the GSAP ticker so scroll and tweens share one clock.
  // Lag smoothing is disabled because a skipped frame would jump the scrub.
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/**
 * Scrolls to an element or absolute offset, through Lenis when it is running.
 *
 * @param {Element|number} target Element to scroll to, or a document offset in px.
 * @param {number} [offset=0] Extra offset applied to the resolved position.
 * @returns {void}
 */
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

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id.length <= 1) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    // The journey pins at its own top, so it wants no header offset; every
    // other section needs clearance for the fixed header.
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

// The loader is a first impression, not a toll gate. A visitor arriving at an
// anchor (a nav tab from a sub-page) or one who has already seen the boot this
// session goes straight to the page.
const quickBoot =
  window.location.hash !== "" ||
  (() => {
    try {
      return sessionStorage.getItem("qx-visited") === "1";
    } catch (e) {
      return false;
    }
  })();
try {
  sessionStorage.setItem("qx-visited", "1");
} catch (e) {
  /* private mode: every visit boots like the first */
}

/**
 * Completes the loading bar, hides the loader and starts the hero intro.
 *
 * Safe to call more than once: the first call wins, so the timeout cap and the
 * font promise can race freely.
 *
 * @returns {void}
 */
function finishBoot() {
  if (bootDone) return;
  bootDone = true;
  loaderFill.style.width = "100%";
  // Let the bar visibly reach 100% before the loader fades out.
  setTimeout(
    () => {
      loader.classList.add("is-done");
      introTimeline();
    },
    quickBoot ? 0 : 200,
  );
}

// Indeterminate progress: there is nothing meaningful to measure, so the bar
// creeps to 92% and waits for the real signal to close it out.
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

if (quickBoot) {
  finishBoot();
} else {
  Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 450)),
  ]).then(finishBoot);
  setTimeout(finishBoot, 2000); // hard cap: never trap the visitor behind the loader
}

/**
 * Plays the hero headline and supporting copy in.
 *
 * @returns {void}
 */
function introTimeline() {
  if (reduced) return;
  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
  tl.to(".hl-line > span", { y: 0, duration: 1.3, stagger: 0.12 }, 0.1).to(
    ".hero [data-reveal], .hero-foot [data-reveal]",
    { opacity: 1, y: 0, duration: 1.1, stagger: 0.08 },
    0.55
  );
}

/* ---------- header ---------- */

const header = document.getElementById("site-header");
const darkStart = document.querySelector(".faq");
let lastY = 0;

// Hide on the way down, reveal on the way up. The thresholds are asymmetric so
// a small upward correction brings the header back but scroll jitter does not.
function onScrollHeader() {
  const y = window.scrollY;
  header.classList.toggle("is-scrolled", y > 30);
  if (y > 500 && y > lastY + 6) header.classList.add("is-hidden");
  else if (y < lastY - 4) header.classList.remove("is-hidden");
  // The dark finale (FAQ through footer) runs to the end of the document, so
  // the header material follows whichever ground its band is floating over.
  if (darkStart) {
    header.classList.toggle(
      "on-dark",
      darkStart.getBoundingClientRect().top <= header.offsetHeight,
    );
  }
  lastY = y;
}
window.addEventListener("scroll", onScrollHeader, { passive: true });

/* ---------- mobile menu ---------- */

const menuToggle = document.getElementById("menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");

/**
 * Closes the mobile menu and takes its links back out of the tab order.
 *
 * @returns {void}
 */
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
const journeyStage = document.getElementById("journey-stage");
let activeStep = -1;

/**
 * Marks one journey step as active and collapses the rest.
 *
 * @param {number} idx Index of the step to activate.
 * @returns {void}
 */
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

// Step boundaries matched to where the camera actually enters each zone, not to
// even quarters: the district and the plant take longer to cross than the rest.
const STEP_BOUNDS = [0.36, 0.56, 0.84];

/**
 * Maps journey progress to the step that should be open.
 *
 * @param {number} p Journey progress, 0 to 1.
 * @returns {number} Step index, 0 to 3.
 */
function stepForProgress(p) {
  if (p < STEP_BOUNDS[0]) return 0;
  if (p < STEP_BOUNDS[1]) return 1;
  if (p < STEP_BOUNDS[2]) return 2;
  return 3;
}

ScrollTrigger.create({
  trigger: journeyEl,
  start: "top top",
  end: "bottom bottom",
  scrub: true,
  onUpdate(self) {
    const p = self.progress;
    if (xp) xp.setProgress(p);
    setActiveStep(stepForProgress(p));
    // Fade the stage UI out before the statement scrolls in, so the two
    // sections never overlap.
    const fade = p > 0.92 ? Math.max(0, 1 - (p - 0.92) / 0.06) : 1;
    journeyStage.style.opacity = fade;
    journeyStage.style.pointerEvents = fade < 0.4 ? "none" : "";
  },
});

// Scrolling back out above the journey leaves the camera wherever it was, so
// reset it to the path start explicitly.
ScrollTrigger.create({
  trigger: journeyEl,
  start: "top bottom",
  end: "top top",
  onLeaveBack() {
    if (xp) xp.setProgress(0);
  },
});

// Pause rendering once the GL stage is fully covered by opaque sections.
const paperEl = document.querySelector(".paper");
ScrollTrigger.create({
  trigger: paperEl,
  start: "top top",
  end: "max",
  onToggle(self) {
    if (xp) xp.setPaused(self.isActive);
  },
});

// Clicking a step scrolls to the middle of its segment.
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

// Each word gets its own overflow-hidden box so it can slide up from behind the
// line above it, which a single translate on the whole block cannot do.
document.querySelectorAll("[data-split]").forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words
    .map((w) => `<span class="split-word"><span>${w}</span></span>`)
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

  // Statement: words brighten one by one as you scroll, scrubbed rather than
  // timed, so reading pace and scroll pace stay together.
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

  // The hero is excluded because its reveals belong to the intro timeline.
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
    if (reduced) return; // let <details> toggle natively
    e.preventDefault();
    if (item.open) {
      gsap.to(answer, {
        height: 0,
        opacity: 0,
        duration: 0.45,
        ease: "power3.inOut",
        onComplete() {
          // Close only after the collapse has played, then hand the inline
          // styles back so the answer can be measured again next time.
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
      // Elastic return so the button overshoots home rather than easing to it.
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.45)" });
    });
  });
}

/* ---------- copy email ---------- */

document.querySelectorAll("[data-copy]").forEach((btn) => {
  const label = btn.textContent;
  let timer = null;
  btn.addEventListener("click", async () => {
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // The async clipboard API needs a secure context and permission; fall
      // back to a hidden textarea so the button still works everywhere.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    btn.textContent = "Copied ✓";
    btn.classList.add("copied");
    clearTimeout(timer);
    timer = setTimeout(() => {
      btn.textContent = label;
      btn.classList.remove("copied");
    }, 2000);
  });
});

ScrollTrigger.refresh();

/* ---------- back to top ---------- */

// The journey is sixteen screens deep; the way back up should be one press.
(function backToTop() {
  const button = document.createElement("button");
  button.className = "to-top";
  button.type = "button";
  button.setAttribute("aria-label", "Back to top");
  // A rocket, drawn rather than borrowed: the glyph is inline so it takes
  // the button's own colour and needs no font or icon set.
  button.innerHTML =
    '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 2.6c2.4 2.3 3.7 5.4 3.7 8.7v3.9H8.3v-3.9c0-3.3 1.3-6.4 3.7-8.7z"/><path d="M8.3 11.6 5.4 14.4v3.4l2.9-1.7"/><path d="M15.7 11.6l2.9 2.8v3.4l-2.9-1.7"/><circle cx="12" cy="9.2" r="1.5"/><path d="M12 17.6v3.2"/></svg>';
  document.body.appendChild(button);

  button.addEventListener("click", () => scrollToTarget(0));

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        button.classList.toggle("is-visible", window.scrollY > window.innerHeight);
        ticking = false;
      });
    },
    { passive: true },
  );
})();
