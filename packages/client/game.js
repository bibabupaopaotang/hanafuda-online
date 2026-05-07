/**
 * 花札 Hanafuda - 和风重制版
 * 和纸/樱花主题 + 出牌动画 + 触摸反馈
 */

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

// ================= 配置 =================
const CONFIG = {
  SERVER_URL: 'ws://47.253.96.212/socket.io/?EIO=4&transport=websocket',
  TURN_TIMEOUT: 15000,
  ANIM_DURATION: 350,
  MODAL_ANIM_IN: 220,
  MODAL_ANIM_OUT: 160,
};

const STATE = { MENU: 0, LOBBY: 1, GAME: 2, RESULT: 3, POPUP: 4 };

// ================= 设计令牌 - 和风/樱花主题 =================
const COLORS = {
  // 背景
  WASHI_LIGHT:   '#F5F0E8',
  WASHI_DARK:    '#E8E0D0',
  TABLE:         '#C8B896',
  TABLE_DARK:    '#A89878',
  SAKURA_BG:     '#FDF2F8',

  // 强调色
  SAKURA:        '#E891A5',
  SAKURA_DARK:   '#D4707F',
  SAKURA_LIGHT:  '#FADADD',
  GOLD:          '#D4A843',
  GOLD_DARK:     '#B8860B',

  // 回合指示
  TURN_MY:       '#4A8C5C',
  TURN_OPP:      '#C97B5A',
  URGENCY:       '#C0392B',

  // 卡片
  CARD_SELECTED: '#FFD700',
  SHADOW:        'rgba(60,30,10,0.25)',
  SHADOW_DEEP:   'rgba(60,30,10,0.4)',

  // 文字
  TEXT_DARK:     '#3C2415',
  TEXT_LIGHT:    '#F5F0E8',
  TEXT_MUTED:    '#8C7B6B',
  TEXT_GOLD:     '#D4A843',

  // 按钮
  BTN_PRIMARY:   '#E891A5',
  BTN_SECONDARY: '#D4A843',
  BTN_DANGER:    '#C0392B',
  BTN_SUCCESS:   '#4A8C5C',
  BTN_INFO:      '#6B8E9B',

  // 弹窗
  MODAL_OVERLAY: 'rgba(45,25,15,0.55)',
  MODAL_BG:      '#FDF8F0',
  MODAL_BORDER:  '#D4A843',

  // 月份颜色
  MONTH_COLORS: ['#87CEEB','#FF80AB','#87CEEB','#A9A9A9',
                  '#FF7043','#EC407A','#8D6E63','#FFD54F',
                  '#A1887F','#66BB6A','#EF5350','#E91E63'],
};

// ================= 布局配置 =================
const LAYOUT = {
  areas: {
    topBar:       { x: 0,    y: 0,    w: 1.0,  h: 0.055 },
    opponentHand: { x: 0.12, y: 0.06, w: 0.76, h: 0.09 },
    field:        { x: 0.08, y: 0.17, w: 0.84, h: 0.48 },
    playerHand:   { x: 0.08, y: 0.67, w: 0.84, h: 0.15 },
    statusBar:    { x: 0,    y: 0.84, w: 1.0,  h: 0.16 },
  },
  cardSizes: {
    hand: 1.0,      // 玩家手牌
    field: 0.85,    // 场牌
    opp: 0.5,       // 对手手牌
  }
};

// ================= 缓动函数 =================
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ================= 状态变量 =================
let currentState = STATE.MENU;
let mySeatIndex = 0;
let myRoomId = '';
let playerCount = 0;
let gameState = null;
let resultData = null;
let statusMsg = '';
let selectedCardId = null;
let socketConnected = false;

// 动画状态
let animating = false;
let rafId = null;
let lastFrameTime = 0;
let flyingCards = [];
let pressFeedbackId = null;
let pressFeedbackStart = 0;
let popupState = { show: false, yakuList: [], animProgress: 0, animating: false, animIn: true };

// UI
let _buttons = [];
let cardImages = {};
let cardBackImg = null;
let _cardPositions = {}; // 记录每张手牌的屏幕位置

// ================= 加载卡牌图片 =================
function loadCardImages(callback) {
  let loaded = 0;
  const total = 49;

  function onCardLoad() {
    loaded++;
    if (loaded >= total && callback) callback();
  }

  for (let i = 0; i < 48; i++) {
    const img = wx.createImage();
    img.onload = onCardLoad;
    img.onerror = () => { loaded++; };
    img.src = './assets/cards/card_' + String(i).padStart(2, '0') + '.png';
    cardImages[i] = img;
  }

  cardBackImg = wx.createImage();
  cardBackImg.onload = onCardLoad;
  cardBackImg.onerror = () => { loaded++; };
  cardBackImg.src = './assets/cards/card_back.png';

  setTimeout(() => {
    if (callback && loaded < total) {
      console.warn('[资源] 图片加载超时，强制开始');
      callback();
    }
  }, 5000);
}

// ================= 基础绘图 =================
function drawBg() {
  const W = canvas.width, H = canvas.height;

  // 和纸底色
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#F0EAE0');
  grad.addColorStop(0.5, '#E8E0D4');
  grad.addColorStop(1, '#DDD5C5');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 樱花花瓣纹理
  drawSakuraTexture(W, H);
}

function drawSakuraTexture(W, H) {
  // 预计算的樱花种子
  const seeds = [
    {x:0.08,y:0.12,s:12,a:0.04},{x:0.22,y:0.08,s:9,a:0.035},{x:0.38,y:0.15,s:11,a:0.03},
    {x:0.55,y:0.1,s:8,a:0.04},{x:0.72,y:0.14,s:10,a:0.035},{x:0.88,y:0.09,s:13,a:0.03},
    {x:0.15,y:0.35,s:10,a:0.03},{x:0.42,y:0.42,s:9,a:0.025},{x:0.65,y:0.38,s:11,a:0.035},
    {x:0.82,y:0.45,s:8,a:0.03},{x:0.1,y:0.65,s:12,a:0.03},{x:0.35,y:0.7,s:9,a:0.025},
    {x:0.58,y:0.62,s:10,a:0.035},{x:0.78,y:0.68,s:8,a:0.03},{x:0.92,y:0.72,s:11,a:0.025},
    {x:0.2,y:0.82,s:9,a:0.03},{x:0.5,y:0.88,s:10,a:0.035},{x:0.75,y:0.85,s:8,a:0.03},
  ];

  for (const p of seeds) {
    drawSakuraPetal(W * p.x, H * p.y, p.s, p.a);
  }
}

