/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/**
 * Disclosure guard.
 *
 * The published site is subject to standing confidentiality obligations and to
 * deliberate decisions about what stays private. Those rules are easy to honour
 * while writing a page and easy to forget six months later, so they are
 * enforced on every push.
 *
 * The restricted terms are stored as SHA-256 hashes, never as text: a guard
 * that named what it guards would itself be the leak. Scanning tokenises each
 * published file and hashes every one-to-three word sequence; a match means a
 * restricted term is about to become public. A failure here is not a style
 * problem.
 */

const { test, expect } = require("@playwright/test");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");

/** Directories that are not ours to police. */
const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "kenney",
  ".playwright-mcp",
  "test-results",
  "playwright-report",
  "tests",
]);

/** File types that are published as-is and therefore readable by anyone. */
const PUBLISHED_EXTENSIONS = new Set([".html", ".css", ".js", ".xml", ".txt", ".json", ".md"]);

/**
 * SHA-256 digests of restricted terms, lowercased with punctuation collapsed
 * to single spaces. Regenerate one with:
 *   node -e 'console.log(require("crypto").createHash("sha256").update("term").digest("hex"))'
 */
const RESTRICTED = new Set([
  "48a2d7500c3b135868f7715bf0c0158221fb6a624b85ed9629e3430c09faa5fb",
  "dfe623935fafb2a2f00df3a0f20f5a0f4440f69045d6084b896679c84e19c5f7",
  "243c76a05606d622ea5ed6f644348f5ff1acd91f0ec2ed5c1ef20a6765f46cda",
  "8536f34ea4112c1d6338469d6351d4dd5cb40e4bedfa0e2a451b0c2fbcc6d344",
  "b81c8201acfc7639be3bd3d7f875ba5ca76e422fa2163cec9dace50662b637a7",
  "4c629bff1469ba4afe85eae4e1f520f4038025b7437abff36c6c518cedf13428",
  "047364b9be67f665eca384b8061d688b8642a8b47b3de35c22a012ed6fe69242",
  "8d2d5be141e37e13f3eaa4a427c1c998eb2f3f9d66d22bb85322e4f5e1cc65f5",
  "16634fabf93fe85f892c536a422bbdea399fbccdbb6bdfc9080349302be514e5",
  "db36729ecbe60201923c740e9803c2761778fba8af9f4ddec23285abf834ef85",
  "4e30588c032830ad3c89ff1dff6492f064279864b0db62359d2369d61a149f2f",
  "b7bfa710ac7a88b75677afd0419e8ec667306ffb077b6f0cd2b43f156d7766a1",
  "d2b763e70d078c9355f973f5dcaf896f73a656d2845e356247c52f6dbdddec95",
]);

/** Longest restricted term, in words. */
const MAX_WORDS = 3;

/**
 * Personal mobile numbers are caught by format, not by a stored number:
 * Malaysian mobile patterns in international or local notation.
 */
const PHONE_PATTERNS = [
  /\+?60\s?1\d[-\s]?\d{3}[-\s]?\d{4}/,
  /\b01\d[-\s]\d{3}[-\s]?\d{4}\b/,
];

/**
 * Collect every published file in the repository.
 *
 * @param {string} dir Directory to walk.
 * @param {string[]} [found] Accumulator used by the recursive calls.
 * @returns {string[]} Absolute paths of files that ship to the public site.
 */
function collectPublishedFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectPublishedFiles(full, found);
    } else if (PUBLISHED_EXTENSIONS.has(path.extname(entry.name))) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Hash every one-to-MAX_WORDS token sequence of a text and return those that
 * match the restricted set.
 *
 * @param {string} text File content.
 * @returns {string[]} Matching digests, eight-character prefixes.
 */
function restrictedMatches(text) {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const hits = new Set();
  for (let i = 0; i < tokens.length; i++) {
    let gram = "";
    for (let n = 0; n < MAX_WORDS && i + n < tokens.length; n++) {
      gram = n === 0 ? tokens[i] : `${gram} ${tokens[i + n]}`;
      const digest = crypto.createHash("sha256").update(gram).digest("hex");
      if (RESTRICTED.has(digest)) hits.add(digest.slice(0, 8));
    }
  }
  return [...hits];
}

