import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

function resolveToken() {
  if (process.env.PROFILE_DASHBOARD_TOKEN) return process.env.PROFILE_DASHBOARD_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const token = execSync('gh auth token', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (token) return token;
  } catch {}
  return '';
}

const USERNAME = process.env.PROFILE_USERNAME || 'JOTAGGE';
const TOKEN = resolveToken();
const HAS_TOKEN = Boolean(TOKEN);
const API = 'https://api.github.com';

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': `${USERNAME}-profile-dashboard`,
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  'X-GitHub-Api-Version': '2022-11-28',
};

const techMeta = {
  TypeScript: { color: '3178c6', badgeBg: '3178C6', logo: 'typescript', logoColor: 'white', label: 'TypeScript' },
  JavaScript: { color: 'f7df1e', badgeBg: 'F7DF1E', logo: 'javascript', logoColor: 'black', label: 'JavaScript' },
  React: { color: '61dafb', badgeBg: '20232A', logo: 'react', logoColor: '61DAFB', label: 'React' },
  'Next.js': { color: 'ffffff', badgeBg: '000000', logo: 'nextdotjs', logoColor: 'white', label: 'Next.js' },
  'Node.js': { color: '5fa04e', badgeBg: '339933', logo: 'nodedotjs', logoColor: 'white', label: 'Node.js' },
  Express: { color: 'ffffff', badgeBg: '000000', logo: 'express', logoColor: 'white', label: 'Express' },
  Vite: { color: '646cff', badgeBg: '646CFF', logo: 'vitedotjs', logoColor: 'white', label: 'Vite' },
  PostgreSQL: { color: '4169e1', badgeBg: '4169E1', logo: 'postgresql', logoColor: 'white', label: 'PostgreSQL' },
  Supabase: { color: '3ecf8e', badgeBg: '3ECF8E', logo: 'supabase', logoColor: 'white', label: 'Supabase' },
  Prisma: { color: '5a67d8', badgeBg: '2D3748', logo: 'prisma', logoColor: 'white', label: 'Prisma' },
  Firebase: { color: 'ffca28', badgeBg: 'FFCA28', logo: 'firebase', logoColor: 'black', label: 'Firebase' },
  Docker: { color: '2496ed', badgeBg: '2496ED', logo: 'docker', logoColor: 'white', label: 'Docker' },
  Kubernetes: { color: '326ce5', badgeBg: '326CE5', logo: 'kubernetes', logoColor: 'white', label: 'Kubernetes' },
  Python: { color: '3776ab', badgeBg: '3776AB', logo: 'python', logoColor: 'white', label: 'Python' },
  FastAPI: { color: '009688', badgeBg: '009688', logo: 'fastapi', logoColor: 'white', label: 'FastAPI' },
  Java: { color: 'ed8b00', badgeBg: 'ED8B00', logo: 'openjdk', logoColor: 'white', label: 'Java' },
  Spring: { color: '6db33f', badgeBg: '6DB33F', logo: 'springboot', logoColor: 'white', label: 'Spring' },
  PHP: { color: '777bb4', badgeBg: '777BB4', logo: 'php', logoColor: 'white', label: 'PHP' },
  Flutter: { color: '02569b', badgeBg: '02569B', logo: 'flutter', logoColor: 'white', label: 'Flutter' },
  Dart: { color: '0175c2', badgeBg: '0175C2', logo: 'dart', logoColor: 'white', label: 'Dart' },
  Tailwind: { color: '06b6d4', badgeBg: '06B6D4', logo: 'tailwindcss', logoColor: 'white', label: 'Tailwind' },
  'GitHub Actions': { color: '2088ff', badgeBg: '2088FF', logo: 'githubactions', logoColor: 'white', label: 'Actions' },
  Terraform: { color: '844fba', badgeBg: '844FBA', logo: 'terraform', logoColor: 'white', label: 'Terraform' },
  HTML: { color: 'e34f26', badgeBg: 'E34F26', logo: 'html5', logoColor: 'white', label: 'HTML5' },
  CSS: { color: '1572b6', badgeBg: '1572B6', logo: 'css3', logoColor: 'white', label: 'CSS3' },
  CSharp: { color: '512bd4', badgeBg: '512BD4', logo: 'csharp', logoColor: 'white', label: 'C#' },
  Shell: { color: '89e051', badgeBg: '89E051', logo: 'gnubash', logoColor: 'white', label: 'Shell' }
};

