#!/usr/bin/env node
/*
 * extract.js — annotate index.html editable elements with data-k / data-src-k,
 * and emit content.json (values) + content.meta.json (group/label/type per key).
 *
 * Run once to bootstrap the CMS. Idempotent: re-running re-annotates from the
 * current index.html (use the un-annotated source the first time).
 *
 * Shared key convention is consumed by lib/bake.js (server-side baking on publish)
 * and admin/ (schema-driven editor).
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');

const ROOT = path.resolve(__dirname, '..');
const htmlPath = path.join(ROOT, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// keep whitespace + comments so the page is preserved faithfully on re-serialize
const root = parse(html, {
  comment: true,
  blockTextElements: { script: true, style: true, pre: true, textarea: true },
});

const content = {};
const meta = {}; // key -> { group, groupLabel, label, type, order }
let order = 0;

const TEXTAREA_AT = 55; // text longer than this becomes a textarea field

function fieldType(el) {
  const inner = el.innerHTML.trim();
  if (/<[a-z]/i.test(inner)) return 'html';
  return inner.length > TEXTAREA_AT ? 'textarea' : 'text';
}

// annotate a single element as an editable text/html field
function text(el, group, groupLabel, role, label) {
  if (!el) return;
  const key = `${group}.${role}`;
  el.setAttribute('data-k', key);
  content[key] = el.innerHTML.trim();
  meta[key] = { group, groupLabel, label, type: fieldType(el), order: order++ };
}

// annotate an <img> as an editable image field
function image(el, group, groupLabel, role, label) {
  if (!el) return;
  const key = `${group}.${role}`;
  el.setAttribute('data-src-k', key);
  content[key] = el.getAttribute('src') || '';
  meta[key] = { group, groupLabel, label, type: 'image', order: order++ };
}

const $ = (sel, scope = root) => scope.querySelector(sel);
const $$ = (sel, scope = root) => scope.querySelectorAll(sel);
const sec = (id) => $(`#${id}`) || root;

/* ---------------- NAV ---------------- */
{
  const g = 'nav', gl = '내비게이션';
  text($('.nav-brand .ko'), g, gl, 'brandKo', '브랜드 부제(한글)');
  const navA = $$('.nav-links a');
  const mobA = $$('.mobile-nav a');
  navA.forEach((a, i) => {
    const key = `${g}.link${i}`;
    a.setAttribute('data-k', key);
    if (mobA[i]) mobA[i].setAttribute('data-k', key); // keep desktop+mobile labels in sync
    content[key] = a.innerHTML.trim();
    meta[key] = { group: g, groupLabel: gl, label: `메뉴 ${i + 1}`, type: 'text', order: order++ };
  });
  text($('.nav-actions .btn-primary'), g, gl, 'cta', '문의 버튼 문구');
}

/* ---------------- HERO ---------------- */
{
  const s = sec('top'), g = 'hero', gl = '히어로(첫 화면)';
  image($('.hero-bg img', s), g, gl, 'bg', '배경 이미지');
  text($('.hero-eyebrow', s), g, gl, 'eyebrow', '상단 라벨');
  text($('h1', s), g, gl, 'title', '대제목(HTML 가능, 영문 보조문구 포함)');
  text($('.hero-sub', s), g, gl, 'sub', '소개 문단');
  const btns = $$('.hero-actions .btn', s);
  text(btns[0], g, gl, 'btn1', '버튼1 문구');
  text(btns[1], g, gl, 'btn2', '버튼2 문구');
}

/* ---------------- THUMB TRAY ---------------- */
{
  const g = 'thumbs', gl = '썸네일 트레이';
  $$('.thumb-tray .thumb').forEach((t, i) => {
    image($('img', t), g, gl, `img${i}`, `썸네일 ${i + 1} 이미지`);
    text($('.thumb-label', t), g, gl, `label${i}`, `썸네일 ${i + 1} 라벨`);
  });
}

/* ---------------- STORY INTRO ---------------- */
{
  const s = sec('story-intro'), g = 'story', gl = '회사 소개';
  text($('.section-eyebrow', s), g, gl, 'eyebrow', '라벨');
  text($('h2', s), g, gl, 'title', '제목(HTML 가능)');
  text($('.lead-sub', s), g, gl, 'leadSub', '영문 보조문구');
  text($('.copy p:not(.lead-sub)', s), g, gl, 'body', '본문');
  text($('.copy .btn', s), g, gl, 'btn', '버튼 문구');
  image($('.intro-image img', s), g, gl, 'img', '이미지');
}

/* ---------------- SOLUTION CARDS ---------------- */
{
  const s = sec('solutions'), g = 'solutions', gl = '솔루션 섹션';
  text($('.section-eyebrow', s), g, gl, 'eyebrow', '라벨');
  text($('.section-title', s), g, gl, 'title', '제목(HTML 가능)');
  text($('.section-lead', s), g, gl, 'lead', '설명');
  $$('.sol-card', s).forEach((c, i) => {
    const cg = `sol_card${i}`, cgl = `솔루션 카드 ${i + 1}`;
    image($('.sol-card-img img', c), cg, cgl, 'img', '이미지');
    text($('.sol-card-tag', c), cg, cgl, 'tag', '뱃지');
    text($('h3', c), cg, cgl, 'title', '제목');
    text($('.sol-card-en', c), cg, cgl, 'en', '영문');
    text($('.sol-card-desc', c), cg, cgl, 'desc', '설명');
  });
}

