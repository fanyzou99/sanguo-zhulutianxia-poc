/* 三国·逐鹿天下 V0.7 — 六边形战棋引擎与界面 */

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

const state = {
  scenario: 0, map: [], units: [], turn: 1, side: 'player',
  selected: null, reach: new Map(), log: [], over: null, busy: false, uid: 1
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
function attackMultiplier(a, d) {
  const at = troop(a), dt = troop(d);
  let m = (at.strong?.[d.type] || 1) / (dt.strong?.[a.type] || 1);
  const here = terrain(a.col, a.row);
  if (here === 'F' && at.forestAtk) m *= at.forestAtk;
  if (here === 'M' && at.mountainAtk) m *= at.mountainAtk;
  if (terrain(d.col, d.row) === 'C' && at.siege) m *= at.siege;
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
  const dmg = Math.max(4, Math.round(raw - troop(d).def * (1 + defBonus(terrain(d.col, d.row))) * 0.5));
  d.hp = Math.max(0, d.hp - dmg);
  const bonusText = mul > 1.15 ? '（克制／地形加成）' : mul < 0.85 ? '（被克制）' : '';
  log(`${a.name} → ${d.name} 造成 ${dmg} 点伤害${bonusText}`, a.side);
  if (at.splash) {
    const splash = Math.round(dmg * at.splash);
    for (const n of neighbors(d.col, d.row)) {
      const victim = unitAt(n.col, n.row);
      if (victim && victim.side !== a.side && victim.id !== d.id) {
        victim.hp = Math.max(0, victim.hp - splash);
        log(`溅射波及 ${victim.name}，造成 ${splash} 点伤害`, a.side);
      }
    }
  }
  state.units.filter(u => u.hp <= 0).forEach(u => log(`${u.name} 部溃败`, u.side));
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
  state.units = [...s.player, ...s.enemy].map((u, idx) => ({
    ...u, id: state.uid++, side: idx < s.player.length ? 'player' : 'enemy',
    maxHp: troop(u).hp, hp: troop(u).hp, acted: false
  }));
  state.turn = 1; state.side = 'player'; state.selected = null;
  state.reach = new Map(); state.log = []; state.over = null; state.busy = false;
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
  const vbH = HEX * 1.5 * (H - 1) + HEX * 2 + 36;
  let terrainSvg = '', overlaySvg = '', unitSvg = '';
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const t = terrain(c, r), p = pos(c, r), pts = hexPoints(p.x, p.y);
      const glyph = TERRAIN[t].glyph;
      terrainSvg += `<g class="hex t-${t}"><polygon points="${pts}"/>` +
        (glyph ? `<text class="terrain-glyph" x="${p.x}" y="${p.y + 6}">${glyph}</text>` : '') + `</g>`;
      const sel = unitById(state.selected);
      let cls = '';
      if (sel && sel.col === c && sel.row === r) cls = 'sel';
      else if (sel && state.reach.has(k(c, r))) cls = 'reach';
      else if (sel && unitAt(c, r) && canAttack(sel, unitAt(c, r))) cls = 'attack';
      if (cls) overlaySvg += `<polygon class="ov-${cls}" points="${pts}"/>`;
    }
  }
  for (const u of state.units) {
    const p = pos(u.col, u.row), tr = troop(u);
    const isSel = state.selected === u.id;
    const hpPct = Math.round(u.hp / u.maxHp * 100);
    unitSvg += `<g class="unit ${u.side} ${isSel ? 'is-sel' : ''} ${u.acted ? 'acted' : ''}" data-col="${u.col}" data-row="${u.row}">` +
      `<circle class="unit-ring" cx="${p.x}" cy="${p.y}" r="17"/>` +
      `<circle class="unit-body" cx="${p.x}" cy="${p.y}" r="13.5"/>` +
      `<text class="unit-text ${tr.short.length > 1 ? 'small' : ''}" x="${p.x}" y="${p.y + 4.5}">${tr.short}</text>` +
      `<rect class="hp-bg" x="${p.x - 15}" y="${p.y + 19}" width="30" height="4" rx="2"/>` +
      `<rect class="hp-fill" x="${p.x - 15}" y="${p.y + 19}" width="${30 * hpPct / 100}" height="4" rx="2"/>` +
      `<title>${u.name} · ${tr.name} · ${u.hp}/${u.maxHp}</title></g>`;
  }
  $('board').innerHTML =
    `<svg viewBox="0 0 ${vbW.toFixed(0)} ${vbH.toFixed(0)}" role="img" aria-label="六边形作战地图">` +
    `<g id="terrainLayer">${terrainSvg}</g><g id="overlayLayer">${overlaySvg}</g>` +
    `<g id="unitLayer">${unitSvg}</g></svg>`;
  $('board').querySelectorAll('#unitLayer g').forEach(g => {
    g.addEventListener('click', () => handleHex(Number(g.dataset.col), Number(g.dataset.row)));
  });
  // 地形层按行优先顺序补上点击坐标
  const hexGroups = $('board').querySelectorAll('#terrainLayer g');
  let idx = 0;
  hexGroups.forEach(g => {
    const c = idx % W, r = Math.floor(idx / W); idx++;
    g.addEventListener('click', () => handleHex(c, r));
  });
}
function renderInfo() {
  const u = unitById(state.selected);
  const box = $('unitInfo');
  if (!u) {
    box.innerHTML = `<div class="empty">点击己方部队查看属性并下达指令<br><small>蓝色格可移动 · 红色目标可攻击</small></div>`;
    return;
  }
  const tr = troop(u), t = terrain(u.col, u.row);
  const bonus = attackMultiplier(u, { type: 'daodun', col: u.col, row: u.row, side: u.side === 'player' ? 'enemy' : 'player' });
  const note = (t === 'F' && tr.forestAtk) || (t === 'M' && tr.mountainAtk)
    ? `<span class="badge good">所处${TERRAIN[t].label}，攻击加成</span>` : '';
  box.innerHTML = `<div class="unit-head"><span class="unit-badge ${u.side}">${tr.short}</span><div><strong>${u.name}</strong><div class="muted">${tr.name}</div></div></div>` +
    `<div class="hp-row"><span>兵力</span><div class="bar"><i style="width:${u.hp / u.maxHp * 100}%"></i></div><b>${u.hp}/${u.maxHp}</b></div>` +
    `<div class="stat-grid"><div><span>攻击</span><b>${tr.atk}</b></div><div><span>防御</span><b>${tr.def}</b></div><div><span>移动</span><b>${tr.move}</b></div><div><span>射程</span><b>${tr.min}-${tr.max}</b></div></div>` +
    `<p class="troop-note">${note}${tr.note}</p>` +
    `<div class="terrain-now">当前地形：<b>${TERRAIN[t].label}</b> · ${TERRAIN[t].desc}</div>` +
    `<div class="mult-now">当前环境伤害系数：<b>${bonus.toFixed(2)}×</b></div>` +
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
  $('endTurn').onclick = endTurn;
  $('resetBtn').onclick = () => loadScenario(state.scenario);
  $('rulesBtn').onclick = () => { $('rulesModal').style.display = 'flex'; };
  $('closeRules').onclick = () => { $('rulesModal').style.display = 'none'; };
  $('rulesModal').addEventListener('click', e => { if (e.target === $('rulesModal')) $('rulesModal').style.display = 'none'; });
}

buildStaticUI();
loadScenario(0);
