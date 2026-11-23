/* 三国·逐鹿天下 V0.8 — 立体六边形战棋引擎与界面 */

const W = 13, H = 9, HEX = 30;
const $ = id => document.getElementById(id);
const k = (c, r) => `${c},${r}`;
const sleep = ms => new Promise(res => setTimeout(res, ms));

function inBounds(c, r) { return c >= 0 && c < W && r >= 0 && r < H; }
function axial(c, r) { return { q: c - ((r - (r & 1)) / 2), r }; }
function fromAxial(q, r) { return { col: q + ((r - (r & 1)) / 2), row: r }; }
function hexDist(a, b) {
  const A = axial(a.col, a.row), B = axial(b.col, b.row);
  const dq = A.q - B.q, dr = A.r - B.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}
function neighbors(c, r) {
  const dirs = (r % 2 === 0)
    ? [[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]]
    : [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]];
  return dirs.map(([dc, dr]) => ({ col: c + dc, row: r + dr })).filter(p => inBounds(p.col, p.row));
}
function pos(c, r) {
  const s3 = Math.sqrt(3);
  return { x: HEX * s3 * (c + 0.5 * (r & 1)) + HEX * s3 / 2 + 18, y: HEX * 1.5 * r + HEX + 18 };
}
function hexPoints(cx, cy) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 180 * (60 * i - 90);
    return `${(cx + HEX * Math.cos(a)).toFixed(1)},${(cy + HEX * Math.sin(a) * 1.02).toFixed(1)}`;
  }).join(' ');
}

/* ---------- 写实地形细节（参考三国志11 / VAN 地图风格） ---------- */
// 确定性伪随机：同一格子每次渲染细节一致
function rnd(c, r, s) {
  const x = Math.sin(c * 127.1 + r * 311.7 + s * 74.7) * 43758.5453;
  return x - Math.floor(x);
}
const f = n => Number(n).toFixed(1);

// 树丛：树干 + 三层树冠
function drawTree(x, y, s, light) {
  const a = light ? '#7fae63' : '#4e7c49';
  const b = light ? '#9ac476' : '#609155';
  return `<ellipse cx="${f(x)}" cy="${f(y + 1)}" rx="${f(3 * s)}" ry="${f(1.2 * s)}" fill="rgba(28,48,24,.18)"/>` +
    `<rect x="${f(x - 0.9 * s)}" y="${f(y)}" width="${f(1.8 * s)}" height="${f(5 * s)}" fill="#6b5236"/>` +
    `<circle cx="${f(x)}" cy="${f(y - 3 * s)}" r="${f(4.2 * s)}" fill="${a}"/>` +
    `<circle cx="${f(x - 2 * s)}" cy="${f(y - 1 * s)}" r="${f(3.1 * s)}" fill="${b}"/>` +
    `<circle cx="${f(x + 2 * s)}" cy="${f(y - 1 * s)}" r="${f(3.1 * s)}" fill="${a}"/>`;
}

// 山峰：受光面 + 阴影面 + 雪顶 + 山脚植被
function drawMountain(x, y, w, h) {
  const lx = x - w / 2, rx = x + w / 2;
  return `<ellipse cx="${f(x)}" cy="${f(y + 1)}" rx="${f(w * .62)}" ry="${f(h * .13)}" fill="rgba(40,42,36,.22)"/>` +
    `<path d="M ${f(lx)} ${f(y)} L ${f(x)} ${f(y - h)} L ${f(x)} ${f(y)} Z" fill="#c8c9ba"/>` +
    `<path d="M ${f(x)} ${f(y - h)} L ${f(rx)} ${f(y)} L ${f(x)} ${f(y)} Z" fill="#8b9082"/>` +
    `<path d="M ${f(x - .3 * w)} ${f(y - .7 * h)} L ${f(x)} ${f(y - h)} L ${f(x + .3 * w)} ${f(y - .7 * h)} L ${f(x)} ${f(y - .8 * h)} Z" fill="#ecebe0"/>` +
    `<ellipse cx="${f(x - w * .28)}" cy="${f(y - h * .18)}" rx="${f(w * .2)}" ry="${f(h * .13)}" fill="#6f9460" opacity=".65"/>`;
}

// 水波：柔和的白色浪纹
function drawWave(x, y, w, ph) {
  return `<path d="M ${f(x - w / 2)} ${f(y)} q ${f(w / 4)} ${f(-1.6 + ph)} ${f(w / 2)} 0 q ${f(w / 4)} ${f(1.6 - ph)} ${f(w / 2)} 0" ` +
    `fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.4" stroke-linecap="round"/>`;
}