const techPriority = [
  'Next.js', 'React', 'TypeScript', 'Node.js', 'Express', 'Vite',
  'Tailwind', 'Prisma', 'Supabase', 'PostgreSQL', 'Python', 'FastAPI',
  'Firebase', 'Docker', 'Kubernetes', 'Flutter', 'Dart', 'Java', 'Spring',
  'PHP', 'CSharp', 'JavaScript', 'HTML', 'CSS', 'Shell', 'GitHub Actions', 'Terraform'
];

async function gh(path) {
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${path}`);
  return res.json();
}

async function listRepos() {
  const path = HAS_TOKEN
    ? '/user/repos?affiliation=owner&per_page=100&sort=pushed&direction=desc'
    : `/users/${USERNAME}/repos?per_page=100&sort=pushed&direction=desc&type=owner`;
  const repos = await gh(path);
  return repos
    .filter(r => !r.archived && !r.fork && r.name !== USERNAME)
    .sort((a, b) => new Date(b.pushed_at || 0).getTime() - new Date(a.pushed_at || 0).getTime())
    .slice(0, 30);
}

function daysSince(date) {
  return Math.max(0, (Date.now() - new Date(date).getTime()) / 86400000);
}

function weightFor(repo, lastCommitDate) {
  const d = daysSince(lastCommitDate || repo.pushed_at || repo.updated_at);
  if (d <= 14) return 3;
  if (d <= 60) return 2;
  return 1;
}

function add(set, name) {
  if (techMeta[name]) set.add(name);
}

function detectFromPath(path, set) {
  const p = path.toLowerCase();
  if (p.endsWith('.ts') || p.endsWith('.tsx')) add(set, 'TypeScript');
  if (p.endsWith('.js') || p.endsWith('.jsx') || p.endsWith('.mjs') || p.endsWith('.cjs')) add(set, 'JavaScript');
  if (p.endsWith('.py')) add(set, 'Python');
  if (p.endsWith('.java')) add(set, 'Java');
  if (p.endsWith('.php')) add(set, 'PHP');
  if (p.endsWith('.dart')) add(set, 'Dart');
  if (p.endsWith('.cs')) add(set, 'CSharp');
  if (p.endsWith('.html')) add(set, 'HTML');
  if (p.endsWith('.css') || p.endsWith('.scss')) add(set, 'CSS');
  if (p.endsWith('.sh')) add(set, 'Shell');
  if (p.endsWith('.tf')) add(set, 'Terraform');
  if (p.includes('.github/workflows/')) add(set, 'GitHub Actions');
  if (/(^|\/)dockerfile$/i.test(path) || p.includes('docker-compose') || p.endsWith('compose.yml') || p.endsWith('compose.yaml')) add(set, 'Docker');
  if (p.includes('k8s') || p.includes('kubernetes')) add(set, 'Kubernetes');
}

function detectPackageJson(text, set) {
  try {
    const pkg = JSON.parse(text);
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const has = k => Object.prototype.hasOwnProperty.call(deps, k);
    if (has('typescript')) add(set, 'TypeScript');
    if (has('react')) add(set, 'React');
    if (has('next')) add(set, 'Next.js');
    if (has('express')) add(set, 'Express');
    if (has('vite')) add(set, 'Vite');
    if (has('@supabase/supabase-js')) add(set, 'Supabase');
    if (has('@prisma/client') || has('prisma')) add(set, 'Prisma');
    if (has('firebase') || has('@capacitor-firebase/authentication')) add(set, 'Firebase');
    if (has('tailwindcss') || has('@tailwindcss/postcss')) add(set, 'Tailwind');
    if (has('react-native')) add(set, 'React');
    add(set, 'Node.js');
    add(set, 'JavaScript');
  } catch {}
}

function detectTextManifest(path, text, set) {
  const p = path.toLowerCase();
  const t = text.toLowerCase();
  if (p.endsWith('requirements.txt') || p.endsWith('pyproject.toml')) {
    add(set, 'Python');
    if (t.includes('fastapi')) add(set, 'FastAPI');
  }
  if (p.endsWith('pom.xml') || p.endsWith('build.gradle') || p.endsWith('build.gradle.kts')) {
    add(set, 'Java');
    if (t.includes('spring')) add(set, 'Spring');
  }
  if (p.endsWith('pubspec.yaml')) {
    add(set, 'Dart');
    if (t.includes('flutter:')) add(set, 'Flutter');
  }
  if (p.includes('docker-compose') || /(^|\/)dockerfile$/i.test(path)) add(set, 'Docker');
}

async function blobText(repo, sha) {
  try {
    const blob = await gh(`/repos/${repo.full_name}/git/blobs/${sha}`);
    if (blob.encoding !== 'base64' || !blob.content) return '';
    return Buffer.from(blob.content.replace(/\n/g, ''), 'base64').toString('utf8');
  } catch { return ''; }
}

async function getLatestCommit(repo) {
  try {
    const commits = await gh(`/repos/${repo.full_name}/commits?per_page=1`);
    if (Array.isArray(commits) && commits.length > 0) {
      const c = commits[0];
      const rawMsg = c.commit?.message || '';
      const firstLine = rawMsg.split('\n')[0].trim();
      const date = c.commit?.committer?.date || c.commit?.author?.date || repo.pushed_at;
      return {
        sha: c.sha ? c.sha.slice(0, 7) : '',
        message: firstLine || 'Commit recente',
        date: date,
        url: c.html_url || `${repo.html_url}/commit/${c.sha}`,
      };
    }
  } catch {}
  return {
    sha: '',
    message: 'Último push sincronizado',
    date: repo.pushed_at || repo.updated_at,
    url: `${repo.html_url}/commits`,
  };
}

function sortTechsByPriority(techs) {
  return [...techs].sort((a, b) => {
    const idxA = techPriority.indexOf(a);
    const idxB = techPriority.indexOf(b);
    const prioA = idxA === -1 ? 999 : idxA;
    const prioB = idxB === -1 ? 999 : idxB;
    return prioA - prioB;
  });
}

async function analyzeRepo(repo) {
  const techs = new Set();
  try {
    const langs = await gh(`/repos/${repo.full_name}/languages`);
    for (const lang of Object.keys(langs)) {
      if (lang === 'C#') add(techs, 'CSharp'); else add(techs, lang);
    }
  } catch {}

  try {
    const branch = repo.default_branch || 'main';
    const tree = await gh(`/repos/${repo.full_name}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    const files = (tree.tree || []).filter(x => x.type === 'blob');
    for (const f of files) detectFromPath(f.path, techs);

    const manifests = files.filter(f => {
      const n = f.path.toLowerCase();
      return n.endsWith('package.json') || n.endsWith('requirements.txt') || n.endsWith('pyproject.toml') ||
        n.endsWith('pom.xml') || n.endsWith('build.gradle') || n.endsWith('build.gradle.kts') ||
        n.endsWith('pubspec.yaml') || /(^|\/)dockerfile$/i.test(f.path) || n.includes('docker-compose');
    }).slice(0, 10);

    for (const m of manifests) {
      const text = await blobText(repo, m.sha);
      if (m.path.toLowerCase().endsWith('package.json')) detectPackageJson(text, techs);
      detectTextManifest(m.path, text, techs);
    }
  } catch {}

  const lastCommit = await getLatestCommit(repo);

  return {
    name: repo.name,
    url: repo.html_url,
    description: repo.description || '',
    private: repo.private,
    pushedAt: repo.pushed_at,
    updatedAt: repo.updated_at,
    stars: repo.stargazers_count || 0,
    techs: sortTechsByPriority(techs),
    lastCommit,
    weight: weightFor(repo, lastCommit.date),
  };
}

