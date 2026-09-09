import fs from 'node:fs/promises';

const USERNAME = process.env.PROFILE_USERNAME || 'JOTAGGE';
const TOKEN = process.env.PROFILE_DASHBOARD_TOKEN || process.env.GITHUB_TOKEN || '';
const HAS_PRIVATE_TOKEN = Boolean(process.env.PROFILE_DASHBOARD_TOKEN);
const API = 'https://api.github.com';

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': `${USERNAME}-profile-dashboard`,
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  'X-GitHub-Api-Version': '2022-11-28',
};

const techMeta = {
  TypeScript: ['3178c6', 'TS'], JavaScript: ['f7df1e', 'JS'], React: ['61dafb', 'React'],
  'Next.js': ['ffffff', 'Next.js'], 'Node.js': ['5fa04e', 'Node'], Express: ['ffffff', 'Express'],
  Vite: ['646cff', 'Vite'], PostgreSQL: ['4169e1', 'Postgres'], Supabase: ['3ecf8e', 'Supabase'],
  Prisma: ['2d3748', 'Prisma'], Firebase: ['ffca28', 'Firebase'], Docker: ['2496ed', 'Docker'],
  Kubernetes: ['326ce5', 'K8s'], Python: ['3776ab', 'Python'], FastAPI: ['009688', 'FastAPI'],
  Java: ['ed8b00', 'Java'], Spring: ['6db33f', 'Spring'], PHP: ['777bb4', 'PHP'],
  Flutter: ['02569b', 'Flutter'], Dart: ['0175c2', 'Dart'], Tailwind: ['06b6d4', 'Tailwind'],
  'GitHub Actions': ['2088ff', 'Actions'], Terraform: ['844fba', 'Terraform'], HTML: ['e34f26', 'HTML'],
  CSS: ['1572b6', 'CSS'], CSharp: ['512bd4', 'C#'], Shell: ['89e051', 'Shell']
};