// 方形城墙城池：城墙 + 垛口 + 城门 + 角楼 + 内部院落
function drawCityWall(cx, cy) {
  const s = 14;
  let g = `<ellipse cx="${f(cx)}" cy="${f(cy + 11)}" rx="${f(s + 3)}" ry="4" fill="rgba(40,30,15,.22)"/>`;
  g += `<rect x="${f(cx - s)}" y="${f(cy - 9)}" width="${f(2 * s)}" height="19" fill="#9a7d5b" stroke="#5e4630" stroke-width="1.2"/>`;
  for (let i = -2; i <= 2; i++) g += `<rect x="${f(cx + i * 5.2 - 2)}" y="${f(cy - 11.5)}" width="4" height="3.5" fill="#7d6247"/>`;
  g += `<path d="M ${f(cx - 3.5)} ${f(cy + 10)} L ${f(cx - 3.5)} ${f(cy + 3)} Q ${f(cx)} ${f(cy - 1)} ${f(cx + 3.5)} ${f(cy + 3)} L ${f(cx + 3.5)} ${f(cy + 10)} Z" fill="#503825"/>`;
  g += `<rect x="${f(cx - s - 1)}" y="${f(cy - 13)}" width="6" height="6" fill="#85694b" stroke="#5e4630" stroke-width=".8"/>`;
  g += `<rect x="${f(cx + s - 5)}" y="${f(cy - 13)}" width="6" height="6" fill="#85694b" stroke="#5e4630" stroke-width=".8"/>`;
  g += `<rect x="${f(cx - 7)}" y="${f(cy - 4)}" width="14" height="9" fill="#b79a72" opacity=".85"/>`;
  g += `<rect x="${f(cx - 2)}" y="${f(cy - 2)}" width="4" height="5" fill="#8a6a45"/>`;
  return g;
}

// 单个六边形的地形细节
function terrainDetail(t, c, r, p) {
  const x = p.x, y = p.y;
  let s = '';
  if (t === 'P') {
    for (let i = 0; i < 3; i++) {
      const gx = x + (rnd(c, r, 10 + i) - .5) * 30, gy = y + (rnd(c, r, 20 + i) - .5) * 26;
      s += `<ellipse cx="${f(gx)}" cy="${f(gy)}" rx="${f(5 + rnd(c, r, 30 + i) * 5)}" ry="3" fill="rgba(120,150,80,.2)"/>`;
    }
    for (let i = 0; i < 4; i++) {
      const gx = x + (rnd(c, r, 40 + i) - .5) * 32, gy = y + (rnd(c, r, 50 + i) - .5) * 28;
      s += `<path d="M ${f(gx)} ${f(gy)} l -1.5 -3 M ${f(gx)} ${f(gy)} l 1 -2.5 M ${f(gx)} ${f(gy)} l 2 -2" stroke="rgba(78,120,52,.5)" stroke-width="1" fill="none"/>`;
    }
  } else if (t === 'F') {
    for (let i = 0; i < 5; i++) {
      const gx = x + (rnd(c, r, 10 + i) - .5) * 32, gy = y + 14 - rnd(c, r, 20 + i) * 22;
      s += drawTree(gx, gy, .8 + rnd(c, r, 30 + i) * .5, rnd(c, r, 40 + i) > .5);
    }
  } else if (t === 'M') {
    const n = 2 + Math.floor(rnd(c, r, 1) * 2);
    for (let i = 0; i < n; i++) {
      const mx = x + (rnd(c, r, 10 + i) - .5) * 22, my = y + 13 + (rnd(c, r, 20 + i) - .5) * 6;
      s += drawMountain(mx, my, 20 + rnd(c, r, 30 + i) * 10, 16 + rnd(c, r, 40 + i) * 12);
    }
  } else if (t === 'R') {
    for (let i = 0; i < 3; i++) {
      s += drawWave(x, y - 14 + i * 13 + (rnd(c, r, 10 + i) - .5) * 4, 34, rnd(c, r, 20 + i) * 2);
    }
  } else if (t === 'B') {
    for (let i = 0; i < 2; i++) s += drawWave(x, y - 8 + i * 16, 30, .8);
    for (let i = 0; i < 5; i++) s += `<rect x="${f(x - 14 + i * 6)}" y="${f(y - 6)}" width="5" height="12" rx="1" fill="#a07c4e" stroke="#6b4e2f" stroke-width=".8"/>`;
  } else if (t === 'D') {
    s += `<path d="M ${f(x - 18)} ${f(y + 12)} Q ${f(x)} ${f(y - 6)} ${f(x + 18)} ${f(y + 10)}" fill="none" stroke="#cbb486" stroke-width="7" stroke-linecap="round"/>`;
    s += `<path d="M ${f(x - 18)} ${f(y + 12)} Q ${f(x)} ${f(y - 6)} ${f(x + 18)} ${f(y + 10)}" fill="none" stroke="#8a6f48" stroke-width="1" stroke-dasharray="3 3"/>`;
    s += `<rect x="${f(x - 12)}" y="${f(y + 1)}" width="2" height="7" fill="#6e5232"/><rect x="${f(x + 10)}" y="${f(y + 1)}" width="2" height="7" fill="#6e5232"/>`;
  } else if (t === 'C') {
    s += drawCityWall(x, y);
  }
  return s;
}

