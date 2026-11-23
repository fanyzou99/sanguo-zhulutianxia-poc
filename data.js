/* 三国·逐鹿天下 V0.8 — 兵种、地形、编制层级与作战场景数据 */

const TERRAIN = {
  P: { label: '平原', glyph: '', desc: '无加成，通行顺畅' },
  F: { label: '山林', glyph: '♠', desc: '步骑减速；弓兵、弩兵攻击 +35%' },
  M: { label: '山地', glyph: '▲', desc: '步骑大幅减速；弓兵、弩兵攻击 +30%；阻挡远程视线' },
  R: { label: '江河', glyph: '≈', desc: '仅水军舰船可航行；陆军须走渡口' },
  B: { label: '渡口', glyph: '═', desc: '陆军可跨江的浅滩／浮桥' },
  C: { label: '城池', glyph: '城', desc: '守军防御 +35%，攻城器械对其伤害提升' },
  D: { label: '栈道', glyph: '━', desc: '单列通行，进入后不可越位、不可调换顺序' }
};

/* 汉制编制层级：idx 越高统辖越广，mul 为战斗系数，men 为标准人数 */
const RANKS = {
  wu:   { name: '伍',     mark: '伍', men: 5,     title: '伍长',               desc: '军队最基层的作战单位', idx: 0, mul: 0.90 },
  shi:  { name: '什',     mark: '什', men: 10,    title: '什长',               desc: '由两个伍组成', idx: 1, mul: 0.95 },
  dui:  { name: '队',     mark: '队', men: 50,    title: '队率（队正）',        desc: '设队率一人统领', idx: 2, mul: 1.00 },
  tun:  { name: '屯',     mark: '屯', men: 100,   title: '屯长（百人将）',      desc: '由两队组成，设屯长一人', idx: 3, mul: 1.05 },
  qu:   { name: '曲',     mark: '曲', men: 400,   title: '军候',               desc: '汉制一曲通常为两屯至五屯', idx: 4, mul: 1.10 },
  bu:   { name: '部',     mark: '部', men: 1000,  title: '军司马（别部司马）',  desc: '满编约千人，独立编制称别部司马', idx: 5, mul: 1.15 },
  ying: { name: '营 / 军', mark: '营', men: 4000, title: '校尉 / 中郎将',       desc: '中高级将领，如武卫校尉、虎贲中郎将', idx: 6, mul: 1.20 },
  jun:  { name: '大军',   mark: '军', men: 12000, title: '将军',               desc: '偏将军、杂号将军、四征四镇等，独立指挥', idx: 7, mul: 1.25 }
};

// 知名将领按史实身份提升编制层级；其余按兵种默认
const COMMANDER_RANKS = {
  '周瑜': 'jun', '陆逊': 'jun', '关羽': 'jun', '张飞': 'jun', '赵云': 'ying',
  '张辽': 'ying', '夏侯惇': 'ying', '曹仁': 'ying', '黄盖': 'bu', '程普': 'bu',
  '甘宁': 'bu', '于禁': 'bu', '曹纯': 'bu', '颜良': 'ying', '文丑': 'ying',
  '夏侯渊': 'jun', '黄忠': 'ying', '魏延': 'bu', '关兴': 'qu', '李典': 'bu',
  '乐进': 'bu'
};

function rankForUnit(u) {
  if (u.rank && RANKS[u.rank]) return u.rank;
  if (COMMANDER_RANKS[u.name]) return COMMANDER_RANKS[u.name];
  if (u.type === 'shuijun') return 'bu';
  if (u.type === 'qi' || u.type === 'xiang') return 'qu';
  if (u.type === 'nuche' || u.type === 'toushi' || u.type === 'huoqi') return 'dui';
  return 'tun';
}