async function gh(path) {
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${path}`);
  return res.json();
}

async function listRepos() {
  const path = HAS_PRIVATE_TOKEN
    ? '/user/repos?affiliation=owner&per_page=100&sort=pushed&direction=desc'
    : `/users/${USERNAME}/repos?per_page=100&sort=pushed&direction=desc&type=owner`;
  const repos = await gh(path);
  return repos.filter(r => !r.archived && !r.fork && r.name !== USERNAME).slice(0, 40);
}

function daysSince(date) {
  return Math.max(0, (Date.now() - new Date(date).getTime()) / 86400000);
}

function weightFor(repo) {
  const d = daysSince(repo.pushed_at || repo.updated_at);
  if (d <= 14) return 3;
  if (d <= 60) return 2;
  return 1;
}

function add(set, name) { if (techMeta[name]) set.add(name); }

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
    if (has('firebase')) add(set, 'Firebase');
    if (has('tailwindcss')) add(set, 'Tailwind');
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

async function analyzeRepo(repo) {
  const techs = new Set();
  try {
    const langs = await gh(`/repos/${repo.full_name}/languages`);
    for (const lang of Object.keys(langs)) {
      if (lang === 'C#') add(techs, 'CSharp'); else add(techs, lang);
    }
  } catch {}

  try {
    const tree = await gh(`/repos/${repo.full_name}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`);
    const files = (tree.tree || []).filter(x => x.type === 'blob');
    for (const f of files) detectFromPath(f.path, techs);

    const manifests = files.filter(f => {
      const n = f.path.toLowerCase();
      return n.endsWith('package.json') || n.endsWith('requirements.txt') || n.endsWith('pyproject.toml') ||
        n.endsWith('pom.xml') || n.endsWith('build.gradle') || n.endsWith('build.gradle.kts') ||
        n.endsWith('pubspec.yaml') || /(^|\/)dockerfile$/i.test(f.path) || n.includes('docker-compose');
    }).slice(0, 12);

    for (const m of manifests) {
      const text = await blobText(repo, m.sha);
      if (m.path.toLowerCase().endsWith('package.json')) detectPackageJson(text, techs);
      detectTextManifest(m.path, text, techs);
    }
  } catch {}

  return {
    name: repo.name,
    url: repo.html_url,
    description: repo.description || '',
    private: repo.private,
    pushedAt: repo.pushed_at,
    updatedAt: repo.updated_at,
    stars: repo.stargazers_count || 0,
    techs: [...techs],
    weight: weightFor(repo),
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

function esc(s='') { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])); }

function badge(name) {
  const [color, label] = techMeta[name] || ['555555', name];
  return `<img src="https://img.shields.io/badge/${encodeURIComponent(label)}-${color}?style=for-the-badge&logoColor=white" alt="${esc(name)}"/>`;
}

function renderSvg(stats) {
  const width = 900, height = 430;
  const top = stats.tech.slice(0, 8);
  const max = Math.max(1, ...top.map(x => x.score));
  const bars = top.map((t, i) => {
    const y = 155 + i * 30;
    const w = Math.max(8, Math.round((t.score / max) * 420));
    return `<text x="46" y="${y}" fill="#d7d7d7" font-size="14">${esc(t.name)}</text><rect x="190" y="${y-13}" width="${w}" height="14" rx="7" fill="#f0f0f0"/><text x="${205+w}" y="${y}" fill="#9b9b9b" font-size="12">${t.projects} repo${t.projects===1?'':'s'}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" rx="24" fill="#0b0b0c"/>
  <rect x="18" y="18" width="864" height="394" rx="18" fill="none" stroke="#2a2a2d"/>
  <text x="46" y="58" fill="#ffffff" font-size="22" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-weight="700">JOTAGGE / LIVE SYSTEM</text>
  <text x="46" y="88" fill="#8d8d92" font-size="13" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">AUTO-GENERATED FROM REPOSITORY SIGNALS</text>
  <text x="46" y="125" fill="#ffffff" font-size="16" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">TECH USAGE</text>
  ${bars}
  <text x="675" y="148" fill="#8d8d92" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">REPOSITORIES</text>
  <text x="675" y="183" fill="#ffffff" font-size="30" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${stats.repoCount}</text>
  <text x="675" y="232" fill="#8d8d92" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">ACTIVE ≤ 60D</text>
  <text x="675" y="267" fill="#ffffff" font-size="30" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${stats.activeCount}</text>
  <text x="675" y="316" fill="#8d8d92" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">TECH SIGNALS</text>
  <text x="675" y="351" fill="#ffffff" font-size="30" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${stats.tech.length}</text>
  <text x="46" y="392" fill="#68686d" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">updated ${esc(stats.generatedAt.slice(0,16).replace('T',' '))} UTC · recency-weighted</text>
</svg>`;
}

function renderDashboard(stats) {
  const topBadges = stats.tech.slice(0, 12).map(t => badge(t.name)).join(' ');
  const projects = stats.projects.slice(0, 8).map(p => {
    const privacy = p.private ? ' · private' : '';
    const stack = p.techs.slice(0, 5).join(' · ') || 'technology scan pending';
    return `| [**${p.name}**](${p.url}) | ${stack} | ${new Date(p.pushedAt).toISOString().slice(0,10)}${privacy} |`;
  }).join('\n');
  const techRows = stats.tech.slice(0, 20).map((t, i) => `| ${i+1} | **${t.name}** | ${t.projects} | ${t.score} |`).join('\n');

  return `<!-- DASHBOARD:START -->
<p align="center">
  <img src="./assets/dashboard.svg" alt="Live GitHub technology dashboard" width="100%" />
</p>

### Current technology signal

<p>${topBadges}</p>

> This stack is **computed from repository contents**, not maintained by hand. Recent repositories receive more weight than old ones.

### Recently active projects

| Project | Detected stack | Last push |
|---|---|---|
${projects || '| — | — | — |'}

<details>
<summary><strong>Technology telemetry</strong> — expand live ranking</summary>

| # | Technology | Repositories | Signal score |
|---:|---|---:|---:|
${techRows || '| — | No technologies detected yet | — | — |'}

Signal score is recency-weighted: projects updated in the last 14 days count more heavily than older repositories.
</details>

<details>
<summary><strong>How this dashboard works</strong></summary>

A GitHub Action scans my owned repositories, inspects language data plus project manifests such as <code>package.json</code>, <code>pyproject.toml</code>, <code>requirements.txt</code>, <code>pom.xml</code>, <code>pubspec.yaml</code>, Docker files and infrastructure files, then regenerates this section, the SVG dashboard and <code>data/dashboard.json</code> automatically.

Private repositories are included only when the optional <code>PROFILE_DASHBOARD_TOKEN</code> repository secret is configured with read access to them. Without it, the dashboard safely analyzes public repositories only.
</details>
<!-- DASHBOARD:END -->`;
}

async function main() {
  const repos = await listRepos();
  const projects = [];
  for (const repo of repos) {
    console.log(`Analyzing ${repo.full_name}`);
    projects.push(await analyzeRepo(repo));
  }
  const tech = aggregate(projects);
  const stats = {
    username: USERNAME,
    generatedAt: new Date().toISOString(),
    visibility: HAS_PRIVATE_TOKEN ? 'public+private' : 'public',
    repoCount: projects.length,
    activeCount: projects.filter(p => daysSince(p.pushedAt) <= 60).length,
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
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