/* ---------------- LINEUP TILES ---------------- */
{
  const s = sec('lineup'), g = 'lineup', gl = '제품 라인업';
  text($('.section-eyebrow', s), g, gl, 'eyebrow', '라벨');
  text($('.section-title', s), g, gl, 'title', '제목(HTML 가능)');
  text($('.section-lead', s), g, gl, 'lead', '설명');
  $$('.lineup-tabs button', s).forEach((b, i) => text(b, g, gl, `tab${i}`, `탭 ${i + 1}`));
  $$('.lineup-grid .tile', s).forEach((t, i) => {
    const cg = `tile${i}`, cgl = `라인업 타일 ${i + 1}`;
    image($('img', t), cg, cgl, 'img', '이미지');
    text($('.tile-platform', t), cg, cgl, 'platform', '뱃지');
    text($('.tile-info h4', t), cg, cgl, 'title', '제목');
    text($('.tile-info p', t), cg, cgl, 'desc', '설명');
  });
}

/* ---------------- PIPELINE ---------------- */
{
  const s = sec('pipeline'), g = 'pipeline', gl = '파이프라인';
  text($('.section-eyebrow', s), g, gl, 'eyebrow', '라벨');
  text($('.section-title', s), g, gl, 'title', '제목(HTML 가능)');
  text($('.section-lead', s), g, gl, 'lead', '설명');
  $$('.pl-step', s).forEach((st, i) => {
    const cg = `pl${i}`, cgl = `파이프라인 ${i + 1}`;
    image($('img', st), cg, cgl, 'img', '이미지');
    text($('.pl-num-badge', st), cg, cgl, 'badge', '단계 뱃지');
    text($('.pl-body h4', st), cg, cgl, 'title', '제목');
    text($('.pl-body p', st), cg, cgl, 'desc', '설명');
    text($('.pl-stack', st), cg, cgl, 'stack', '스택(HTML 가능)');
  });
}

/* ---------------- STATS ---------------- */
{
  const s = sec('stats'), g = 'stats', gl = '실적·시장';
  text($('.section-eyebrow', s), g, gl, 'eyebrow', '라벨');
  text($('.section-title', s), g, gl, 'title', '제목(HTML 가능)');
  const lead = $('.section-lead', s);
  if (lead) text(lead, g, gl, 'lead', '설명');
}

/* ---------------- ANNIVERSARY ---------------- */
{
  const s = sec('anniversary'), g = 'anniversary', gl = '브랜드 블록';
  if (s && s !== root) {
    $$('h2, h3', s).slice(0, 1).forEach((h) => text(h, g, gl, 'title', '제목(HTML 가능)'));
    const ps = $$('p', s);
    ps.forEach((p, i) => { if (p.text.trim()) text(p, g, gl, `body${i}`, `문단 ${i + 1}`); });
    $$('img', s).forEach((im, i) => image(im, g, gl, `img${i}`, `이미지 ${i + 1}`));
  }
}

/* ---------------- ROADMAP ---------------- */
{
  const s = sec('roadmap'), g = 'roadmap', gl = '2026 로드맵';
  text($('.section-eyebrow', s), g, gl, 'eyebrow', '라벨');
  text($('.section-title', s), g, gl, 'title', '제목(HTML 가능)');
  text($('.section-lead', s), g, gl, 'lead', '설명');
  $$('.news-card', s).forEach((c, i) => {
    const cg = `news${i}`, cgl = `로드맵 카드 ${i + 1}`;
    image($('.news-card-img img', c), cg, cgl, 'img', '이미지');
    text($('.qbadge', c), cg, cgl, 'badge', '분기 뱃지');
    text($('.news-card-tag', c), cg, cgl, 'tag', '태그');
    text($('.news-card-body h4', c), cg, cgl, 'title', '제목');
    text($('.news-card-body > p', c), cg, cgl, 'desc', '설명');
    text($('.news-author .meta strong', c), cg, cgl, 'author', '작성자');
  });
}

/* ---------------- IDENTITY / VALUES ---------------- */
{
  const s = sec('identity'), g = 'identity', gl = '브랜드 가치';
  if (s && s !== root) {
    const q = $('.identity-quote', s);
    if (q) text(q, g, gl, 'quote', '인용문(HTML 가능)');
    $$('.value-cell', s).forEach((cell, i) => {
      const h = $('h3, h4', cell) || $('strong', cell);
      const p = $('p', cell);
      if (h) text(h, g, gl, `valTitle${i}`, `가치 ${i + 1} 제목`);
      if (p) text(p, g, gl, `valDesc${i}`, `가치 ${i + 1} 설명`);
    });
  }
}