function aggregate(projects) {
  const scores = new Map();
  const counts = new Map();
  for (const p of projects) {
    for (const tech of p.techs) {
      scores.set(tech, (scores.get(tech) || 0) + p.weight);
      counts.set(tech, (counts.get(tech) || 0) + 1);
    }
  }
  return [...scores.entries()]
    .map(([name, score]) => ({ name, score, projects: counts.get(name) }))
    .sort((a, b) => b.score - a.score || b.projects - a.projects || a.name.localeCompare(b.name));
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function truncate(str = '', max = 40) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function getStatusBadge(dateStr) {
  const d = daysSince(dateStr);
  if (d <= 30) return { label: 'Ativo', color: '#10b981', dot: '🟢' };
  if (d <= 90) return { label: 'Recente', color: '#38bdf8', dot: '⚡' };
  return { label: 'Estável', color: '#94a3b8', dot: '📦' };
}

function markdownBadge(name) {
  const meta = techMeta[name];
  if (!meta) {
    return `<img src="https://img.shields.io/badge/${encodeURIComponent(name)}-333333?style=flat-square" alt="${esc(name)}"/>`;
  }
  return `<img src="https://img.shields.io/badge/${encodeURIComponent(meta.label)}-${meta.badgeBg}?style=flat-square&logo=${meta.logo}&logoColor=${meta.logoColor}" alt="${esc(name)}"/>`;
}

function renderSvg(stats) {
  const width = 960;
  const height = 540;
  const topTech = stats.tech.slice(0, 6);
  const maxScore = Math.max(1, ...topTech.map(x => x.score));
  const recentProjects = stats.projects.slice(0, 4);

  // Render project cards
  const projectCards = recentProjects.map((p, i) => {
    const y = 118 + i * 92;
    const status = getStatusBadge(p.lastCommit.date);
    const dateFormatted = formatDateBR(p.lastCommit.date);
    const commitMsg = truncate(p.lastCommit.message, 52);
    const sha = p.lastCommit.sha || 'HEAD';

    // Tech chips for this project (up to 4)
    let chipX = 75;
    const chipsSvg = p.techs.slice(0, 4).map(tname => {
      const meta = techMeta[tname] || { color: '94a3b8', label: tname };
      const label = meta.label || tname;
      const chipW = Math.max(36, label.length * 6.8 + 14);
      const curX = chipX;
      chipX += chipW + 6;
      return `<rect x="${curX}" y="${y + 57}" width="${chipW}" height="18" rx="4" fill="#141824" stroke="#${meta.color}" stroke-opacity="0.5" stroke-width="1"/><text x="${curX + chipW / 2}" y="${y + 70}" fill="#${meta.color}" font-size="10" font-family="ui-monospace, monospace" font-weight="600" text-anchor="middle">${esc(label)}</text>`;
    }).join('');

    return `
    <!-- Card ${i}: ${esc(p.name)} -->
    <rect x="45" y="${y}" width="550" height="82" rx="10" fill="url(#cardGrad)" stroke="#1e2436" stroke-width="1"/>
    <circle cx="62" cy="${y + 24}" r="4" fill="${status.color}"/>
    <text x="75" y="${y + 28}" fill="#f8fafc" font-size="14" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${esc(p.name)}</text>
    <rect x="382" y="${y + 14}" width="58" height="20" rx="4" fill="#182033" stroke="#25324d" stroke-width="0.8"/>
    <text x="411" y="${y + 28}" fill="#38bdf8" font-size="10" font-family="ui-monospace, monospace" text-anchor="middle">${esc(sha)}</text>
    <text x="575" y="${y + 27}" fill="#64748b" font-size="11" font-family="ui-monospace, monospace" text-anchor="end">${esc(dateFormatted)}</text>
    <text x="75" y="${y + 48}" fill="#94a3b8" font-size="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">💬 ${esc(commitMsg)}</text>
    ${chipsSvg}`;
  }).join('');

  // Render tech bars
  const techBars = topTech.map((t, i) => {
    const y = 118 + i * 40;
    const meta = techMeta[t.name] || { color: '38bdf8' };
    const barWidth = Math.max(10, Math.round((t.score / maxScore) * 295));
    return `
    <text x="625" y="${y + 15}" fill="#e2e8f0" font-size="12" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${esc(t.name)}</text>
    <text x="920" y="${y + 15}" fill="#64748b" font-size="11" font-family="ui-monospace, monospace" text-anchor="end">${t.projects} repos</text>
    <rect x="625" y="${y + 23}" width="295" height="7" rx="3.5" fill="#171c2b"/>
    <rect x="625" y="${y + 23}" width="${barWidth}" height="7" rx="3.5" fill="#${meta.color}"/>`;
  }).join('');

  const formattedDateUTC = stats.generatedAt.slice(0, 16).replace('T', ' ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0c12"/>
      <stop offset="100%" stop-color="#121622"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#141824"/>
      <stop offset="100%" stop-color="#0f121d"/>
    </linearGradient>
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
  </defs>

  <!-- Canvas Background -->
  <rect width="${width}" height="${height}" rx="20" fill="url(#bgGrad)" stroke="#1e2436" stroke-width="1.5"/>
  <rect x="2" y="2" width="${width - 4}" height="3" rx="1.5" fill="url(#brandGrad)"/>

  <!-- Top Header -->
  <circle cx="50" cy="46" r="5" fill="#10b981"/>
  <circle cx="50" cy="46" r="9" fill="#10b981" fill-opacity="0.2"/>
  <text x="68" y="44" fill="#ffffff" font-size="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" letter-spacing="0.5">JOTAGGE // DEV ACTIVITY &amp; REPOSITORIES</text>
  <text x="68" y="62" fill="#64748b" font-size="11" font-family="ui-monospace, monospace" letter-spacing="0.4">ÚLTIMOS PROJETOS COMMITADOS E STACK DETECTADA</text>

  <!-- Top Metric Badges -->
  <rect x="635" y="34" width="85" height="26" rx="13" fill="#141926" stroke="#252d42" stroke-width="1"/>
  <text x="677" y="51" fill="#94a3b8" font-size="11" font-family="ui-monospace, monospace" text-anchor="middle">⚡ ${stats.repoCount} Repos</text>

  <rect x="730" y="34" width="92" height="26" rx="13" fill="#141926" stroke="#252d42" stroke-width="1"/>
  <text x="776" y="51" fill="#94a3b8" font-size="11" font-family="ui-monospace, monospace" text-anchor="middle">🔥 ${stats.activeCount} Ativos</text>

  <rect x="832" y="34" width="88" height="26" rx="13" fill="#141926" stroke="#252d42" stroke-width="1"/>
  <text x="876" y="51" fill="#94a3b8" font-size="11" font-family="ui-monospace, monospace" text-anchor="middle">📦 ${stats.tech.length} Techs</text>

  <!-- Section Column Headers -->
  <text x="45" y="103" fill="#94a3b8" font-size="11" font-family="ui-monospace, monospace" font-weight="700" letter-spacing="1">📌 PROJETOS RECENTES COMMITADOS</text>
  <text x="625" y="103" fill="#94a3b8" font-size="11" font-family="ui-monospace, monospace" font-weight="700" letter-spacing="1">📊 STACK EM DESTAQUE</text>

  <!-- Left Column: Project Cards -->
  ${projectCards}

  <!-- Right Column: Tech Radar -->
  ${techBars}

  <!-- Right Column: Engineering Focus Box -->
  <rect x="625" y="380" width="295" height="106" rx="10" fill="url(#cardGrad)" stroke="#1e2436" stroke-width="1"/>
  <text x="642" y="405" fill="#38bdf8" font-size="11" font-family="ui-monospace, monospace" font-weight="700" letter-spacing="0.8">⚡ ENGENHARIA &amp; STACK</text>
  <text x="642" y="427" fill="#f1f5f9" font-size="12" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Arquitetura Fullstack &amp; Sistemas</text>
  <text x="642" y="447" fill="#94a3b8" font-size="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">TypeScript · React · Next.js · Node.js</text>
  <text x="642" y="469" fill="#10b981" font-size="11" font-family="ui-monospace, monospace">● Repositórios sincronizados</text>

  <!-- Footer -->
  <text x="45" y="516" fill="#475569" font-size="10" font-family="ui-monospace, monospace">Auto-atualizado via GitHub Actions · Última varredura: ${formattedDateUTC} UTC</text>
  <text x="920" y="516" fill="#475569" font-size="10" font-family="ui-monospace, monospace" text-anchor="end">github.com/JOTAGGE</text>
</svg>`;
}

function renderDashboard(stats) {
  const topBadges = stats.tech.slice(0, 10).map(t => markdownBadge(t.name)).join(' ');

  const projectRows = stats.projects.slice(0, 10).map(p => {
    const status = getStatusBadge(p.lastCommit.date);
    const privacy = p.private ? ' `🔒 Privado`' : '';
    const desc = p.description ? `<br/><sub>${esc(p.description)}</sub>` : '';
    const dateFormatted = formatDateBR(p.lastCommit.date);
    const commitMsg = p.lastCommit.message ? `<br/>💬 *${esc(truncate(p.lastCommit.message, 50))}*` : '';
    const shaLink = p.lastCommit.sha ? `[\`${p.lastCommit.sha}\`](${p.lastCommit.url}) · ` : '';
    const techBadges = p.techs.slice(0, 5).map(t => markdownBadge(t)).join(' ') || '<sub>Varredura pendente</sub>';

    return `| [**${p.name}**](${p.url})${privacy}${desc} | ${shaLink}**${dateFormatted}**${commitMsg} | ${techBadges} | ${status.dot} ${status.label} |`;
  }).join('\n');

  const techRows = stats.tech.map((t, i) =>
    `| ${i + 1} | **${t.name}** | ${t.projects} | ${t.score} |`
  ).join('\n');

  return `<!-- DASHBOARD:START -->
<p align="center">
  <img src="./assets/dashboard.svg" alt="Dashboard de Projetos e Tecnologias Recentes - JOTAGGE" width="100%" />
</p>

### 🚀 Últimos Projetos Commitados & Stack

| Repositório | Último Commit | Tecnologias Detectadas | Status |
| :--- | :--- | :--- | :---: |
${projectRows || '| — | — | — | — |'}

### ⚡ Tecnologias em Frequência Ativa

<p>
  ${topBadges}
</p>

> ℹ️ *Esta stack e histórico de projetos são **calculados dinamicamente** a partir dos repositórios, analisando código-fonte, manifestos (\`package.json\`, etc.) e os commits mais recentes.*

<details>
<summary><strong>📊 Telemetria detalhada de tecnologias</strong> (expandir ranking completo)</summary>

| # | Tecnologia | Repositórios | Pontuação Ponderada |
|---:|---|---:|---:|
${techRows || '| — | Nenhuma tecnologia detectada | — | — |'}

*A pontuação é ponderada por recência: projetos com commits nos últimos 14 dias possuem peso 3, até 60 dias possuem peso 2, e projetos mais antigos possuem peso 1.*
</details>

<details>
<summary><strong>⚙️ Como funciona este dashboard automatizado</strong></summary>

Um fluxo do GitHub Actions executa diariamente e a cada push, inspecionando os repositórios (incluindo privados quando o segredo <code>PROFILE_DASHBOARD_TOKEN</code> está configurado), analisando linguagens, manifestos de dependência e os últimos commits efetuados.

A partir desses dados, o script Node.js gera o SVG visual de telemetria, atualiza o arquivo de dados <code>data/dashboard.json</code> e reconstrói este bloco no <code>README.md</code> de forma 100% autônoma.
</details>
<!-- DASHBOARD:END -->`;
}

async function main() {
  console.log(`Authenticating as ${USERNAME}... Token present: ${HAS_TOKEN}`);
  const repos = await listRepos();
  console.log(`Fetched ${repos.length} candidates, analyzing commits and manifests...`);

  const projects = [];
  for (const repo of repos) {
    process.stdout.write(`Analyzing ${repo.name}... `);
    const analysis = await analyzeRepo(repo);
    console.log(`done (last commit: ${analysis.lastCommit.date?.slice(0, 10) || 'unknown'})`);
    projects.push(analysis);
  }

  // Sort projects strictly by latest commit date descending
  projects.sort((a, b) => {
    const dateA = new Date(a.lastCommit?.date || a.pushedAt || 0).getTime();
    const dateB = new Date(b.lastCommit?.date || b.pushedAt || 0).getTime();
    return dateB - dateA;
  });

  const tech = aggregate(projects);
  const stats = {
    username: USERNAME,
    generatedAt: new Date().toISOString(),
    visibility: HAS_TOKEN ? 'public+private' : 'public',
    repoCount: projects.length,
    activeCount: projects.filter(p => daysSince(p.lastCommit?.date || p.pushedAt) <= 60).length,
    tech,
    projects,
  };

  await fs.mkdir('assets', { recursive: true });
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile('assets/dashboard.svg', renderSvg(stats));
  await fs.writeFile('data/dashboard.json', JSON.stringify(stats, null, 2) + '\n');

  const readme = await fs.readFile('README.md', 'utf8');
  const block = renderDashboard(stats);
  const next = /<!-- DASHBOARD:START -->[\s\S]*?<!-- DASHBOARD:END -->/.test(readme)
    ? readme.replace(/<!-- DASHBOARD:START -->[\s\S]*?<!-- DASHBOARD:END -->/, block)
    : `${readme.trim()}\n\n${block}\n`;
  await fs.writeFile('README.md', next);
  console.log('Dashboard successfully updated with real committed projects!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