function drawSakuraPetal(cx, cy, size, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS.SAKURA_LIGHT;

  // 五瓣花
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const angle = (i * 72 - 90) * Math.PI / 180;
    const px = cx + Math.cos(angle) * size * 0.4;
    const py = cy + Math.sin(angle) * size * 0.4;
    ctx.ellipse(px, py, size * 0.35, size * 0.2, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawText(t, x, y, size, color, align = 'center') {
  ctx.fillStyle = color || COLORS.TEXT_DARK;
  ctx.font = size + 'px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = align;
  ctx.fillText(t, x, y);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function darkenColor(hex, factor = 0.85) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = c => Math.max(0, Math.round(c * factor));
  return `#${d(r).toString(16).padStart(2,'0')}${d(g).toString(16).padStart(2,'0')}${d(b).toString(16).padStart(2,'0')}`;
}

function drawBtn(text, x, y, w, h, color, onClick, disabled) {
  ctx.save();
  ctx.shadowColor = disabled ? 'transparent' : 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = disabled ? '#999' : color;
  roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = disabled ? '#bbb' : '#fff';
  ctx.font = 'bold ' + (h * 0.42) + 'px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + h * 0.62);

  if (!disabled) _buttons.push({ x, y, w, h, onClick });
}

// ================= 卡牌绘制 =================
function drawCardRaw(x, y, id, w, h, options = {}) {
  const {
    selected = false,
    pressed = false,
    pressScale = 1,
    arcOffset = 0,
    shadow = true,
  } = options;

  const finalY = y + arcOffset;
  const finalW = w * pressScale;
  const finalH = h * pressScale;
  const offsetX = (w - finalW) / 2;
  const offsetY = (h - finalH) / 2;
  const dx = x + offsetX;
  const dy = finalY + offsetY;

  if (shadow) {
    ctx.save();
    ctx.shadowColor = COLORS.SHADOW_DEEP;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
  }

  if (id === null || id === undefined) {
    // 牌背
    if (cardBackImg) {
      ctx.drawImage(cardBackImg, dx, dy, finalW, finalH);
    } else {
      ctx.fillStyle = '#2E7D32';
      roundRect(dx, dy, finalW, finalH, 6);
      ctx.fill();
    }
  } else {
    // 牌面
    const img = cardImages[id];
    if (img) {
      ctx.drawImage(img, dx, dy, finalW, finalH);
    }
  }

  if (shadow) ctx.restore();

  // 选中/按下效果
  if (selected) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,215,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = COLORS.CARD_SELECTED;
    ctx.lineWidth = 3;
    roundRect(dx - 1, dy - 1, finalW + 2, finalH + 2, 7);
    ctx.stroke();
    ctx.restore();
  }

  if (pressed && !selected) {
    ctx.strokeStyle = COLORS.GOLD;
    ctx.lineWidth = 2;
    roundRect(dx - 1, dy - 1, finalW + 2, finalH + 2, 7);
    ctx.stroke();
  }
}

// ================= 渲染入口 =================
function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  _buttons = [];
  _cardPositions = {};

  const baseW = 1920, baseH = 1080;
  const scale = Math.min(W / baseW, H / baseH);

  const CARD_W = 115 * scale;
  const CARD_H = 177 * scale;

  if (currentState === STATE.MENU) drawMenu(W, H);
  else if (currentState === STATE.LOBBY) drawLobby(W, H);
  else if (currentState === STATE.GAME) {
    if (testModeState) renderTestMode(W, H, CARD_W, CARD_H);
    else renderGameScene(W, H, CARD_W, CARD_H);
  }
  else if (currentState === STATE.RESULT) drawResultScreen(W, H);
  else if (currentState === STATE.POPUP) {
    if (testModeState) renderTestMode(W, H, CARD_W, CARD_H);
    else renderGameScene(W, H, CARD_W, CARD_H);
    renderPopup(W, H);
  }
}

// ================= 界面：菜单 =================
function drawMenu(W, H) {
  drawBg();

  // 标题
  ctx.save();
  ctx.shadowColor = 'rgba(60,30,10,0.2)';
  ctx.shadowBlur = 8;
  drawText('花札 Hanafuda', W / 2, H * 0.28, 52, COLORS.TEXT_DARK);
  ctx.restore();
  drawText('在线对战', W / 2, H * 0.36, 24, COLORS.TEXT_MUTED);

  // 按钮
  const btnW = W * 0.45, btnH = 52;
  const btnX = W / 2 - btnW / 2;
  drawBtn('创建房间', btnX, H * 0.46, btnW, btnH, COLORS.BTN_PRIMARY, () => {
    if (!socketConnected) {
      wx.showToast({ title: '连接中...', icon: 'loading' });
      return;
    }
    send('create_room');
  });
  drawBtn('加入房间', btnX, H * 0.56, btnW, btnH, COLORS.BTN_INFO, () => promptJoin());
  drawBtn('单机测试', btnX, H * 0.66, btnW, btnH, COLORS.BTN_SECONDARY, startSinglePlayerTest);
  drawBtn('役说明', btnX, H * 0.76, btnW, btnH, COLORS.BTN_SUCCESS, () => {
    currentState = STATE.POPUP;
    popupState.show = true;
    popupState.yakuHelp = true;
    render();
  });

  drawText(statusMsg, W / 2, H * 0.92, 18, COLORS.TEXT_MUTED);
}