// cost: 进入该地形的移动力消耗，99 表示不可通行
const TROOPS = {
  daodun: {
    name: '刀盾兵', short: '盾', atk: 17, def: 17, hp: 110, move: 3, min: 1, max: 1,
    cost: { P: 1, F: 2, M: 2, B: 1, C: 1, D: 1 },
    strong: { gong: 1.35, nu: 1.25 },
    note: '高防御，克弓弩；惧火器与骑兵冲击'
  },
  qiang: {
    name: '枪兵', short: '枪', atk: 20, def: 13, hp: 105, move: 3, min: 1, max: 1,
    cost: { P: 1, F: 2, M: 2, B: 1, C: 1, D: 1 },
    strong: { qi: 1.6, xiang: 1.3 },
    note: '抗骑核心，长枪拒马克制骑兵、象兵'
  },
  ji: {
    name: '戟兵', short: '戟', atk: 22, def: 14, hp: 105, move: 3, min: 1, max: 1,
    cost: { P: 1, F: 2, M: 2, B: 1, C: 1, D: 1 },
    strong: { daodun: 1.3, qiang: 1.2 },
    note: '攻守兼备，克制刀盾与枪兵'
  },
  gong: {
    name: '弓箭兵', short: '弓', atk: 18, def: 8, hp: 85, move: 3, min: 2, max: 3,
    cost: { P: 1, F: 2, M: 3, B: 1, C: 1, D: 1 },
    forestAtk: 1.35, mountainAtk: 1.3,
    note: '远程压制；在山林、山地中攻击力大幅提升'
  },
  nu: {
    name: '弩兵', short: '弩', atk: 23, def: 9, hp: 85, move: 2, min: 2, max: 3,
    cost: { P: 1, F: 2, M: 3, B: 1, C: 1, D: 1 },
    forestAtk: 1.25, mountainAtk: 1.2, strong: { daodun: 1.4, xiang: 1.2 },
    note: '强弩穿甲，克刀盾；山林中攻击提升'
  },
  qi: {
    name: '骑兵', short: '骑', atk: 27, def: 11, hp: 100, move: 6, min: 1, max: 1,
    cost: { P: 1, F: 3, M: 4, B: 1, C: 1, D: 1 },
    strong: { gong: 1.5, nu: 1.5 },
    note: '机动力最强，克制弓弩；山地、山林严重减速'
  },
  xiang: {
    name: '象兵', short: '象', atk: 33, def: 19, hp: 150, move: 3, min: 1, max: 1,
    cost: { P: 1, F: 3, M: 99, B: 1, C: 1, D: 1 },
    note: '巨兽破阵，生命极高；不可入山地，惧火器'
  },
  nuche: {
    name: '弩车', short: '弩车', atk: 28, def: 8, hp: 80, move: 2, min: 2, max: 4,
    cost: { P: 1, F: 99, M: 99, B: 1, C: 1, D: 1 },
    strong: { xiang: 1.4 }, siege: 1.35,
    note: '床弩远射，克制象兵、城池；不可进山林'
  },
  toushi: {
    name: '投石车', short: '石', atk: 37, def: 6, hp: 75, move: 1, min: 3, max: 5,
    cost: { P: 1, F: 99, M: 99, B: 1, C: 1, D: 1 },
    splash: 0.5, ignoreLOS: true, siege: 1.6,
    note: '超远抛射，无视山体阻挡并造成溅射；不可进山林'
  },
  huoqi: {
    name: '兵器（火器）', short: '火', atk: 31, def: 8, hp: 80, move: 2, min: 2, max: 3,
    cost: { P: 1, F: 2, M: 99, B: 1, C: 1, D: 1 },
    splash: 0.4, strong: { xiang: 1.9, shuijun: 1.7 }, siege: 1.25,
    note: '火器溅射，克制象兵与江上舰船，可破坏城池'
  },
  shuijun: {
    name: '水军', short: '舰', atk: 25, def: 13, hp: 105, move: 5, min: 1, max: 2,
    cost: { R: 1, B: 1, P: 99, F: 99, M: 99, C: 99, D: 99 },
    waterOnly: true, coastal: true,
    note: '仅在有江河的战场出现的舰船；可沿江机动、靠岸接舷'
  }
};

const U = (type, col, row, name, rank) => ({ type, col, row, name, ...(rank ? { rank } : {}) });

function mapFromRows(rows, width = 13) {
  return rows.map(r => r.padEnd(width, 'P').slice(0, width));
}

const ALL_PLAIN = () => Array.from({ length: 9 }, () => 'P'.repeat(13));

