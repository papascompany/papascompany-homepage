/*
 * bake.js — apply content.json values into the annotated index.html.
 * Shared by api/publish.js (server-side bake before committing).
 *
 * Conventions produced by scripts/extract.js:
 *   [data-k]      -> element.innerHTML  = content[key]
 *   [data-src-k]  -> element src attr   = content[key]
 *   [data-href-k] -> element href attr  = content[key]
 *   theme.*       -> injected <style id="cms-theme"> (CSS variables + fonts)
 */
const { parse } = require('node-html-parser');

function esc(s) {
  return String(s == null ? '' : s);
}

function themeCss(content) {
  const v = (k) => content[k];
  const rootVars = [];
  if (v('theme.brand')) rootVars.push(`--papas:${v('theme.brand')}`);
  if (v('theme.cyan')) rootVars.push(`--cyan:${v('theme.cyan')}`);
  if (v('theme.ink')) rootVars.push(`--ink:${v('theme.ink')}`);
  if (v('theme.bodyFont')) rootVars.push(`--sans:${v('theme.bodyFont')}`);
  const lines = [];
  if (rootVars.length) lines.push(`:root{${rootVars.join(';')}}`);
  if (v('theme.headingFont')) {
    lines.push(`h1,h2,h3,h4,h5,h6,.section-title{font-family:${v('theme.headingFont')}}`);
  }
  const scale = parseFloat(v('theme.scale'));
  if (!Number.isNaN(scale) && scale > 0 && Math.abs(scale - 1) > 0.001) {
    lines.push(`html{font-size:${(16 * scale).toFixed(2)}px}`);
  }
  return lines.join('\n');
}

/**
 * @param {string} html  annotated index.html
 * @param {object} content  content.json values
 * @returns {string} baked html
 */
function bake(html, content) {
  const root = parse(html, {
    comment: true,
    blockTextElements: { script: true, style: true, pre: true, textarea: true },
  });

  // text / html fields
  for (const el of root.querySelectorAll('[data-k]')) {
    const key = el.getAttribute('data-k');
    if (key in content) el.set_content(esc(content[key]));
  }
  // image src
  for (const el of root.querySelectorAll('[data-src-k]')) {
    const key = el.getAttribute('data-src-k');
    if (key in content) el.setAttribute('src', esc(content[key]));
  }
  // editable links
  for (const el of root.querySelectorAll('[data-href-k]')) {
    const key = el.getAttribute('data-href-k');
    if (key in content) el.setAttribute('href', esc(content[key]));
  }

  // theme: inject or replace <style id="cms-theme"> at end of <head>
  const css = themeCss(content);
  const existing = root.querySelector('#cms-theme');
  if (existing) {
    existing.set_content(css);
  } else if (css) {
    const head = root.querySelector('head');
    if (head) head.insertAdjacentHTML('beforeend', `\n<style id="cms-theme">${css}</style>\n`);
  }

  return root.toString();
}

module.exports = { bake, themeCss };
