/*
 * POST /api/publish  — admin "랜딩관리" save endpoint.
 *
 * Auth:   body.password === process.env.ADMIN_PASSWORD
 * Action: bake content into index.html, then atomically commit
 *         content.json + index.html + uploaded images (img/*) to GitHub.
 *         GitHub push -> Vercel auto-redeploy.
 *
 * Required env vars (set in Vercel project settings):
 *   ADMIN_PASSWORD   admin login password
 *   GITHUB_TOKEN     fine-grained PAT with "Contents: Read and write" on the repo
 * Optional (have sensible defaults):
 *   GH_OWNER (papascompany)  GH_REPO (papascompany-homepage)  GH_BRANCH (main)
 */
const crypto = require('crypto');
const { bake } = require('../lib/bake');

const GH = 'https://api.github.com';
const OWNER = process.env.GH_OWNER || 'papascompany';
const REPO = process.env.GH_REPO || 'papascompany-homepage';
const BRANCH = process.env.GH_BRANCH || 'main';

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'papas-cms',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function gh(token, method, path, body) {
  const res = await fetch(`${GH}${path}`, {
    method,
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json && json.message ? json.message : `GitHub ${res.status}`;
    const err = new Error(`${method} ${path} → ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!token || !adminPw) {
    return res.status(500).json({ ok: false, error: '서버에 GITHUB_TOKEN / ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.' });
  }

  let body;
  try { body = await readBody(req); } catch { return res.status(400).json({ ok: false, error: '잘못된 요청 본문' }); }

  const { password, content, images } = body || {};
  if (!safeEqual(password || '', adminPw)) {
    return res.status(401).json({ ok: false, error: '비밀번호가 올바르지 않습니다.' });
  }
  if (!content || typeof content !== 'object') {
    return res.status(400).json({ ok: false, error: 'content 누락' });
  }

  const imgs = Array.isArray(images) ? images : [];
  if (imgs.length > 60) return res.status(400).json({ ok: false, error: '이미지가 너무 많습니다(최대 60).' });
  for (const im of imgs) {
    if (!im || typeof im.name !== 'string' || typeof im.dataBase64 !== 'string') {
      return res.status(400).json({ ok: false, error: '이미지 형식 오류' });
    }
    if (!/^[\w.\-]+\.(webp|png|jpe?g|gif|svg)$/i.test(im.name)) {
      return res.status(400).json({ ok: false, error: `이미지 파일명 오류: ${im.name}` });
    }
    if (im.dataBase64.length > 4_500_000) {
      return res.status(400).json({ ok: false, error: `이미지가 너무 큽니다: ${im.name}` });
    }
  }

  try {
    // 1) current ref + base tree
    const ref = await gh(token, 'GET', `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
    const headSha = ref.object.sha;
    const headCommit = await gh(token, 'GET', `/repos/${OWNER}/${REPO}/git/commits/${headSha}`);
    const baseTree = headCommit.tree.sha;

    // 2) fetch current index.html, bake new content into it
    const file = await gh(token, 'GET', `/repos/${OWNER}/${REPO}/contents/index.html?ref=${BRANCH}`);
    const currentHtml = Buffer.from(file.content, 'base64').toString('utf8');
    const bakedHtml = bake(currentHtml, content);

    // 3) create blobs
    const treeItems = [];
    const mkBlob = async (str, encoding) => {
      const b = await gh(token, 'POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content: str, encoding });
      return b.sha;
    };

    treeItems.push({ path: 'index.html', mode: '100644', type: 'blob', sha: await mkBlob(bakedHtml, 'utf-8') });
    treeItems.push({ path: 'content.json', mode: '100644', type: 'blob', sha: await mkBlob(JSON.stringify(content, null, 2), 'utf-8') });
    for (const im of imgs) {
      treeItems.push({ path: `img/${im.name}`, mode: '100644', type: 'blob', sha: await mkBlob(im.dataBase64, 'base64') });
    }

    // 4) tree -> commit -> move ref
    const tree = await gh(token, 'POST', `/repos/${OWNER}/${REPO}/git/trees`, { base_tree: baseTree, tree: treeItems });
    const msg = `chore(cms): 랜딩 콘텐츠 업데이트${imgs.length ? ` (+이미지 ${imgs.length})` : ''}`;
    const commit = await gh(token, 'POST', `/repos/${OWNER}/${REPO}/git/commits`, {
      message: msg, tree: tree.sha, parents: [headSha],
    });
    await gh(token, 'PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha });

    return res.status(200).json({
      ok: true,
      commit: commit.sha.slice(0, 7),
      images: imgs.length,
      message: '저장 완료 — 약 1분 후 사이트에 반영됩니다.',
    });
  } catch (e) {
    return res.status(e.status === 401 || e.status === 403 ? 403 : 500).json({
      ok: false,
      error: `GitHub 커밋 실패: ${e.message}`,
    });
  }
};