// 山地区域的云雾团
function buildMist() {
  let m = '';
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const t = terrain(c, r);
    if ((t === 'M' || t === 'F') && rnd(c, r, 77) > .5) {
      const p = pos(c, r);
      m += `<ellipse cx="${f(p.x + (rnd(c, r, 78) - .5) * 18)}" cy="${f(p.y + (rnd(c, r, 79) - .5) * 16)}" ` +
        `rx="${f(12 + rnd(c, r, 80) * 10)}" ry="${f(5 + rnd(c, r, 81) * 4)}" fill="rgba(255,255,250,.55)" filter="url(#f-mist)"/>`;
    }
  }
  return m;
}

// 城池牌：势力旗 + 城名 + 兵力（万）
function cityLabels() {
  const info = (typeof CITY_INFO !== 'undefined' && CITY_INFO[SCENARIOS[state.scenario].id]) || {};
  let out = '';
  for (const key of Object.keys(info)) {
    const [c, r] = key.split(',').map(Number);
    const d = info[key], p = pos(c, r), x = p.x, y = p.y;
    const occ = unitAt(c, r);
    const side = occ ? occ.side : d.side;
    const flag = side === 'player' ? '#2e7d5b' : '#9d3327';
    const label = `${d.name} ${d.men}万`;
    out += `<g class="city-label">` +
      `<line x1="${f(x)}" y1="${f(y - 12)}" x2="${f(x)}" y2="${f(y - 30)}" stroke="${flag}" stroke-width="1.5"/>` +
      `<path d="M ${f(x)} ${f(y - 30)} l 12 3 l -12 3 Z" fill="${flag}"/>` +
      `<rect x="${f(x - 30)}" y="${f(y - 46)}" width="60" height="15" rx="3" fill="${flag}" stroke="rgba(255,240,215,.5)" stroke-width=".8"/>` +
      `<text x="${f(x)}" y="${f(y - 35.5)}" class="city-name">${label}</text></g>`;
  }
  return out;
}

const state = {
  scenario: 0, map: [], units: [], turn: 1, side: 'player',
  selected: null, reach: new Map(), log: [], over: null, busy: false, uid: 1,
  rankFilter: null
};

/* ---------- 地图与规则 ---------- */
function terrain(c, r) { return inBounds(c, r) ? state.map[r][c] : 'M'; }
function unitAt(c, r) { return state.units.find(u => u.hp > 0 && u.col === c && u.row === r); }
function unitById(id) { return state.units.find(u => u.id === id); }
function troop(u) { return TROOPS[u.type]; }
function isRoadEnd(c, r) {
  return (r >= 7 && c <= 3) || (r <= 1 && c >= 9);
}
function moveCost(u, t, cell) {
  const tr = troop(u);
  let cost = tr.cost[t] === undefined ? 1 : tr.cost[t];
  if (cost >= 99) return 99;
  if (SCENARIOS[state.scenario].singleFile && terrain(u.col, u.row) === 'D' && t !== 'D' && !isRoadEnd(cell.col, cell.row)) return 99;
  return cost;
}
function reachable(u) {
  const dist = new Map([[k(u.col, u.row), 0]]);
  const pq = [{ col: u.col, row: u.row, d: 0 }];
  while (pq.length) {
    pq.sort((a, b) => a.d - b.d);
    const cur = pq.shift();
    if (cur.d !== dist.get(k(cur.col, cur.row))) continue;
    for (const n of neighbors(cur.col, cur.row)) {
      if (unitAt(n.col, n.row)) continue;
      const cost = moveCost(u, terrain(n.col, n.row), n);
      if (cost >= 99) continue;
      const nd = cur.d + cost;
      if (nd > troop(u).move) continue;
      const kk = k(n.col, n.row);
      if (dist.has(kk) && dist.get(kk) <= nd) continue;
      dist.set(kk, nd);
      pq.push({ col: n.col, row: n.row, d: nd });
    }
  }
  dist.delete(k(u.col, u.row));
  return dist;
}
function hasLOS(a, b) {
  const A = axial(a.col, a.row), B = axial(b.col, b.row);
  const n = hexDist(a, b);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = fromAxial(Math.round(A.q + (B.q - A.q) * t), Math.round(A.r + (B.r - A.r) * t));
    if ((p.col === a.col && p.row === a.row) || (p.col === b.col && p.row === b.row)) continue;
    if (terrain(p.col, p.row) === 'M') return false;
  }
  return true;
}
function canAttack(a, d) {
  if (!d || d.hp <= 0 || d.side === a.side) return false;
  const t = troop(a), dist = hexDist(a, d);
  if (dist < t.min || dist > t.max) return false;
  if (!t.ignoreLOS && !hasLOS(a, d)) return false;
  return true;
}
function defBonus(t) { return t === 'C' ? 0.35 : t === 'F' ? 0.12 : t === 'M' ? 0.08 : t === 'D' ? 0.05 : 0; }