/* ---------------- PROMO BANNER ---------------- */
{
  const promo = $('.promo, .promo-banner') || null;
  if (promo) {
    const g = 'promo', gl = '프로모 배너';
    $$('h2, h3', promo).slice(0, 1).forEach((h) => text(h, g, gl, 'title', '제목(HTML 가능)'));
    $$('p', promo).forEach((p, i) => { if (p.text.trim()) text(p, g, gl, `body${i}`, `문단 ${i + 1}`); });
    $$('.btn', promo).forEach((b, i) => text(b, g, gl, `btn${i}`, `버튼 ${i + 1}`));
  }
}

/* ---------------- CONTACT ---------------- */
{
  const s = sec('contact'), g = 'contact', gl = '문의(CTA)';
  text($('.eyebrow', s), g, gl, 'eyebrow', '라벨');
  text($('h3', s), g, gl, 'title', '제목(HTML 가능)');
  text($('.cta-block p, .inner p', s), g, gl, 'body', '설명');
  const btns = $$('.cta-row .btn', s);
  text(btns[0], g, gl, 'btn1', '버튼1');
  text(btns[1], g, gl, 'btn2', '버튼2');
}

/* ---------------- PORTFOLIO ---------------- */
{
  const s = sec('portfolio'), g = 'portfolio', gl = '포트폴리오';
  text($('.section-eyebrow', s), g, gl, 'eyebrow', '라벨');
  text($('.section-title', s), g, gl, 'title', '제목(HTML 가능)');
  text($('.section-lead', s), g, gl, 'lead', '설명');
  $$('.portfolio-grid .tile', s).forEach((t, i) => {
    const cg = `pf${i}`, cgl = `포트폴리오 ${i + 1}`;
    const im = $('img', t);
    if (im) image(im, cg, cgl, 'img', '이미지');
    text($('.tile-info h4', t), cg, cgl, 'title', '제목');
    text($('.tile-info p', t), cg, cgl, 'desc', '설명');
    // editable outbound link (href) for linked cards
    if (t.tagName === 'A') {
      const key = `${cg}.href`;
      t.setAttribute('data-href-k', key);
      content[key] = t.getAttribute('href') || '';
      meta[key] = { group: cg, groupLabel: cgl, label: '링크 URL', type: 'url', order: order++ };
    }
  });
}

/* ---------------- FOOTER ---------------- */
{
  const f = $('.footer') || sec('footer');
  if (f) {
    const g = 'footer', gl = '푸터';
    text($('.footer-brand-ko', f), g, gl, 'brandKo', '브랜드 부제');
    $$('.footer-col', f).forEach((col, ci) => {
      const h = $('h6', col);
      if (h) text(h, g, gl, `col${ci}_title`, `컬럼 ${ci + 1} 제목`);
      $$('li a', col).forEach((a, li) => text(a, g, gl, `col${ci}_link${li}`, `컬럼 ${ci + 1} 링크 ${li + 1}`));
    });
    const bottom = $('.footer-bottom', f);
    if (bottom) {
      $$('p, div', bottom).forEach((el, i) => {
        if (el.text.trim() && !$('p,div', el)) text(el, g, gl, `bottom${i}`, `하단 문구 ${i + 1}`);
      });
    }
  }
}

/* ---------------- TYPOGRAPHY / THEME (CSS variables) ---------------- */
{
  const g = 'theme', gl = '타이포그래피 · 색상';
  // these are applied by bake into a <style id="cms-theme"> block (see lib/bake)
  const themeDefaults = {
    'theme.brand': { val: '#0058d4', label: '브랜드 메인 색상', type: 'color' },
    'theme.cyan': { val: '#1eaedb', label: '보조(시안) 색상', type: 'color' },
    'theme.ink': { val: '#0a0e17', label: '기본 텍스트 색상', type: 'color' },
    'theme.headingFont': { val: "'Pretendard', system-ui, sans-serif", label: '제목 폰트', type: 'text' },
    'theme.bodyFont': { val: "'Pretendard', system-ui, sans-serif", label: '본문 폰트', type: 'text' },
    'theme.scale': { val: '1', label: '글자 크기 배율(0.9~1.2)', type: 'text' },
  };
  for (const [key, d] of Object.entries(themeDefaults)) {
    content[key] = d.val;
    meta[key] = { group: g, groupLabel: gl, label: d.label, type: d.type, order: order++ };
  }
}

/* ---------------- WRITE OUTPUTS ---------------- */
fs.writeFileSync(path.join(ROOT, 'content.json'), JSON.stringify(content, null, 2));
fs.writeFileSync(path.join(ROOT, 'content.meta.json'), JSON.stringify(meta, null, 2));
fs.writeFileSync(htmlPath, root.toString());

const groups = [...new Set(Object.values(meta).map((m) => m.groupLabel))];
console.log(`✅ extracted ${Object.keys(content).length} fields across ${groups.length} groups`);
console.log(`   images: ${Object.values(meta).filter((m) => m.type === 'image').length}`);
console.log(`   wrote content.json, content.meta.json, and re-annotated index.html`);