// ================= 界面：大厅 =================
function drawLobby(W, H) {
  drawBg();

  const scale = Math.min(W / 1920, H / 1080);

  ctx.save();
  ctx.shadowColor = 'rgba(60,30,10,0.15)';
  ctx.shadowBlur = 6;
  drawText('房间大厅', W / 2, H * 0.14, 40 * scale, COLORS.TEXT_DARK);
  ctx.restore();

  // 房间号
  const roomBoxH = 56 * scale;
  ctx.fillStyle = COLORS.SAKURA_BG;
  roundRect(W * 0.3, H * 0.22, W * 0.4, roomBoxH, 12 * scale);
  ctx.fill();
  ctx.strokeStyle = COLORS.SAKURA;
  ctx.lineWidth = 2 * scale;
  roundRect(W * 0.3, H * 0.22, W * 0.4, roomBoxH, 12 * scale);
  ctx.stroke();
  drawText(myRoomId, W / 2, H * 0.22 + roomBoxH * 0.62, 28 * scale, COLORS.SAKURA_DARK);

  // 模式
  const modeText = gameState?.mode === 'hachi_hachi' ? '三人模式' : '两人模式';
  drawText(modeText, W / 2, H * 0.36, 20 * scale, COLORS.TEXT_MUTED);

  // 人数
  const maxP = gameState?.mode === 'hachi_hachi' ? 3 : 2;
  drawText('人数：' + playerCount + ' / ' + maxP, W / 2, H * 0.46, 24 * scale, COLORS.TEXT_DARK);

  // 玩家列表
  if (gameState?.players) {
    let py = H * 0.54;
    gameState.players.forEach((p, i) => {
      const isHost = (i === 0);
      const isMe = (i === mySeatIndex);
      const label = `${p.nickname}${isMe ? ' (你)' : ''}${isHost ? ' [房主]' : ''}`;
      drawText(label, W / 2, py, 18 * scale, isMe ? COLORS.SAKURA_DARK : COLORS.TEXT_DARK);
      py += 26 * scale;
    });
  }

  // 按钮
  const btnW = W * 0.32, btnH = 48 * scale;
  const btnGap = 18 * scale;
  const btnStartY = H * 0.72;

  if (mySeatIndex === 0) {
    drawBtn('开始游戏', W / 2 - btnW / 2, btnStartY, btnW, btnH, COLORS.BTN_PRIMARY, () => send('start_game'));
  } else {
    drawText('等待房主开始游戏', W / 2, btnStartY + btnH * 0.6, 18 * scale, COLORS.TEXT_MUTED);
  }
  drawBtn('离开房间', W / 2 - btnW / 2, btnStartY + btnH + btnGap, btnW, btnH, COLORS.BTN_DANGER, () => {
    send('leave_room');
    currentState = STATE.MENU;
    render();
  });
}

// ================= 界面：游戏场景 =================
function renderGameScene(W, H, cw, ch) {
  drawBg();
  if (!gameState) {
    drawText('等待发牌...', W / 2, H / 2, 32, COLORS.TEXT_MUTED);
    return;
  }

  const oppIdx = (mySeatIndex + 1) % 2;
  const myHand = gameState.hands[mySeatIndex] || [];
  const isMyTurn = (gameState.currentPlayerIndex === mySeatIndex);

  // --- 1. 顶部栏：对手信息 ---
  renderTopBar(W, H, oppIdx);

  // --- 2. 对手手牌 ---
  renderOpponentHand(W, H, oppIdx);

  // --- 3. 场牌区 ---
  renderFieldArea(W, H, cw, ch);

  // --- 4. 飞行动画卡牌 ---
  renderFlyingCards(W, H, cw, ch);

  // --- 5. 玩家手牌 ---
  renderPlayerHand(W, H, myHand, cw, ch, isMyTurn);

  // --- 6. 底部状态栏 ---
  renderStatusBar(W, H, oppIdx, isMyTurn);
}

// --- 顶部栏 ---
function renderTopBar(W, H, oppIdx) {
  const a = LAYOUT.areas.topBar;
  const x = W * a.x, y = H * a.y, w = W * a.w, h = H * a.h;

  ctx.fillStyle = 'rgba(60,30,10,0.06)';
  ctx.fillRect(x, y, w, h);

  // 分隔线
  ctx.strokeStyle = 'rgba(60,30,10,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();

  const oppScore = gameState.totalScores?.[oppIdx] || 0;
  drawText('对手', W * 0.08, y + h * 0.65, 20, COLORS.TEXT_MUTED, 'left');
  drawText(`积分: ${oppScore}`, W * 0.92, y + h * 0.65, 20, COLORS.GOLD_DARK, 'right');
}

// --- 对手手牌 ---
function renderOpponentHand(W, H, oppIdx) {
  const a = LAYOUT.areas.opponentHand;
  const x = W * a.x, y = H * a.y;
  const cw_o = 115 * LAYOUT.cardSizes.opp * Math.min(W / 1920, H / 1080);
  const ch_o = 177 * LAYOUT.cardSizes.opp * Math.min(W / 1920, H / 1080);

  const oppHand = gameState.hands[oppIdx] || [];
  const gap = 6;
  const totalW = oppHand.length * (cw_o + gap);
  const startX = x + (W * a.w - totalW) / 2;

  for (let i = 0; i < oppHand.length; i++) {
    drawCardRaw(startX + i * (cw_o + gap), y, null, cw_o, ch_o);
  }
}

// --- 场牌区 ---
function renderFieldArea(W, H, cw, ch) {
  const a = LAYOUT.areas.field;
  const x = W * a.x, y = H * a.y, w = W * a.w, h = H * a.h;

  // 场牌背景
  ctx.fillStyle = 'rgba(200,184,150,0.4)';
  roundRect(x, y, w, h, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,10,0.15)';
  ctx.lineWidth = 2;
  roundRect(x, y, w, h, 20);
  ctx.stroke();

  // 场牌 - 动态网格
  const field = gameState.field || [];
  const fcW = cw * LAYOUT.cardSizes.field;
  const fcH = ch * LAYOUT.cardSizes.field;

  if (field.length === 0) {
    drawText('场牌区', x + w / 2, y + h / 2, 22, COLORS.TEXT_MUTED);
  } else {
    renderFieldCards(x, y, w, h, field, fcW, fcH);
  }

  // 山札（右上角）
  renderMountain(W, H);

  // 回合指示器
  renderTurnIndicator(W, H);

  // 捕获区
  renderCapturedArea(W, H);
}

// 场牌排列
function renderFieldCards(x, y, w, h, field, cw, ch) {
  const padding = 15;
  const availW = w - padding * 2;
  const availH = h - padding * 2 - 35;

  // 根据场牌数量决定排列
  const count = field.length;
  let cols, rows;

  if (count <= 4) { cols = count; rows = 1; }
  else if (count <= 8) { cols = 4; rows = 2; }
  else { cols = 4; rows = 3; }

  const gridW = availW / cols;
  const gridH = availH / rows;

  // 增大卡牌占比：从 0.7/0.85 提升到 0.88/0.92
  const cardW = Math.min(cw, gridW * 0.88);
  const cardH = Math.min(ch, gridH * 0.92);

  field.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = x + padding + col * gridW + (gridW - cardW) / 2;
    const cy = y + 25 + row * gridH + (gridH - cardH) / 2;
    drawCardRaw(cx, cy, id, cardW, cardH);
  });
}

// --- 山札 ---
function renderMountain(W, H) {
  const deckCount = gameState.deck?.length || 0;
  const mw = 70, mh = 90;
  const mx = W * 0.92 - mw / 2;
  const my = H * 0.19;

  ctx.save();
  ctx.shadowColor = COLORS.SHADOW;
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#5D4037';
  roundRect(mx, my, mw, mh, 8);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#795548';
  ctx.lineWidth = 1.5;
  roundRect(mx, my, mw, mh, 8);
  ctx.stroke();

  drawText('山札', mx + mw / 2, my + mh * 0.38, 16, '#FFF8E1');
  drawText(String(deckCount), mx + mw / 2, my + mh * 0.65, 20, COLORS.GOLD);
}