// 编制节度：相邻（1 格内）的高级编制对低级部队提供加成，体现“统辖”关系
function commandBonus(u) {
  const myIdx = RANKS[u.rank].idx;
  let best = 0;
  for (const ally of state.units) {
    if (ally.side !== u.side || ally.id === u.id) continue;
    const diff = RANKS[ally.rank].idx - myIdx;
    if (diff > 0 && hexDist(u, ally) <= 1) best = Math.max(best, 0.05 * diff);
  }
  return Math.min(0.2, best);
}
function attackMultiplier(a, d) {
  const at = troop(a), dt = troop(d);
  let m = (at.strong?.[d.type] || 1) / (dt.strong?.[a.type] || 1);
  const here = terrain(a.col, a.row);
  if (here === 'F' && at.forestAtk) m *= at.forestAtk;
  if (here === 'M' && at.mountainAtk) m *= at.mountainAtk;
  if (terrain(d.col, d.row) === 'C' && at.siege) m *= at.siege;
  // 高阶编制的基础战斗系数 + 敌方编制差距 + 相邻上级节度
  m *= RANKS[a.rank].mul;
  m *= Math.max(0.75, Math.min(1.3, 1 + 0.035 * (RANKS[a.rank].idx - RANKS[d.rank].idx)));
  m *= (1 + commandBonus(a));
  return m;
}
function log(text, side) {
  state.log.unshift({ text, side, turn: state.turn });
  if (state.log.length > 60) state.log.pop();
}

/* ---------- 战斗 ---------- */
function resolveAttack(a, d) {
  const at = troop(a);
  const mul = attackMultiplier(a, d);
  const roll = 0.88 + Math.random() * 0.24;
  const raw = at.atk * mul * roll * (0.55 + 0.45 * a.hp / a.maxHp);
  const defense = troop(d).def * (1 + defBonus(terrain(d.col, d.row))) * (1 + commandBonus(d) * 0.5) * 0.5;
  const dmg = Math.max(4, Math.round(raw - defense));
  d.hp = Math.max(0, d.hp - dmg);
  d.men = Math.max(0, Math.ceil(d.maxMen * d.hp / d.maxHp));
  const bonusText = mul > 1.15 ? '（克制／地形／编制加成）' : mul < 0.85 ? '（被克制）' : '';
  log(`${a.name} → ${d.name} 造成 ${dmg} 点伤害${bonusText}`, a.side);
  if (at.splash) {
    const splash = Math.round(dmg * at.splash);
    for (const n of neighbors(d.col, d.row)) {
      const victim = unitAt(n.col, n.row);
      if (victim && victim.side !== a.side && victim.id !== d.id) {
        victim.hp = Math.max(0, victim.hp - splash);
        victim.men = Math.max(0, Math.ceil(victim.maxMen * victim.hp / victim.maxHp));
        log(`溅射波及 ${victim.name}，造成 ${splash} 点伤害`, a.side);
      }
    }
  }
  state.units.filter(u => u.hp <= 0).forEach(u => log(`${RANKS[u.rank].title} ${u.name} 所部溃败`, u.side));
  state.units = state.units.filter(u => u.hp > 0);
  checkEnd();
}
function checkEnd() {
  const p = state.units.some(u => u.side === 'player');
  const e = state.units.some(u => u.side === 'enemy');
  const cap = SCENARIOS[state.scenario].capture;
  if (cap && p && state.units.some(u => u.side === 'player' && u.col === cap.col && u.row === cap.row)) {
    state.over = 'win'; log('我军占据城池，敌军弃守！', 'player');
  } else if (!e && p) { state.over = 'win'; log('敌军全灭，大获全胜！', 'player'); }
  else if (!p && e) { state.over = 'lose'; log('我军全灭，败退。', 'enemy'); }
  else if (!p && !e) { state.over = 'draw'; log('两军皆墨，平局。'); }
  if (state.over) state.selected = null;
}