const publishedFiles = collectPublishedFiles(REPO_ROOT);

test("the repository contains published files to check", () => {
  expect(publishedFiles.length).toBeGreaterThan(0);
});

test("no published file contains a restricted term", () => {
  const offenders = [];
  for (const file of publishedFiles) {
    const hits = restrictedMatches(fs.readFileSync(file, "utf8"));
    if (hits.length) {
      offenders.push(`${path.relative(REPO_ROOT, file)} [${hits.join(", ")}]`);
    }
  }
  expect(offenders, "restricted terms about to become public").toEqual([]);
});

test("no published file contains a mobile number", () => {
  const offenders = publishedFiles
    .filter((file) => {
      const text = fs.readFileSync(file, "utf8");
      return PHONE_PATTERNS.some((re) => re.test(text));
    })
    .map((file) => path.relative(REPO_ROOT, file));

  expect(offenders).toEqual([]);
});

test("no em dashes in published files", () => {
  // House style, matching the LaTeX document kit. The JSON escape form counts
  // too: it once hid inside the homepage JSON-LD. So do the HTML entity
  // forms, which once slipped past this guard inside the records page.
  const offenders = publishedFiles
    .filter((file) => {
      const text = fs.readFileSync(file, "utf8");
      return (
        text.includes("—") ||
        text.includes("\\u2014") ||
        /&mdash;|&#8212;|&#x2014;/i.test(text)
      );
    })
    .map((file) => path.relative(REPO_ROOT, file));

  expect(offenders).toEqual([]);
});

/**
 * House vocabulary. Words and phrases the founder has retired from the public
 * site: banned either because they fingerprint a client's documents or
 * because a standing style decision replaced them, or because they promise
 * commercial terms the company will not publish. The savings-linked pricing
 * language survived one deletion by hiding in metadata, where only search
 * engines and link previews read it; this keeps every retirement permanent.
 */
const BANNED_PHRASES = [
  "paperwork",
  "paid on results",
  "paid from verified",
  "verified savings",
  "pay only from",
  "you pay nothing",
  "bills of lading",
  "in scoping",
  "founding client",
  "founding partner",
  "founding clinic",
];

test("no published file uses retired vocabulary", () => {
  const offenders = [];
  for (const file of publishedFiles) {
    if (file.endsWith("disclosure.spec.js")) continue;
    const text = fs.readFileSync(file, "utf8").toLowerCase();
    const hits = BANNED_PHRASES.filter((p) => text.includes(p));
    if (hits.length) {
      offenders.push(`${path.relative(REPO_ROOT, file)} [${hits.join(", ")}]`);
    }
  }
  expect(offenders, "retired vocabulary is back on the public site").toEqual([]);
});

/**
 * Page-shape contract. Every product page is a hero, a problem, a design and
 * a next step: nothing else. Sections have been resurrected once by
 * concurrent edits; this makes the shape a build failure instead of a
 * discovery.
 */
const PRODUCT_DIRS = [
  "chiller-plant",
  "records",
  "clinical",
  "field",
  "machinery",
  "fnb",
  "logistics",
  "retail",
];

const ALLOWED_KICKERS = new Set(["The problem", "The design", "Next step"]);

test("every product page is problem, design, next step", () => {
  const violations = [];
  for (const dir of PRODUCT_DIRS) {
    const html = fs.readFileSync(path.join(REPO_ROOT, dir, "index.html"), "utf8");
    const kickers = [...html.matchAll(/<p class="kicker"[^>]*>([^<]+)<\/p>/g)].map((m) => m[1]);
    const body = kickers.slice(1); // the first kicker is the page's own name
    const extras = body.filter((k) => !ALLOWED_KICKERS.has(k));
    if (extras.length) violations.push(`${dir}: extra sections [${extras.join(", ")}]`);
    if (!body.includes("The problem")) violations.push(`${dir}: missing problem`);
    if (!body.includes("Next step")) violations.push(`${dir}: missing next step`);
  }
  expect(violations).toEqual([]);
});