// --- 回合指示器 ---
function renderTurnIndicator(W, H) {
  if (!gameState) return;
  const isMyTurn = (gameState.currentPlayerIndex === mySeatIndex);

  const iw = 160, ih = 36;
  const ix = W / 2 - iw / 2;
  const iy = H * 0.175;

  ctx.save();
  ctx.shadowColor = isMyTurn ? 'rgba(74,140,92,0.5)' : 'rgba(201,123,90,0.5)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = isMyTurn ? COLORS.TURN_MY : COLORS.TURN_OPP;
  roundRect(ix, iy, iw, ih, 18);
  ctx.fill();
  ctx.restore();

  drawText(
    isMyTurn ? '你的回合' : '对手思考中',
    ix + iw / 2, iy + ih * 0.62, 18, '#fff'
  );
}

// --- 玩家手牌 ---
function renderPlayerHand(W, H, hand, cw, ch, isMyTurn) {
  const a = LAYOUT.areas.playerHand;
  const x = W * a.x, y = H * a.y;

  // 手牌区域提示
  if (!isMyTurn && hand.length > 0) {
    ctx.fillStyle = 'rgba(60,30,10,0.04)';
    roundRect(x - 10, y - 8, W * a.w + 20, H * a.h + 16, 14);
    ctx.fill();
  }

  const gap = 14;
  const totalW = hand.length * cw + (hand.length - 1) * gap;
  const startX = x + (W * a.w - totalW) / 2;

  const now = Date.now();

  hand.forEach((id, i) => {
    let px = startX + i * (cw + gap);
    let py = y;
    let pScale = 1;
    let isPressed = false;

    // 按下反馈动画
    if (pressFeedbackId === id) {
      const elapsed = now - pressFeedbackStart;
      const t = Math.min(elapsed / 100, 1);
      const s = easeOutBack(t);
      pScale = 1 - 0.05 * s;
      py -= 15 * s;
      isPressed = true;
    }

    // 选中（旧逻辑兼容）
    const isSel = (id === selectedCardId);

    // 记录位置用于点击检测
    _cardPositions[id] = { x: px, y: py, w: cw, h: ch };

    drawCardRaw(px, py, id, cw, ch, {
      selected: isSel || isPressed,
      pressed: isPressed,
      pressScale: pScale,
    });
  });
}

// --- 捕获区 ---
function renderCapturedArea(W, H) {
  const fa = LAYOUT.areas.field;
  const scale = Math.min(W / 1920, H / 1080);
  const bottomY = H * (fa.y + fa.h) - 20 * scale;
  const leftX = W * fa.x + 20 * scale;
  const rightX = W * (fa.x + fa.w) - 20 * scale;

  const myCaptured = gameState.captured?.[mySeatIndex] || [];
  const oppIdx = (mySeatIndex + 1) % 2;
  const oppCaptured = gameState.captured?.[oppIdx] || [];

  // 对手捕获数 - 加大标签
  if (oppCaptured.length > 0) {
    const bw = 56 * scale, bh = 26 * scale;
    ctx.save();
    ctx.shadowColor = COLORS.SHADOW;
    ctx.shadowBlur = 4;
    ctx.fillStyle = COLORS.TURN_OPP;
    roundRect(leftX, bottomY - bh, bw, bh, 13 * scale);
    ctx.fill();
    ctx.restore();
    drawText(`${oppCaptured.length}张`, leftX + bw / 2, bottomY - bh * 0.32, 15 * scale, '#fff');
  }

  // 玩家按月分组 - 加大圆圈
  if (myCaptured.length > 0) {
    const circleR = 16 * scale;
    const spacing = 32 * scale;

    // 按月分组计数
    const months = {};
    for (const id of myCaptured) {
      const m = Math.floor(id / 4) + 1;
      months[m] = (months[m] || 0) + 1;
    }

    // 按月份排序
    const sortedMonths = Object.keys(months).map(Number).sort((a, b) => a - b);

    // 从右向左排列，加月份标签
    let cx = rightX;
    for (const m of sortedMonths) {
      const color = COLORS.MONTH_COLORS[m - 1] || '#888';

      // 月份名称标签
      ctx.fillStyle = COLORS.TEXT_MUTED;
      ctx.font = `${10 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${m}月`, cx, bottomY - circleR * 2 - 6 * scale);

      ctx.save();
      ctx.shadowColor = COLORS.SHADOW;
      ctx.shadowBlur = 4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, bottomY - circleR, circleR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 数量显示
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${13 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`×${months[m]}`, cx, bottomY - circleR + 5 * scale);

      cx -= spacing;
    }
  }
}

// --- 底部状态栏 ---
function renderStatusBar(W, H, oppIdx, isMyTurn) {
  const a = LAYOUT.areas.statusBar;
  const y = H * a.y;

  // 背景
  ctx.fillStyle = 'rgba(60,30,10,0.12)';
  ctx.fillRect(0, y, W, H * a.h);

  // 分隔线
  ctx.strokeStyle = 'rgba(60,30,10,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();

  const myScore = gameState.totalScores?.[mySeatIndex] || 0;
  const round = gameState.round || 1;
  const deckCount = gameState.deck?.length || 0;
  const koiCount = gameState.koiKoiCount || 0;

  const barH = H * a.h;
  const textY = y + barH * 0.55;

  drawText(`第${round}局`, W * 0.08, textY, 18, COLORS.TEXT_DARK, 'left');

  const myLabel = isMyTurn ? '你的回合' : '对手回合';
  const myColor = isMyTurn ? COLORS.TURN_MY : COLORS.TURN_OPP;
  drawText(myLabel, W * 0.25, textY, 18, myColor, 'left');

  drawText(`积分: ${myScore}`, W * 0.42, textY, 18, COLORS.GOLD_DARK, 'left');

  if (koiCount > 0) {
    drawText(`Koi ×${koiCount}`, W * 0.58, textY, 18, COLORS.URGENCY, 'left');
  }

  drawText(`剩余: ${deckCount}张`, W * 0.75, textY, 18, COLORS.TEXT_MUTED, 'left');

  // 状态提示
  if (statusMsg) {
    drawText(statusMsg, W * 0.92, textY, 16, COLORS.SAKURA_DARK, 'right');
  }
}

// ================= 动画系统 =================