const SCENARIOS = [
  {
    id: 'chibi', name: '赤壁之战', tag: '江水横亘', icon: '火',
    intro: '长江天堑横贯战场，舰船巡弋江面。火器部队可焚毁敌舰，陆军须争夺渡口。',
    objective: '歼灭对岸守军；水军接舷、火器焚舰可得先机。',
    map: mapFromRows([
      'PPPPFPPMMPPP',
      'PPFPPPPMPPPPP',
      'PPPPPPPPMFPPP',
      'FPPPPPPPPPPF',
      'RRRRRBRRRRBRR',
      'RRRRRRRRRRRRR',
      'PPPFPPPPPPPP',
      'PPPPPMMPPPFP',
      'PPPPPPPFPPPP'
    ]),
    player: [U('daodun', 2, 7, '黄盖'), U('gong', 4, 8, '程普'), U('huoqi', 6, 8, '周瑜'), U('ji', 8, 7, '甘宁'), U('shuijun', 3, 4, '东吴楼船'), U('shuijun', 8, 5, '蒙冲')],
    enemy: [U('qiang', 3, 1, '曹仁'), U('nu', 6, 2, '于禁'), U('daodun', 9, 1, '夏侯惇'), U('qi', 11, 2, '曹纯'), U('shuijun', 7, 4, '魏军战船'), U('shuijun', 11, 5, '魏军楼船')]
  },
  {
    id: 'hefei', name: '合肥之战', tag: '纯平原', icon: '骑',
    intro: '一马平川，无险可守。骑兵机动与器械对射是胜负关键。',
    objective: '在开阔地击溃魏军主力。',
    map: ALL_PLAIN(),
    player: [U('qi', 2, 7, '赵云'), U('qiang', 4, 7, '张飞'), U('daodun', 6, 8, '关兴'), U('gong', 8, 8, '弓骑'), U('nuche', 10, 7, '强弩营'), U('toushi', 11, 8, '攻城队')],
    enemy: [U('qi', 3, 1, '张辽'), U('ji', 5, 1, '李典'), U('daodun', 7, 1, '乐进'), U('qi', 9, 1, '魏骑'), U('nu', 11, 1, '弩阵'), U('toushi', 6, 0, '魏军石车')]
  },
  {
    id: 'luoyang', name: '洛阳之战', tag: '城池攻守', icon: '城',
    intro: '帝都坚城，曹军据城死守。投石车与火器可压制城头，刀盾兵负责最后突入。',
    objective: '占领城中心 (7,4) 的城池格，或全歼守军。',
    map: mapFromRows([
      'PPMMPPPPMMPPP',
      'PMPPPDDPPPMMP',
      'PPPPPDDCDPPPP',
      'PPPPDDCCCDPPP',
      'PPPDDDCCCDDPP',
      'PPPPDDCCCDPPP',
      'PPPPPDDCDPPPP',
      'PMPPPDDPPPMMP',
      'PPMMPPPPMMPPP'
    ]),
    player: [U('toushi', 4, 8, '攻城石车'), U('nuche', 5, 8, '弩车营'), U('huoqi', 7, 8, '火器营'), U('daodun', 9, 8, '先锋'), U('ji', 11, 7, '戟兵'), U('gong', 1, 7, '弓箭手')],
    enemy: [U('daodun', 5, 3, '城守'), U('qiang', 8, 3, '禁军'), U('nu', 6, 2, '城头弩手'), U('gong', 7, 2, '城头弓手'), U('ji', 6, 5, '曹营校尉'), U('qi', 9, 6, '洛阳骑')],
    capture: { col: 6, row: 4 }
  },
  {
    id: 'shanlin', name: '山林之战', tag: '山密林深', icon: '林',
    intro: '群山连绵、林木幽深。步兵骑兵举步维艰，弓兵与弩兵在山林中威力大增。',
    objective: '在复杂地形中歼灭伏击的魏军。',
    map: mapFromRows([
      'MMFFMFMFFMMPP',
      'MFFMFFMFMPPFP',
      'FMMFFMMFFMFMF',
      'PFFMFFMFFMMFP',
      'MFFPMFFPMFFPM',
      'FMMFFMMFFMFMF',
      'PMFFMFFMFFMMP',
      'MFFPMFFPMFFPF',
      'MMFFMFMFFMMPP'
    ]),
    player: [U('gong', 2, 7, '弓手营'), U('nu', 4, 8, '弩手营'), U('daodun', 6, 8, '刀盾手'), U('qiang', 8, 7, '长枪队'), U('ji', 10, 8, '戟兵队')],
    enemy: [U('gong', 3, 1, '魏弓手'), U('nu', 6, 1, '魏弩手'), U('qiang', 8, 2, '山地步卒'), U('daodun', 10, 1, '魏刀盾'), U('ji', 5, 2, '魏戟兵')]
  },
  {
    id: 'shudao', name: '蜀道难', tag: '单列栈道', icon: '道',
    intro: '秦岭栈道仅容一卒，进入之后部队不可越位、不可调换顺序。前锋被堵，后队只能干等。',
    objective: '打通栈道，以先入者为先锋击溃关前魏军。',
    map: mapFromRows([
      'MMMMMMMMMDDDM',
      'MMMMMMMMMDMMM',
      'MMMMMMMDDDMMM',
      'MMMMMMMDMMMMM',
      'MMMMMDDDMMMMM',
      'MMMMMDMMMMMMM',
      'MMMDDDMMMMMMM',
      'MMMDMMMMMMMMM',
      'DDDDMMMMMMMMM'
    ]),
    player: [U('daodun', 0, 8, '前锋·魏延'), U('qiang', 1, 8, '枪兵'), U('gong', 2, 8, '弓兵'), U('ji', 3, 8, '戟兵'), U('nu', 3, 7, '弩兵')],
    enemy: [U('daodun', 9, 0, '关前守将'), U('qiang', 10, 0, '魏枪兵'), U('gong', 11, 0, '关上弓手'), U('ji', 11, 1, '魏戟兵'), U('nu', 9, 1, '魏弩手')],
    singleFile: true
  },
  {
    id: 'yiling', name: '夷陵之战', tag: '林江交错', icon: '炎',
    intro: '江流曲折，山林密布。陆逊以火攻破连营，弓弩借林莽之遮杀伤尤巨。',
    objective: '击破吴军水陆连营；小心火器与江上舰船。',
    map: mapFromRows([
      'PPFFFMMFPPPPF',
      'PPFFMFMFFPPPP',
      'PPPFMMFFFPFPP',
      'PPFFFFFRRRBPP',
      'PFFFFRRRRRBFP',
      'PPFFRRRFFRRRP',
      'PPPRRRFFFRRPP',
      'PPRRRFFFFRPPP',
      'PRRRFFFFFFPPP'
    ]),
    player: [U('gong', 5, 7, '弓兵营'), U('nu', 4, 8, '弩兵营'), U('daodun', 6, 8, '盾兵营'), U('huoqi', 8, 8, '陆逊火营'), U('shuijun', 4, 5, '江东战船')],
    enemy: [U('ji', 9, 1, '蜀军前锋'), U('qiang', 11, 2, '枪兵'), U('gong', 7, 1, '蜀弓手'), U('daodun', 10, 3, '盾兵'), U('shuijun', 9, 4, '蜀军舟师')]
  },
  {
    id: 'guandu', name: '官渡之战', tag: '平原翼击', icon: '渡',
    intro: '河北平原，右翼有河。骑兵绕击粮道，投石车压制袁军高垒。',
    objective: '击溃袁绍大军，切断其粮道。',
    map: mapFromRows([
      'PPPPPPPPPRRRP',
      'PPPPPPPPPPRRP',
      'PPPPFPPPPPRRP',
      'PPPPFPPPPPRRP',
      'PPPPPPPPPPBRP',
      'PPPPPPPPPPBRP',
      'PPPPPPPPPPRRP',
      'PPPPFPPPPPRRP',
      'PPPPPPPPPRRRP'
    ]),
    player: [U('qi', 1, 7, '曹纯虎豹骑'), U('qiang', 4, 8, '夏侯惇'), U('daodun', 6, 8, '曹仁'), U('nu', 8, 8, '弩阵'), U('toushi', 9, 7, '霹雳车'), U('gong', 7, 8, '弓手'), U('shuijun', 10, 6, '曹军舟师')],
    enemy: [U('daodun', 3, 1, '颜良'), U('ji', 6, 1, '文丑'), U('qi', 9, 1, '河北骑'), U('gong', 8, 2, '袁弓手'), U('xiang', 7, 2, '袁军象阵'), U('nu', 4, 2, '袁弩手'), U('shuijun', 11, 4, '袁军水寨')]
  },
  {
    id: 'tongguan', name: '潼关之战', tag: '关隘险道', icon: '关',
    intro: '左依群山、右临大河，仅有一线通路可达潼关。器械无法穿山，只能沿道推进。',
    objective: '从狭长通道攻入关内，击败守军。',
    map: mapFromRows([
      'MMMMMMMPPPRRR',
      'MMMMMMPPPDRRR',
      'MMMMMPPPDDRRR',
      'MMMMPPPDDDRRR',
      'MMMPPPPDDDRRR',
      'MMMPPPPDDRRRR',
      'MMMMPPPPDDRRR',
      'MMMMMPPPDDRRR',
      'MMMMMMPPPRRRR'
    ]),
    player: [U('daodun', 6, 8, '先锋'), U('qiang', 8, 8, '枪兵'), U('gong', 7, 7, '弓兵'), U('nu', 9, 7, '弩兵'), U('ji', 8, 7, '戟兵'), U('shuijun', 11, 8, '河滨舟师')],
    enemy: [U('daodun', 7, 0, '潼关守将'), U('nu', 9, 1, '关上弩手'), U('qiang', 6, 2, '魏枪兵'), U('gong', 8, 3, '魏弓手'), U('qi', 6, 4, '关内骑'), U('shuijun', 11, 0, '魏军河船')]
  },
  {
    id: 'jingzhou', name: '荆州之战', tag: '江湖水网', icon: '舟',
    intro: '江汉水网纵横，城池互援。水军沿江机动，步骑护送攻城器械涉渡。',
    objective: '夺取江畔城池并击溃守军。',
    map: mapFromRows([
      'PPRRRRRPPPPPP',
      'PPPPRRPPPPPPP',
      'PPPPPRPPPPPPP',
      'PPPPPRPPCPPPP',
      'PPPPPRPPPPPPP',
      'PPPPPRPPPPPPP',
      'PPPPRRPPPPPPP',
      'PPRRRRRPPPPPP',
      'PPPRPPPPPPPPP'
    ]),
    player: [U('shuijun', 2, 0, '荆州水师'), U('shuijun', 3, 7, '楼船'), U('daodun', 7, 8, '盾兵'), U('gong', 9, 8, '弓兵'), U('toushi', 11, 7, '石车'), U('huoqi', 10, 8, '火器营')],
    enemy: [U('daodun', 8, 2, '守城将'), U('nu', 8, 4, '城头弩'), U('qi', 10, 1, '魏骑'), U('ji', 11, 3, '魏戟兵'), U('shuijun', 5, 3, '魏军舟师')]
  },
  {
    id: 'dingjun', name: '定军山之战', tag: '山地攻坚', icon: '山',
    intro: '群峰环抱营寨，山道上弓弩密集。老将黄忠居高临下，逐营夺取山头。',
    objective: '攻占山顶城寨并全歼魏军。',
    map: mapFromRows([
      'MMFMMMMMMFMMM',
      'MFFMMMMMMFFMM',
      'PFFMMCMMMFFMP',
      'PPFFMCCCMFFPP',
      'PPFFFCCFFFFPP',
      'PPFFMCCCMFFPP',
      'PFFMMCMMMFFMP',
      'MFFMMMMMMFFMM',
      'MMFMMMMMMFMMM'
    ]),
    player: [U('gong', 2, 8, '弓兵'), U('nu', 4, 8, '强弩'), U('daodun', 6, 8, '刀盾兵'), U('qiang', 8, 8, '枪兵'), U('ji', 10, 7, '戟兵')],
    enemy: [U('gong', 2, 1, '魏弓手'), U('nu', 4, 2, '魏弩手'), U('daodun', 6, 3, '夏侯渊'), U('qiang', 8, 2, '魏枪兵'), U('gong', 10, 3, '山头弓手')]
  }
];

/* 城池牌：坐标 -> 城名、兵力（万）、默认守方。用于地图上的势力旗与兵力牌 */
const CITY_INFO = {
  luoyang:  { '6,4': { name: '洛阳', men: 12, side: 'enemy' } },
  jingzhou: { '9,3': { name: '江陵', men: 8,  side: 'enemy' } },
  dingjun:  { '6,3': { name: '定军山', men: 6, side: 'enemy' }, '6,4': { name: '夏侯渊营', men: 5, side: 'enemy' } }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TERRAIN, TROOPS, RANKS, COMMANDER_RANKS, rankForUnit, SCENARIOS, CITY_INFO };
}