/* ---------- 场景装载 ---------- */
function loadScenario(i) {
  state.scenario = i;
  const s = SCENARIOS[i];
  state.map = s.map.map(row => row.split(''));
  state.units = [...s.player, ...s.enemy].map((u, idx) => {
    const rank = rankForUnit(u);
    return {
      ...u, rank, id: state.uid++, side: idx < s.player.length ? 'player' : 'enemy',
      maxHp: troop(u).hp, hp: troop(u).hp,
      maxMen: RANKS[rank].men, men: RANKS[rank].men, acted: false
    };
  });
  state.turn = 1; state.side = 'player'; state.selected = null;
  state.reach = new Map(); state.log = []; state.over = null; state.busy = false;
  state.rankFilter = null;
  log(`【${s.name}】${s.intro}`);
  log(`目标：${s.objective}`);
  renderAll();
}

/* ---------- 玩家操作 ---------- */
function selectUnit(u) {
  if (state.side !== 'player' || state.busy || state.over) return;
  if (!u || u.side !== 'player') { state.selected = null; state.reach = new Map(); renderBoard(); renderInfo(); return; }
  if (u.acted) { log(`${u.name} 本回合已行动，可切换其他部队`); return; }
  state.selected = u.id;
  state.reach = reachable(u);
  renderBoard(); renderInfo();
}
function handleHex(col, row) {
  if (state.busy || state.over || state.side !== 'player') return;
  const clicked = unitAt(col, row);
  const sel = unitById(state.selected);
  if (!sel) { if (clicked) selectUnit(clicked); return; }
  if (clicked && clicked.side === 'player') { selectUnit(clicked); return; }
  if (clicked && canAttack(sel, clicked)) {
    resolveAttack(sel, clicked);
    sel.acted = true; sel.moved = true;
    state.selected = null; state.reach = new Map();
    renderAll();
    if (!state.over) maybeAutoEnd();
    return;
  }
  if (state.reach.has(k(col, row))) {
    const t = terrain(col, row);
    sel.col = col; sel.row = row; sel.moved = true;
    log(`${sel.name} 移动至 (${col},${row}) ${TERRAIN[t].label}`, 'player');
    state.reach = reachable(sel);
    renderAll();
    return;
  }
  state.selected = null; state.reach = new Map(); renderBoard(); renderInfo();
}
function maybeAutoEnd() {
  if (state.units.filter(u => u.side === 'player').every(u => u.acted)) setTimeout(() => { if (!state.over && state.side === 'player') endTurn(); }, 500);
}
function endTurn() {
  if (state.over || state.busy || state.side !== 'player') return;
  state.selected = null; state.reach = new Map();
  state.side = 'enemy'; state.busy = true;
  log(`第 ${state.turn} 回合 · 魏军行动`, 'enemy');
  renderAll();
  aiTurn().then(() => { state.busy = false; renderAll(); });
}
async function aiTurn() {
  await sleep(300);
  for (const u of state.units.filter(x => x.side === 'enemy')) {
    if (state.over) break;
    const foes = state.units.filter(x => x.side === 'player');
    if (!foes.length) break;
    let targets = foes.filter(f => canAttack(u, f));
    if (!targets.length) {
      const reach = reachable(u);
      let best = null, bestScore = Infinity;
      for (const [kk] of reach) {
        const [c, r] = kk.split(',').map(Number);
        const here = { col: c, row: r };
        const score = Math.min(...foes.map(f => hexDist(here, f)));
        const t = terrain(c, r);
        const terrainBonus = (troop(u).forestAtk && (t === 'F' || t === 'M')) ? -1.2 : 0;
        if (score + terrainBonus < bestScore) { bestScore = score + terrainBonus; best = here; }
      }
      if (best && (best.col !== u.col || best.row !== u.row)) {
        u.col = best.col; u.row = best.row; u.moved = true;
        log(`${u.name} 移动至 (${best.col},${best.row})`, 'enemy');
      }
      targets = foes.filter(f => canAttack(u, f));
    }
    if (targets.length) {
      targets.sort((a, b) => a.hp - b.hp);
      resolveAttack(u, targets[0]);
    } else {
      log(`${u.name} 原地待机`, 'enemy');
    }
    u.acted = true;
    renderAll();
    await sleep(220);
  }
  if (!state.over) {
    if (state.turn >= 14) { state.over = 'lose'; log('战至第 14 回合，我军未能破敌。'); }
    else {
      state.turn++;
      state.side = 'player';
      state.units.forEach(u => { u.acted = false; u.moved = false; });
      log(`第 ${state.turn} 回合 · 蜀军行动`, 'player');
    }
  }
}