// 飞行动画卡牌
function playCardWithAnimation(cardId, callback) {
  const pos = _cardPositions[cardId];
  if (!pos) {
    // 如果位置未知，直接发送
    if (callback) callback();
    return;
  }

  // 计算场牌目标位置
  const target = getFieldPlayTarget();

  flyingCards.push({
    cardId,
    startX: pos.x,
    startY: pos.y,
    targetX: target.x,
    targetY: target.y,
    progress: 0,
    duration: CONFIG.ANIM_DURATION,
    onComplete: () => {
      if (callback) callback();
    },
  });

  startAnimLoop();
}

function getFieldPlayTarget() {
  const W = canvas.width, H = canvas.height;
  const a = LAYOUT.areas.field;
  const x = W * a.x, y = H * a.y, w = W * a.w;
  const field = gameState?.field || [];

  const scale = Math.min(W / 1920, H / 1080);
  const cw = 115 * LAYOUT.cardSizes.field * scale;

  // 放在场牌区的中央偏下位置
  return {
    x: x + w / 2 - cw / 2,
    y: y + H * a.h * 0.6,
  };
}

function renderFlyingCards(W, H, cw, ch) {
  for (const fc of flyingCards) {
    const t = easeOutCubic(fc.progress);
    const cx = fc.startX + (fc.targetX - fc.startX) * t;
    const cy = fc.startY + (fc.targetY - fc.startY) * t;

    // 抛物线弧
    const arcOffset = Math.sin(fc.progress * Math.PI) * -30 * Math.min(W / 1920, H / 1080);
    const scale = 1 + Math.sin(fc.progress * Math.PI) * 0.08;

    ctx.save();
    ctx.shadowColor = COLORS.SHADOW_DEEP;
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    drawCardRaw(cx, cy + arcOffset, fc.cardId, cw * scale, ch * scale, { shadow: false });
    ctx.restore();
  }
}

// 动画循环
function startAnimLoop() {
  if (animating) return;
  animating = true;
  lastFrameTime = performance.now();
  rafId = requestAnimationFrame(animLoop);
}

function animLoop() {
  const now = performance.now();
  const dt = Math.min(now - lastFrameTime, 50); // 防止跳帧
  lastFrameTime = now;

  let hasActive = false;

  // 更新飞行动画
  for (let i = flyingCards.length - 1; i >= 0; i--) {
    const fc = flyingCards[i];
    fc.progress += dt / fc.duration;
    if (fc.progress >= 1) {
      fc.progress = 1;
      fc.onComplete();
      flyingCards.splice(i, 1);
    } else {
      hasActive = true;
    }
  }

  // 更新弹窗动画
  if (popupState.animating) {
    const speed = popupState.animIn
      ? dt / CONFIG.MODAL_ANIM_IN
      : dt / CONFIG.MODAL_ANIM_OUT;
    popupState.animProgress += popupState.animIn ? speed : -speed;

    if (popupState.animProgress >= 1) {
      popupState.animProgress = 1;
      popupState.animating = false;
    } else if (popupState.animProgress <= 0) {
      popupState.animProgress = 0;
      popupState.animating = false;
      popupState.show = false;
      currentState = STATE.GAME;
      hasActive = true;
      render();
      return;
    } else {
      hasActive = true;
    }
  }

  // 按下反馈
  if (pressFeedbackId !== null) {
    hasActive = true;
  }

  render();

  if (hasActive || flyingCards.length > 0 || popupState.animating) {
    rafId = requestAnimationFrame(animLoop);
  } else {
    animating = false;
    rafId = null;
  }
}

// ================= 弹窗系统 =================
function renderPopup(W, H) {
  if (popupState.yakuHelp) {
    drawYakuHelp(W, H);
    return;
  }
  if (!popupState.show) return;

  const alpha = popupState.animProgress;
  const scale = 0.8 + 0.2 * easeOutBack(Math.min(alpha, 1));

  // 遮罩
  ctx.fillStyle = `rgba(45,25,15,${0.55 * alpha})`;
  ctx.fillRect(0, 0, W, H);

  const pw = Math.min(W * 0.65, 520);
  const ph = H * 0.48;
  const px = W / 2 - pw / 2;
  const py = H / 2 - ph / 2;

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -H / 2);

  // 弹窗背景
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = COLORS.MODAL_BG;
  roundRect(px, py, pw, ph, 16);
  ctx.fill();
  ctx.restore();

  // 边框
  ctx.strokeStyle = COLORS.MODAL_BORDER;
  ctx.lineWidth = 2;
  roundRect(px, py, pw, ph, 16);
  ctx.stroke();

  // 内容
  renderPopupContent(W, H, px, py, pw, ph);

  ctx.restore();
}

function renderPopupContent(W, H, px, py, pw, ph) {
  // 标题
  drawText('役达成！', W / 2, py + ph * 0.16, 30, COLORS.SAKURA_DARK);

  // 分割线
  ctx.strokeStyle = 'rgba(60,30,10,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 25, py + ph * 0.24);
  ctx.lineTo(px + pw - 25, py + ph * 0.24);
  ctx.stroke();

  // 役列表
  if (popupState.yakuList && popupState.yakuList.length > 0) {
    let y = py + ph * 0.36;
    popupState.yakuList.forEach((yaku) => {
      drawText(yaku.label, W / 2, y, 20, COLORS.TEXT_DARK);
      drawText(`${yaku.points}分`, W / 2, y + 24, 18, COLORS.GOLD_DARK);
      y += 48;
    });
  }

  drawText('继续则分数翻倍，对手先结束则0分', W / 2, py + ph * 0.65, 15, COLORS.TEXT_MUTED);

  // 按钮
  const bw = pw * 0.32, bh = ph * 0.12;
  drawBtn('继续 (×2)', px + pw * 0.12, py + ph * 0.75, bw, bh, COLORS.BTN_SUCCESS, () => {
    popupState.show = false;
    popupState.animIn = false;
    popupState.animating = true;
    startAnimLoop();
    send('koi_koi');
  });
  drawBtn('结算', px + pw * 0.56, py + ph * 0.75, bw, bh, COLORS.BTN_DANGER, () => {
    popupState.show = false;
    popupState.animIn = false;
    popupState.animating = true;
    startAnimLoop();
    send('end_round');
  });
}

// ================= 役说明帮助 =================
function drawYakuHelp(W, H) {
  ctx.fillStyle = COLORS.MODAL_OVERLAY;
  ctx.fillRect(0, 0, W, H);

  const pw = Math.min(W * 0.8, 600);
  const ph = H * 0.75;
  const px = W / 2 - pw / 2;
  const py = H / 2 - ph / 2;

  ctx.fillStyle = COLORS.MODAL_BG;
  roundRect(px, py, pw, ph, 16);
  ctx.fill();
  ctx.strokeStyle = COLORS.MODAL_BORDER;
  ctx.lineWidth = 2;
  roundRect(px, py, pw, ph, 16);
  ctx.stroke();

  drawText('役说明', W / 2, py + 40, 30, COLORS.TEXT_DARK);
  drawText('达成役获得分数，先达到7分者获胜', W / 2, py + 72, 16, COLORS.TEXT_MUTED);

  let y = py + 105;
  const lineHeight = 26;

  const sections = [
    { title: '光牌役', items: ['五光 (5张): 10分', '四光 (4张): 8分', '雨四光 (含柳): 7分', '三光 (3张): 6分'] },
    { title: '短册役', items: ['赤短: 5分', '青短: 5分', '短册×5: 1分', '短册×6: 2分', '短册×7: 3分', '短册×8: 4分'] },
    { title: '种牌役', items: ['猪鹿蝶 (7+9+10月): 5分', '种×5: 1分', '种×6: 2分', '种×7: 3分', '种×8: 4分'] },
    { title: 'カス役', items: ['カス×10: 1分', '每多1张 +1分'] },
    { title: '特殊役', items: ['呑み (3+8月+杯): 4分', '花见酒 (3月+杯): 3分', '月见酒 (8月+杯): 3分'] },
  ];

  for (const sec of sections) {
    ctx.fillStyle = COLORS.SAKURA_DARK;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(sec.title, px + 25, y);
    y += lineHeight;

    ctx.fillStyle = COLORS.TEXT_DARK;
    ctx.font = '15px sans-serif';
    for (const item of sec.items) {
      ctx.fillText(item, px + 40, y);
      y += lineHeight - 4;
    }
    y += 10;
  }

  const bw = pw * 0.35, bh = 48;
  drawBtn('返回', W / 2 - bw / 2, py + ph - 65, bw, bh, COLORS.BTN_PRIMARY, () => {
    popupState.show = false;
    popupState.yakuHelp = false;
    currentState = STATE.MENU;
    render();
  });
}

// ================= 结算界面 =================
function drawResultScreen(W, H) {
  drawBg();

  ctx.fillStyle = COLORS.MODAL_OVERLAY;
  ctx.fillRect(0, 0, W, H);

  const pw = Math.min(W * 0.65, 560);
  const ph = H * 0.55;
  const px = W / 2 - pw / 2;
  const py = H / 2 - ph / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = COLORS.MODAL_BG;
  roundRect(px, py, pw, ph, 16);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = COLORS.MODAL_BORDER;
  ctx.lineWidth = 2;
  roundRect(px, py, pw, ph, 16);
  ctx.stroke();

  const isWin = resultData?.winner === mySeatIndex;
  drawText(
    isWin ? '恭喜获胜！' : '惜败...',
    W / 2, py + ph * 0.18, 36, isWin ? COLORS.TURN_MY : COLORS.SAKURA_DARK
  );

  if (resultData?.scores) {
    const myS = resultData.scores[mySeatIndex] || 0;
    const oppS = resultData.scores[(mySeatIndex + 1) % 2] || 0;

    ctx.fillStyle = COLORS.SAKURA_BG;
    roundRect(px + 30, py + ph * 0.3, pw - 60, 50, 10);
    ctx.fill();

    drawText(`你的积分: ${myS}`, W / 2, py + ph * 0.4, 24, COLORS.TEXT_DARK);
    drawText(`对手积分: ${oppS}`, W / 2, py + ph * 0.52, 22, COLORS.TEXT_MUTED);
  }

  // 役详情（如果有）
  if (resultData?.yaku && resultData.yaku.length > 0) {
    let y = py + ph * 0.6;
    ctx.fillStyle = COLORS.TEXT_MUTED;
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('役达成:', px + 30, y);
    y += 24;

    ctx.font = '15px sans-serif';
    resultData.yaku.forEach((yk) => {
      ctx.fillStyle = COLORS.TEXT_DARK;
      ctx.fillText(`${yk.label}  ${yk.points}分`, px + 45, y);
      y += 22;
    });
  }

  const bw = pw * 0.35, bh = 50;
  drawBtn('返回大厅', W / 2 - bw / 2, py + ph * 0.8, bw, bh, COLORS.BTN_PRIMARY, () => {
    currentState = STATE.LOBBY;
    resultData = null;
    render();
  });
}

// ================= 输入处理 =================
let touchStartPos = null;
let touchStartTime = 0;

canvas.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  const x = touch.clientX;
  const y = touch.clientY;

  // 弹窗优先
  if (popupState.show && !popupState.yakuHelp) {
    // 检查弹窗按钮
    for (let btn of _buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        btn.onClick();
        return;
      }
    }
    return;
  }

  // 役说明
  if (popupState.yakuHelp) {
    for (let btn of _buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        btn.onClick();
        return;
      }
    }
    return;
  }

  // 按钮点击
  for (let btn of _buttons) {
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
      btn.onClick();
      return;
    }
  }

  // 游戏状态：手牌触摸
  if (currentState === STATE.GAME && gameState) {
    const isMyTurn = (gameState.currentPlayerIndex === mySeatIndex);
    if (!isMyTurn) return;

    const myHand = gameState.hands[mySeatIndex] || [];

    // 从后往前检查（最上面的牌优先）
    for (let i = myHand.length - 1; i >= 0; i--) {
      const id = myHand[i];
      const pos = _cardPositions[id];
      if (!pos) continue;

      if (x >= pos.x && x <= pos.x + pos.w && y >= pos.y && y <= pos.y + pos.h) {
        touchStartPos = { x, y };
        touchStartTime = Date.now();
        pressFeedbackId = id;
        pressFeedbackStart = Date.now();

        // 启动振动反馈
        try { wx.vibrateShort({ type: 'light' }); } catch (e) {}

        if (!animating) {
          render();
        }
        return;
      }
    }
  }
});

canvas.addEventListener('touchend', (e) => {
  const touch = e.changedTouches[0];
  if (!touch) return;
  const x = touch.clientX;
  const y = touch.clientY;

  // 如果有按下反馈的牌
  if (pressFeedbackId !== null) {
    const elapsed = Date.now() - pressFeedbackStart;
    const cardId = pressFeedbackId;

    // 检查是否在牌区域内抬起（短按 = 出牌）
    if (elapsed < 300) {
      // 触发飞行动画
      playCardWithAnimation(cardId, () => {
        // 动画完成后发送网络消息
        send('play_card', cardId);
        statusMsg = `打出卡牌`;
      });
    }

    pressFeedbackId = null;
    touchStartPos = null;

    if (!animating) {
      render();
    }
  }
});