/* ---------- 渲染 ---------- */
function renderBoard() {
  const vbW = HEX * Math.sqrt(3) * (W + 0.5) + 36;
  const vbH = HEX * 1.5 * (H - 1) + HEX * 2 + 46;
  // 三国志11 写实地形配色：翠绿平原 / 深绿密林 / 灰白岩山 / 青灰江水
  const SIDE = { P: '#7c9461', F: '#56734c', M: '#8d8b80', R: '#5c858e', B: '#9a8552', C: '#9a7f63', D: '#8f7c58' };
  const GRAD = {
    P: ['#d3e2ad', '#a7c47a'], F: ['#a7c98a', '#6f9a5f'], M: ['#dcd9cf', '#a3a197'],
    R: ['#bcd6d4', '#7ea7a5'], B: ['#e8d9a8', '#bfa766'], C: ['#e3ccb0', '#b79a7c'], D: ['#ddcba4', '#ab9166']
  };
  let defs = '<defs>';
  for (const [t, cs] of Object.entries(GRAD)) {
    defs += `<linearGradient id="g-${t}" x1="0" y1="0" x2="0.15" y2="1"><stop offset="0" stop-color="${cs[0]}"/><stop offset="1" stop-color="${cs[1]}"/></linearGradient>`;
  }
  defs += '<linearGradient id="g-player" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#6fae89"/><stop offset="0.55" stop-color="#3f6b52"/><stop offset="1" stop-color="#294937"/></linearGradient>';
  defs += '<linearGradient id="g-enemy" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#cd6c55"/><stop offset="0.55" stop-color="#9d3327"/><stop offset="1" stop-color="#692019"/></linearGradient>';
  defs += '<radialGradient id="g-head-player" cx="35%" cy="28%" r="75%"><stop offset="0" stop-color="#d9f0dc"/><stop offset="0.55" stop-color="#5c9674"/><stop offset="1" stop-color="#2c4f3b"/></radialGradient>';
  defs += '<radialGradient id="g-head-enemy" cx="35%" cy="28%" r="75%"><stop offset="0" stop-color="#ffd9c5"/><stop offset="0.55" stop-color="#c65c45"/><stop offset="1" stop-color="#6d211a"/></radialGradient>';
  defs += '<filter id="f-piece" x="-45%" y="-45%" width="190%" height="210%"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#2c1d0d" flood-opacity="0.35"/></filter>';
  defs += '<filter id="f-mist" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>';
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const p = pos(c, r);
    defs += `<clipPath id="clip-${c}-${r}"><polygon points="${hexPoints(p.x, p.y)}"/></clipPath>`;
  }
  defs += '</defs>';

  let terrainSvg = '', detailSvg = '', overlaySvg = '', unitSvg = '';
  const sel = unitById(state.selected);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const t = terrain(c, r), p = pos(c, r);
      const arr = hexPoints(p.x, p.y).split(' ');
      const top = arr.join(' ');
      const side = arr.map(pt => { const [x, y] = pt.split(',').map(Number); return `${x},${(y + 6).toFixed(1)}`; }).join(' ');
      const shine = `${arr[0]} ${arr[1]} ${arr[5]}`;
      const shade = `${arr[2]} ${arr[3]} ${arr[4]}`;
      terrainSvg += `<g class="hex t-${t}" data-c="${c}" data-r="${r}">` +
        `<polygon class="hex-side" points="${side}" fill="${SIDE[t]}"/>` +
        `<polygon class="hex-top" points="${top}" fill="url(#g-${t})"/>` +
        `<polygon class="hex-shine" points="${shine}"/><polygon class="hex-shade" points="${shade}"/>` + `</g>`;
      detailSvg += `<g clip-path="url(#clip-${c}-${r})" class="hex-detail">${terrainDetail(t, c, r, p)}</g>`;
      let cls = '';
      if (sel && sel.col === c && sel.row === r) cls = 'sel';
      else if (sel && state.reach.has(k(c, r))) cls = 'reach';
      else if (sel && unitAt(c, r) && canAttack(sel, unitAt(c, r))) cls = 'attack';
      if (cls) overlaySvg += `<polygon class="ov-${cls}" points="${top}"/>`;
    }
  }
  const mistSvg = buildMist();
  const labelSvg = cityLabels();
  for (const u of state.units) {
    const p = pos(u.col, u.row), tr = troop(u), rk = RANKS[u.rank];
    const isSel = state.selected === u.id;
    const hpPct = Math.round(u.hp / u.maxHp * 100);
    const dim = state.rankFilter && state.rankFilter !== u.rank;
    const focus = state.rankFilter === u.rank;
    const x = p.x, y = p.y;
    const base = `M ${x - 15} ${y + 9} Q ${x} ${y + 17} ${x + 15} ${y + 9} L ${x + 11} ${y + 4} Q ${x} ${y + 11} ${x - 11} ${y + 4} Z`;
    const body = `M ${x - 11} ${y + 4} C ${x - 9} ${y - 4}, ${x - 7} ${y - 10}, ${x - 5} ${y - 12} L ${x + 5} ${y - 12} C ${x + 7} ${y - 10}, ${x + 9} ${y - 4}, ${x + 11} ${y + 4} Q ${x} ${y + 11} ${x - 11} ${y + 4} Z`;
    unitSvg += `<g class="unit ${u.side} ${isSel ? 'is-sel' : ''} ${u.acted ? 'acted' : ''} ${dim ? 'rank-dim' : ''} ${focus ? 'rank-focus' : ''}" data-col="${u.col}" data-row="${u.row}">` +
      (isSel ? `<ellipse class="sel-ring" cx="${x}" cy="${y + 7}" rx="19" ry="9"/>` : '') +
      `<ellipse class="piece-shadow" cx="${x}" cy="${y + 13}" rx="16" ry="5.5"/>` +
      `<path class="piece-base" d="${base}" fill="url(#g-${u.side})"/>` +
      `<path class="piece-body" d="${body}" fill="url(#g-${u.side})" filter="url(#f-piece)"/>` +
      `<circle class="piece-head" cx="${x}" cy="${y - 14}" r="8.5" fill="url(#g-head-${u.side})"/>` +
      `<circle class="piece-glint" cx="${x - 2.7}" cy="${y - 16.7}" r="2.3"/>` +
      `<text class="rank-mark" x="${x}" y="${y - 11.4}">${rk.mark}</text>` +
      `<text class="unit-text ${tr.short.length > 1 ? 'small' : ''}" x="${x}" y="${y + 1}">${tr.short}</text>` +
      `<rect class="hp-bg" x="${x - 15}" y="${y + 20}" width="30" height="4" rx="2"/>` +
      `<rect class="hp-fill" x="${x - 15}" y="${y + 20}" width="${30 * hpPct / 100}" height="4" rx="2"/>` +
      `<title>${u.name} · ${tr.name} · ${rk.name}／${rk.title} · ${u.men}/${u.maxMen}人 · 战力${u.hp}/${u.maxHp}</title></g>`;
  }
  $('board').innerHTML =
    `<svg viewBox="0 0 ${vbW.toFixed(0)} ${vbH.toFixed(0)}" role="img" aria-label="六边形写实作战地图">` +
    defs + `<g id="terrainLayer">${terrainSvg}</g>` +
    `<g id="detailLayer" class="fx-layer">${detailSvg}</g>` +
    `<g id="mistLayer" class="fx-layer">${mistSvg}</g>` +
    `<g id="cityLayer" class="fx-layer">${labelSvg}</g>` +
    `<g id="overlayLayer" class="fx-layer">${overlaySvg}</g>` +
    `<g id="unitLayer">${unitSvg}</g></svg>`;
  $('board').querySelectorAll('#unitLayer g').forEach(g => {
    g.addEventListener('click', () => handleHex(Number(g.dataset.col), Number(g.dataset.row)));
  });
  $('board').querySelectorAll('#terrainLayer g').forEach(g => {
    g.addEventListener('click', () => handleHex(Number(g.dataset.c), Number(g.dataset.r)));
  });
}
function renderInfo() {
  const u = unitById(state.selected);
  const box = $('unitInfo');
  if (!u) {
    box.innerHTML = `<div class="empty">点击己方部队查看属性并下达指令<br><small>蓝色格可移动 · 红色目标可攻击</small></div>`;
    return;
  }
  const tr = troop(u), t = terrain(u.col, u.row), rk = RANKS[u.rank];
  const bonus = attackMultiplier(u, { type: 'daodun', rank: 'tun', col: u.col, row: u.row, side: u.side === 'player' ? 'enemy' : 'player' });
  const cmd = commandBonus(u);
  const note = (t === 'F' && tr.forestAtk) || (t === 'M' && tr.mountainAtk)
    ? `<span class="badge good">所处${TERRAIN[t].label}，攻击加成</span>` : '';
  box.innerHTML = `<div class="unit-head"><span class="unit-badge ${u.side}">${tr.short}</span><div><strong>${u.name}</strong><div class="muted">${tr.name} · ${rk.name}</div></div></div>` +
    `<div class="rank-row"><span class="rank-mark-badge">${rk.mark}</span><div><b>${rk.title}</b><small>${rk.desc}</small></div></div>` +
    `<div class="men-row"><span>编制人数</span><b>${u.men} / ${u.maxMen}</b><small>标准 ${rk.men} 人</small></div>` +
    `<div class="hp-row"><span>战力</span><div class="bar"><i style="width:${u.hp / u.maxHp * 100}%"></i></div><b>${u.hp}/${u.maxHp}</b></div>` +
    `<div class="stat-grid"><div><span>攻击</span><b>${tr.atk}</b></div><div><span>防御</span><b>${tr.def}</b></div><div><span>移动</span><b>${tr.move}</b></div><div><span>射程</span><b>${tr.min}-${tr.max}</b></div></div>` +
    `<p class="troop-note">${note}${tr.note}</p>` +
    `<div class="terrain-now">当前地形：<b>${TERRAIN[t].label}</b> · ${TERRAIN[t].desc}</div>` +
    `<div class="mult-now">当前伤害系数：<b>${bonus.toFixed(2)}×</b> · 编制系数 <b>${rk.mul.toFixed(2)}×</b></div>` +
    (cmd > 0 ? `<div class="cmd-now">受相邻上级节度：<b>+${Math.round(cmd * 100)}%</b> 攻防</div>` : '') +
    `<div class="info-actions"><button id="waitBtn" ${u.acted ? 'disabled' : ''}>原地待机</button><button id="cancelBtn">取消选择</button></div>`;
  $('waitBtn').onclick = () => {
    u.acted = true; state.selected = null; state.reach = new Map();
    log(`${u.name} 原地待机`, 'player'); renderAll(); maybeAutoEnd();
  };
  $('cancelBtn').onclick = () => selectUnit(null);
}
function renderLog() {
  $('battleLog').innerHTML = state.log.slice(0, 18).map(l =>
    `<div class="log-line ${l.side || ''}"><span class="log-turn">${l.turn}</span><span>${l.text}</span></div>`).join('');
}
function renderStatus() {
  const s = SCENARIOS[state.scenario];
  $('scenarioTitle').textContent = s.name;
  $('scenarioIntro').textContent = s.intro;
  $('objective').textContent = s.objective;
  $('turnLabel').textContent = `第 ${state.turn} 回合`;
  const side = $('sideLabel');
  side.textContent = state.over ? (state.over === 'win' ? '我军胜利' : state.over === 'lose' ? '我军败退' : '平局') : (state.side === 'player' ? '蜀军行动' : '魏军行动');
  side.className = `side-pill ${state.over || state.side}`;
  $('specialRule').style.display = s.singleFile ? 'block' : 'none';
  $('endTurn').disabled = state.side !== 'player' || !!state.over || state.busy;
  $('resetBtn').disabled = state.busy;
  if (state.over) {
    $('resultBanner').style.display = 'flex';
    $('resultBanner').innerHTML = `<strong>${state.over === 'win' ? '大获全胜' : state.over === 'lose' ? '兵败如山' : '平局'}</strong><span>${state.over === 'win' ? '再战一场，试试别的场景' : '调整布阵与兵种，卷土重来'}</span>`;
  } else $('resultBanner').style.display = 'none';
  document.querySelectorAll('#scenarioList button').forEach((b, i) => b.classList.toggle('active', i === state.scenario));
}
function renderAll() { renderBoard(); renderInfo(); renderLog(); renderStatus(); }