// ================= 网络通信 =================
function connectServer() {
  wx.connectSocket({
    url: CONFIG.SERVER_URL,
    success: () => console.log('[Socket] 连接中...'),
    fail: (err) => console.error('[Socket] 连接失败:', err)
  });

  wx.onSocketOpen(() => {
    console.log('[Socket] WebSocket 已打开，等待 Socket.IO 握手...');
  });

  wx.onSocketMessage((res) => {
    const rawData = res.data;
    console.log('[Socket] 原始消息:', rawData.substring(0, 300));

    try {
      const type = rawData.charAt(0);

      if (type === '0') {
        // Engine.IO open 帧: 0{"sid":"...","upgrades":[],"pingInterval":...}
        console.log('[Socket] Engine.IO 握手成功');
        // 直接发送 Socket.IO connect 帧（不需要 probe 升级，因为 WebSocket 已是唯一传输）
        wx.sendSocketMessage({ data: '40' });
      } else if (type === '3') {
        // Engine.IO pong - 保持心跳
      } else if (type === '1') {
        // close
        console.warn('[Socket] 服务器关闭连接');
      } else if (type === '2') {
        // Engine.IO ping → 回复 pong
        wx.sendSocketMessage({ data: '3' });
      } else if (type === '4') {
        // Socket.IO 消息，格式: 42["event", payload] 或 40 (connect)
        const subType = rawData.charAt(1);

        if (subType === '0') {
          // Socket.IO 连接确认 (40)
          console.log('[Socket] Socket.IO 已连接');
          socketConnected = true;
          statusMsg = '已连接服务器';
          setTimeout(() => { statusMsg = ''; render(); }, 2000);
        } else if (subType === '2') {
          // 事件消息: 42["event_name", {payload}]
          const payload = rawData.substring(2);
          const arr = JSON.parse(payload);
          const event = arr[0];
          const data = arr[1] || {};
          console.log('[Socket] 事件:', event);
          handleServerMessage({ event, ...data });
        } else if (subType === '6') {
          // noop (46)
        } else {
          console.log('[Socket] 未知子类型:', subType, '数据:', rawData.substring(0, 100));
        }
      } else {
        console.log('[Socket] 未知类型:', type, '数据:', rawData.substring(0, 100));
      }
    } catch (err) {
      console.error('[Socket] 解析失败:', err, '数据:', rawData.substring(0, 200));
    }
  });

  wx.onSocketClose(() => {
    socketConnected = false;
    console.warn('[Socket] 连接关闭');
    statusMsg = '服务器断开';
  });
}

function send(event, payload) {
  if (!socketConnected) {
    console.warn('[Socket] 连接未建立:', event);
    return;
  }
  // Socket.IO 协议: 42["event", payload]
  const data = payload !== undefined ? [event, payload] : [event];
  const framed = '42' + JSON.stringify(data);
  console.log('[Socket] 发送:', event, payload);
  wx.sendSocketMessage({
    data: framed,
    success: () => console.log('[Socket] 发送成功:', event),
    fail: (err) => console.error('[Socket] 发送失败:', event, err)
  });
}

function handleServerMessage(data) {
  switch (data.event) {
    case 'game_state':
      gameState = data.state;
      statusMsg = '游戏进行中';
      break;
    case 'room_created':
      myRoomId = data.room?.id || data.roomId;
      playerCount = data.room?.players?.length || 1;
      mySeatIndex = data.mySeatIndex || 0;
      statusMsg = `房间已创建: ${myRoomId}`;
      currentState = STATE.LOBBY;
      break;
    case 'room_joined':
      myRoomId = data.room?.id || data.roomId;
      playerCount = data.room?.players?.length || 1;
      mySeatIndex = data.mySeatIndex || 0;
      statusMsg = `已加入: ${myRoomId}`;
      currentState = STATE.LOBBY;
      break;
    case 'game_start':
    case 'game_started':
      currentState = STATE.GAME;
      gameState = data.state;
      statusMsg = '游戏开始！';
      break;
    case 'player_joined':
      playerCount = data.room?.players?.length || playerCount;
      statusMsg = '玩家已加入！';
      break;
    case 'state_update':
      gameState = data.state;
      if (data.koiCount !== undefined) {
        statusMsg = `Koi ×${data.koiCount}`;
      }
      break;
    case 'yaku_found':
      currentState = STATE.POPUP;
      popupState.show = true;
      popupState.yakuList = data.yaku || [];
      popupState.animProgress = 0;
      popupState.animating = true;
      popupState.animIn = true;
      startAnimLoop();
      break;
    case 'round_end':
      showRoundResult(data);
      break;
    case 'game_end':
      showRoundResult(data);
      break;
    case 'error':
      statusMsg = `错误: ${data.message}`;
      wx.showToast({ title: data.message, icon: 'none', duration: 3000 });
      break;
  }

  render();
}

function showRoundResult(data) {
  currentState = STATE.RESULT;
  // 统一字段：服务器发送 totalScores，客户端期望 scores
  resultData = {
    scores: data.totalScores || data.scores,
    roundScores: data.roundScores,
    winner: data.winner,
    gameOver: data.gameOver,
    yaku: data.yaku,
  };
  render();
}

function promptJoin() {
  wx.showModal({
    title: '加入房间',
    content: '请输入房间号',
    editable: true,
    placeholderText: '房间号',
    success: (res) => {
      if (res.confirm && res.content) {
        send('join_room', res.content.trim());
      }
    }
  });
}

// ================= 初始化 =================
connectServer();
loadCardImages(() => {
  currentState = STATE.MENU;
  render();
});

// ================= 单机测试模式 =================
let testModeState = null;

function startSinglePlayerTest() {
  console.log('[单机测试] 启动');
  testModeState = {
    field: [],
    hand: [],
    captured: [],
    deck: []
  };

  const deck = [];
  for (let i = 0; i < 48; i++) deck.push(i);
  shuffle(deck);

  testModeState.field = deck.slice(0, 8);
  testModeState.hand = deck.slice(8, 16);
  testModeState.deck = deck.slice(16);

  currentState = STATE.GAME;
  statusMsg = '单机测试 - 点击手牌出牌';
  render();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function getCardMonth(cardId) {
  return Math.floor(cardId / 4) + 1;
}

function renderTestMode(W, H, cw, ch) {
  drawBg();
  if (!testModeState) return;

  // 场牌区
  const fa = LAYOUT.areas.field;
  const fX = W * fa.x, fY = H * fa.y, fW = W * fa.w, fH = H * fa.h;
  const fcW = cw * LAYOUT.cardSizes.field, fcH = ch * LAYOUT.cardSizes.field;

  ctx.fillStyle = 'rgba(200,184,150,0.4)';
  roundRect(fX, fY, fW, fH, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,10,0.15)';
  ctx.lineWidth = 2;
  roundRect(fX, fY, fW, fH, 20);
  ctx.stroke();

  // 场牌排列
  if (testModeState.field.length > 0) {
    const padding = 15;
    const field = testModeState.field;
    const count = field.length;
    let cols, rows;
    if (count <= 4) { cols = count; rows = 1; }
    else if (count <= 8) { cols = 4; rows = 2; }
    else { cols = 4; rows = 3; }

    const gridW = (fW - padding * 2) / cols;
    const gridH = (fH - padding * 2 - 35) / rows;
    const cardW = Math.min(fcW, gridW * 0.88);
    const cardH = Math.min(fcH, gridH * 0.92);

    field.forEach((id, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = fX + padding + col * gridW + (gridW - cardW) / 2;
      const cy = fY + 25 + row * gridH + (gridH - cardH) / 2;
      drawCardRaw(cx, cy, id, cardW, cardH);
    });
  } else {
    drawText('场牌区', fX + fW / 2, fY + fH / 2, 22, COLORS.TEXT_MUTED);
  }

  // 山札
  const mw = 70, mh = 90;
  const scale = Math.min(W / 1920, H / 1080);
  const mx = W * 0.92 - mw / 2;
  const my = H * 0.19;
  ctx.fillStyle = '#5D4037';
  roundRect(mx, my, mw, mh, 8);
  ctx.fill();
  ctx.strokeStyle = '#795548';
  ctx.lineWidth = 1.5;
  roundRect(mx, my, mw, mh, 8);
  ctx.stroke();
  drawText('山札', mx + mw / 2, my + mh * 0.38, 16 * scale, '#FFF8E1');
  drawText(String(testModeState.deck.length), mx + mw / 2, my + mh * 0.65, 20 * scale, COLORS.GOLD);

  // 玩家手牌
  const pa = LAYOUT.areas.playerHand;
  const pX = W * pa.x, pY = H * pa.y;
  const gap = 14 * scale;
  const handW = testModeState.hand.length * cw + (testModeState.hand.length - 1) * gap;
  const handStart = pX + (W * pa.w - handW) / 2;

  testModeState.hand.forEach((id, i) => {
    _cardPositions[id] = { x: handStart + i * (cw + gap), y: pY, w: cw, h: ch };
    drawCardRaw(handStart + i * (cw + gap), pY, id, cw, ch);
  });

  // 收集区（右侧）
  const capCount = testModeState.captured.length;
  if (capCount > 0) {
    const months = {};
    for (const id of testModeState.captured) {
      const m = Math.floor(id / 4) + 1;
      months[m] = (months[m] || 0) + 1;
    }
    const sortedMonths = Object.keys(months).map(Number).sort((a, b) => a - b);

    const rightX = W * (fa.x + fa.w) - 20 * scale;
    const bottomY = H * (fa.y + fa.h) - 20 * scale;
    const circleR = 16 * scale;
    const spacing = 32 * scale;
    let cx = rightX;

    for (const m of sortedMonths) {
      const color = COLORS.MONTH_COLORS[m - 1] || '#888';
      ctx.fillStyle = COLORS.TEXT_MUTED;
      ctx.font = `${10 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${m}月`, cx, bottomY - circleR * 2 - 6 * scale);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, bottomY - circleR, circleR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${13 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`×${months[m]}`, cx, bottomY - circleR + 5 * scale);
      cx -= spacing;
    }
  }

  // 回合指示器
  const iw = 160 * scale, ih = 36 * scale;
  const ix = W / 2 - iw / 2;
  const iy = H * 0.175;
  ctx.fillStyle = COLORS.TURN_MY;
  roundRect(ix, iy, iw, ih, 18 * scale);
  ctx.fill();
  drawText('你的回合', ix + iw / 2, iy + ih * 0.62, 18 * scale, '#fff');

  // 底部状态栏
  const sbY = H * 0.84;
  ctx.fillStyle = 'rgba(60,30,10,0.12)';
  ctx.fillRect(0, sbY, W, H * 0.16);
  drawText('单机测试', W * 0.08, sbY + H * 0.08, 20 * scale, COLORS.TEXT_DARK, 'left');
  drawText(`剩余: ${testModeState.deck.length}张`, W * 0.75, sbY + H * 0.08, 18 * scale, COLORS.TEXT_MUTED, 'left');
  drawText(`已收集: ${capCount}张`, W * 0.92, sbY + H * 0.08, 16 * scale, COLORS.SAKURA_DARK, 'right');

  drawText(statusMsg, W / 2, H - 20, 18 * scale, COLORS.GOLD_DARK);
}

// 测试模式输入
canvas.addEventListener('touchstart', function(e) {
  if (!testModeState || currentState !== STATE.GAME) return;

  // 优先检查全局按钮
  for (let btn of _buttons) {
    const touch = e.touches[0];
    if (touch && touch.clientX >= btn.x && touch.clientX <= btn.x + btn.w &&
        touch.clientY >= btn.y && touch.clientY <= btn.y + btn.h) {
      return; // 按钮由主 handler 处理
    }
  }

  const touch = e.touches[0];
  if (!touch) return;
  const x = touch.clientX, y = touch.clientY;

  for (let i = testModeState.hand.length - 1; i >= 0; i--) {
    const id = testModeState.hand[i];
    const pos = _cardPositions[id];
    if (!pos) continue;

    if (x >= pos.x && x <= pos.x + pos.w && y >= pos.y && y <= pos.y + pos.h) {
      handleTestModePlay(id);
      return;
    }
  }
});

function handleTestModePlay(cardId) {
  const fieldMonth = testModeState.field.map(id => getCardMonth(id));
  const cardMonth = getCardMonth(cardId);
  const matchIdx = fieldMonth.indexOf(cardMonth);

  if (matchIdx >= 0) {
    const matched = testModeState.field[matchIdx];
    testModeState.field.splice(matchIdx, 1);
    testModeState.captured.push(cardId, matched);
    testModeState.hand = testModeState.hand.filter(id => id !== cardId);

    if (testModeState.hand.length === 0 && testModeState.deck.length > 0) {
      const dealCount = Math.min(8, testModeState.deck.length);
      testModeState.hand = testModeState.deck.slice(0, dealCount);
      testModeState.deck = testModeState.deck.slice(dealCount);
    }

    statusMsg = `配对！${cardMonth}月 ×2`;
  } else {
    testModeState.field.push(cardId);
    testModeState.hand = testModeState.hand.filter(id => id !== cardId);
    statusMsg = `打出 ${cardMonth}月（未匹配）`;
  }

  render();
}