/* ---------- 初始化 ---------- */
function buildStaticUI() {
  $('scenarioList').innerHTML = SCENARIOS.map((s, i) =>
    `<button data-i="${i}"><span class="sc-icon">${s.icon}</span><span class="sc-text"><b>${s.name}</b><small>${s.tag}</small></span></button>`).join('');
  $('scenarioList').querySelectorAll('button').forEach(b => b.onclick = () => loadScenario(Number(b.dataset.i)));
  $('legend').innerHTML = Object.entries(TERRAIN).map(([key, v]) =>
    `<span class="legend-chip t-${key}"><i>${v.glyph || '·'}</i>${v.label}</span>`).join('');
  $('troopList').innerHTML = Object.entries(TROOPS).map(([id, t]) =>
    `<div class="troop-chip" title="${t.note}"><span class="tc tc-${id}">${t.short}</span><span><b>${t.name}</b><small>攻${t.atk} 防${t.def} 移${t.move} 射${t.min}-${t.max}</small></span></div>`).join('');
  $('rankList').innerHTML = Object.entries(RANKS).map(([id, r]) =>
    `<button data-r="${id}" title="${r.title}：${r.desc}"><span class="rank-glyph">${r.mark}</span><span class="rank-label"><b>${r.name}</b><small>${r.men} 人</small></span></button>`).join('');
  $('rankList').querySelectorAll('button').forEach(b => b.onclick = () => {
    const id = b.dataset.r;
    state.rankFilter = state.rankFilter === id ? null : id;
    $('rankList').querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.r === state.rankFilter));
    renderBoard();
  });
  $('endTurn').onclick = endTurn;
  $('resetBtn').onclick = () => loadScenario(state.scenario);
  $('rulesBtn').onclick = () => { $('rulesModal').style.display = 'flex'; };
  $('closeRules').onclick = () => { $('rulesModal').style.display = 'none'; };
  $('rulesModal').addEventListener('click', e => { if (e.target === $('rulesModal')) $('rulesModal').style.display = 'none'; });
}

buildStaticUI();
loadScenario(0);
