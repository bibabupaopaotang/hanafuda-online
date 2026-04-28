/**
 * 花札 Hanafuda - 视觉+交互终极完整版
 * 视觉：12个月份Canvas手绘卡牌 + 4种类型标识 + 精美UI
 * 交互：点击即出 + 抛物线动画 + 回合倒计时 + 自定义弹窗
 */

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

// ================= 配置 =================
const CONFIG = {
  SERVER_URL: 'ws://47.253.96.212/socket.io/?EIO=4&transport=websocket',
  CARD_W: 50,
  CARD_H: 80,
  ANIM_DURATION: 400, // ms
  TURN_TIMEOUT: 15000 // ms
};

// ================= 常量 =================
const STATE = { MENU: 0, LOBBY: 1, GAME: 2, RESULT: 3, POPUP: 4 };
const MONTHS = ['', '松', '梅', '桜', '藤', '菖蒲', '牡丹', '萩', '芒', '菊', '紅葉', '柳', '桐'];
const MONTH_COLORS = [
  '#000000', // 0 unused
  '#C62828', // 1 松 红
  '#E91E63', // 2 梅 粉
  '#F48FB1', // 3 桜 樱粉
  '#9C27B0', // 4 藤 紫
  '#673AB7', // 5 菖蒲 蓝紫
  '#E91E63', // 6 牡丹 粉红
  '#4CAF50', // 7 萩 绿红
  '#FFC107', // 8 芒 金
  '#FF9800', // 9 菊 橙
  '#F44336', // 10 紅葉 红橙
  '#2196F3', // 11 柳 蓝
  '#3F51B5', // 12 桐 深蓝
];
const LIGHT_IDS = [0, 8, 28, 40, 44];

// ================= 状态变量 =================
let currentState = STATE.MENU;
let myRoomId = '';
let playerCount = 0;
let gameState = null;
let resultData = null;
let selectedCardId = null;
let statusMsg = '初始化中...';
let turnTimer = null;
let turnTimeLeft = CONFIG.TURN_TIMEOUT;

// 动画系统
let animatingCard = null; // {id, fromX, fromY, toX, toY, startTime, duration}
let popupState = { show: false, type: 'yaku', animProgress: 0 };

// 按钮列表
let _buttons = [];

// ================= 主渲染循环 =================
function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  _buttons = [];

  if (currentState === STATE.MENU) drawMenu(W, H);
  else if (currentState === STATE.LOBBY) drawLobby(W, H);
  else if (currentState === STATE.GAME) drawGameScene(W, H);
  else if (currentState === STATE.RESULT) drawResultScreen(W, H);
  else if (currentState === STATE.POPUP) { drawGameScene(W, H); drawPopup(W, H); }

  // 如果有动画，持续渲染
  if (animatingCard) {
    const progress = Math.min((Date.now() - animatingCard.startTime) / animatingCard.duration, 1);
    if (progress < 1) {
      drawAnimatingCard(progress);
      requestAnimationFrame(render);
      return;
    } else {
      animatingCard = null;
    }
  }
}

// ================= 背景绘制 =================
function drawBg() {
  const W = canvas.width, H = canvas.height;
  // 深绿渐变桌布
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a472a');
  grad.addColorStop(1, '#0b3d1e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // 细密网格纹理
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

// ================= UI 组件 =================
function drawText(t, x, y, f, c) {
  ctx.fillStyle = c; ctx.font = f; ctx.textAlign = 'center'; ctx.fillText(t, x, y);
}

function drawBtn(text, x, y, w, h, color, onClick, disabled = false) {
  ctx.fillStyle = disabled ? '#555' : color;
  roundRect(x, y, w, h, 8);
  ctx.fill();
  // 按钮阴影
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(x, y+2, w, h, 8);
  ctx.fill();
  ctx.fillStyle = disabled ? '#888' : '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w/2, y + h/2 + 6);
  if (!disabled) _buttons.push({ x, y, w, h, onClick });
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

// ================= 界面 1：菜单 =================
function drawMenu(W, H) {
  drawBg();
  // 标题
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(255,215,0,0.5)';
  ctx.shadowBlur = 15;
  ctx.fillText('🌸 花札 Hanafuda 🌸', W/2, 150);
  ctx.shadowBlur = 0;

  drawBtn('创建房间', W/2-120, 250, 240, 60, '#4CAF50', () => {
    statusMsg = '创建中...'; render(); send('create_room');
  });
  drawBtn('加入房间', W/2-120, 330, 240, 60, '#2196F3', () => promptJoin());
  drawText(statusMsg, W/2, H-50, '16px sans-serif', '#aaa');
}

// ================= 界面 2：大厅 =================
function drawLobby(W, H) {
  drawBg();
  drawText('🏠 房间大厅', W/2, 120, 'bold 30px serif', '#fff');
  drawText(`房间号：${myRoomId}`, W/2, 180, '24px sans-serif', '#ffcc00');
  drawText(`人数：${playerCount} / 2`, W/2, 230, '20px sans-serif', '#fff');

  drawBtn('开始游戏', W/2-120, 350, 240, 60, '#FF9800', () => {
    statusMsg = '请求开始...'; render(); send('start_game');
  });
  drawText('提示：目前支持单人测试', W/2, 430, '14px sans-serif', '#aaa');
}

// ================= 界面 3：游戏场景 =================
function drawGameScene(W, H) {
  drawBg();
  if (!gameState) { drawText('等待发牌...', W/2, H/2, '30px sans-serif', '#fff'); return; }

  // --- 对手手牌 (顶部) ---
  drawText('对手', 50, 25, '14px sans-serif', '#aaa');
  const oppHand = gameState.hands[1] || [];
  for (let i = 0; i < oppHand.length; i++) drawCardBack(20 + i * 40, 35);

  // --- 场牌区 (中间) ---
  ctx.fillStyle = '#082d15'; roundRect(10, 90, W-20, 170, 10); ctx.fill();
  ctx.strokeStyle = '#2e5c3e'; ctx.lineWidth = 2; roundRect(10, 90, W-20, 170, 10); ctx.stroke();
  drawText('场牌区', W/2, 110, '14px sans-serif', '#558855');

  const field = gameState.field || [];
  const fStart = (W - field.length * (CONFIG.CARD_W + 6)) / 2;
  field.forEach((id, i) => drawCard(fStart + i * (CONFIG.CARD_W + 6), 120, id, false));

  // --- 山札 (右) ---
  ctx.fillStyle = '#5D4037'; roundRect(W-70, 100, 50, 80, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('山札', W-45, 120); ctx.fillText(`${gameState.deck.length}`, W-45, 140);

  // --- 回合指示器 ---
  drawTurnIndicator(W, H);

  // --- 玩家手牌 (底部) ---
  const myHand = gameState.hands[0] || [];
  const hStart = (W - myHand.length * (CONFIG.CARD_W + 4)) / 2;
  myHand.forEach((id, i) => {
    const y = (id === selectedCardId) ? 430 : 450;
    drawCard(hStart + i * (CONFIG.CARD_W + 4), y, id, id === selectedCardId);
  });

  // --- 状态提示 ---
  drawText(statusMsg, W/2, H-15, 'bold 16px sans-serif', '#ffcc00');
}

function drawTurnIndicator(W, H) {
  if (!gameState) return;
  const isMyTurn = gameState.currentPlayerIndex === 0;
  const x = W - 160, y = 10, w = 150, h = 30;

  ctx.fillStyle = isMyTurn ? 'rgba(76,175,80,0.8)' : 'rgba(255,152,0,0.8)';
  roundRect(x, y, w, h, 15); ctx.fill();

  if (isMyTurn) {
    drawText('✋ 你的回合', x + w/2, y + 20, 'bold 14px sans-serif', '#fff');
  } else {
    drawText('⏳ 对手回合', x + w/2, y + 20, 'bold 14px sans-serif', '#fff');
  }
}

// ================= 界面 4：结算 =================
function drawResultScreen(W, H) {
  drawBg();
  // 遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
  // 面板
  ctx.fillStyle = '#fff'; roundRect(W/2-140, H/2-110, 280, 220, 12); ctx.fill();
  ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 3; roundRect(W/2-140, H/2-110, 280, 220, 12); ctx.stroke();

  drawText('🏁 本局结束', W/2, H/2-70, 'bold 22px sans-serif', '#333');

  if (resultData) {
    const s = resultData.roundScores;
    drawText(`本局：${s[0]} - ${s[1]}`, W/2, H/2-30, '18px sans-serif', '#555');
    drawText(`累计：${resultData.totalScores[0]} - ${resultData.totalScores[1]}`, W/2, H/2, 'bold 20px sans-serif', '#000');
    if (resultData.gameOver) drawText('游戏结束！', W/2, H/2+35, 'bold 18px sans-serif', '#D32F2F');
  }

  drawBtn('返回大厅', W/2-90, H/2+55, 180, 45, '#4CAF50', () => {
    currentState = STATE.LOBBY; gameState = null; resultData = null; render();
  });
}

// ================= 弹窗 =================
function drawPopup(W, H) {
  if (!popupState.show) return;
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, W, H);

  // 面板弹跳
  const scale = easeOutBack(popupState.animProgress);
  const pw = 260, ph = 170;
  const px = W/2 - pw/2 * scale, py = H/2 - ph/2 * scale;
  const pw2 = pw * scale, ph2 = ph * scale;

  ctx.fillStyle = '#fff'; roundRect(px, py, pw2, ph2, 12 * scale); ctx.fill();
  ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; roundRect(px, py, pw2, ph2, 12 * scale); ctx.stroke();

  drawText('🎉 役达成！', W/2, py + 40 * scale, 'bold 20px sans-serif', '#D32F2F');
  drawText('是否继续 (Koi-Koi)?', W/2, py + 75 * scale, '16px sans-serif', '#333');
  drawText('继续则分数翻倍，对手先结束则 0 分', W/2, py + 100 * scale, '12px sans-serif', '#888');

  drawBtn('继续 (x2)', W/2-100, py + 115*scale, 90, 40*scale, '#4CAF50', () => {
    popupState.show = false; send('koi_koi'); statusMsg = '继续游戏！'; render();
  });
  drawBtn('结算', W/2+10, py + 115*scale, 90, 40*scale, '#f44336', () => {
    popupState.show = false; send('end_round'); statusMsg = '结算中...'; render();
  });
}

// ================= 卡牌绘制 =================
function drawCard(x, y, id, selected = false) {
  const month = Math.floor(id / 4) + 1;
  const cat = id % 4; // 0:光 1:短 2:种 3:カス
  const isLight = LIGHT_IDS.includes(id);
  const color = MONTH_COLORS[month];

  // 阴影
  ctx.shadowBlur = selected ? 15 : 5;
  ctx.shadowColor = selected ? '#FFD700' : 'rgba(0,0,0,0.4)';
  ctx.shadowOffsetY = selected ? -10 : 2;

  // 卡牌底色
  ctx.fillStyle = '#FFFDE7';
  roundRect(x, y, CONFIG.CARD_W, CONFIG.CARD_H, 4);
  ctx.fill();

  // 边框
  ctx.strokeStyle = isLight ? '#FFD700' : (selected ? '#FFD700' : '#999');
  ctx.lineWidth = isLight ? 2 : 1;
  roundRect(x, y, CONFIG.CARD_W, CONFIG.CARD_H, 4);
  ctx.stroke();

  // 发光效果（光牌）
  if (isLight) {
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 8;
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1;
    roundRect(x+2, y+2, CONFIG.CARD_W-4, CONFIG.CARD_H-4, 3);
    ctx.stroke();
  }

  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // 左上角类型标记
  const catText = ['光', '短', '种', 'カ'][cat];
  const catColor = ['#FFD700', '#E91E63', '#4CAF50', '#9E9E9E'][cat];
  ctx.fillStyle = catColor;
  ctx.beginPath(); ctx.arc(x+10, y+10, 7, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(catText, x+10, y+13);

  // 月份图案（圆形色块）
  ctx.fillStyle = color + '33'; // 透明度
  ctx.beginPath(); ctx.arc(x+CONFIG.CARD_W/2, y+CONFIG.CARD_H/2-5, 15, 0, Math.PI*2); ctx.fill();

  // 月份文字
  ctx.fillStyle = isLight ? '#D4AF37' : '#333';
  ctx.font = `bold ${isLight ? 14 : 12}px sans-serif`;
  ctx.fillText(MONTHS[month], x + CONFIG.CARD_W/2, y + CONFIG.CARD_H/2 + 5);
}

function drawCardBack(x, y) {
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 4;
  ctx.fillStyle = '#2E7D32'; roundRect(x, y, 30, 45, 3); ctx.fill();
  ctx.strokeStyle = '#1B5E20'; ctx.lineWidth = 1; roundRect(x, y, 30, 45, 3); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#4CAF50'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('花', x+15, y+26);
}

// ================= 动画系统 =================
function drawAnimatingCard(progress) {
  if (!animatingCard) return;
  const a = animatingCard;
  const eased = easeOutCubic(progress);
  const cx = a.fromX + (a.toX - a.fromX) * eased;
  const cy = a.fromY + (a.toY - a.fromY) * eased - Math.sin(progress * Math.PI) * 30; // 弧线
  drawCard(cx, cy, a.id, true);
}

function playCardAnim(id, fromX, fromY, toX, toY) {
  animatingCard = { id, fromX, fromY, toX, toY, startTime: Date.now(), duration: CONFIG.ANIM_DURATION };
  requestAnimationFrame(render);
}

// ================= 缓动函数 =================
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t) { const c=1.70158; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); }

// ================= 交互系统 =================
let longPressTimer = null;

wx.onTouchStart(e => {
  const t = e.touches[0];
  const x = t.clientX, y = t.clientY;

  // 1. 弹窗优先
  if (currentState === STATE.POPUP) {
    if (x > canvas.width/2-100 && x < canvas.width/2-10 && y > canvas.height/2+40 && y < canvas.height/2+75) {
      popupState.show = false; send('koi_koi'); statusMsg='继续！'; render(); return;
    }
    if (x > canvas.width/2+10 && x < canvas.width/2+100 && y > canvas.height/2+40 && y < canvas.height/2+75) {
      popupState.show = false; send('end_round'); statusMsg='结算中...'; render(); return;
    }
    return;
  }

  // 2. 按钮点击
  for (const b of _buttons) {
    if (x>b.x && x<b.x+b.w && y>b.y && y<b.y+b.h) { b.onClick(); _buttons=[]; return; }
  }
  _buttons = [];

  // 3. 手牌点击（点击即出）
  if (currentState === STATE.GAME && gameState && gameState.hands) {
    const hand = gameState.hands[0] || [];
    const W = canvas.width;
    const sX = (W - hand.length * (CONFIG.CARD_W + 4)) / 2;
    for (let i = 0; i < hand.length; i++) {
      const id = hand[i];
      const yCard = 450;
      if (x > sX + i*(CONFIG.CARD_W+4) && x < sX + i*(CONFIG.CARD_W+4)+CONFIG.CARD_W && y > yCard && y < yCard+CONFIG.CARD_H) {
        handleTap(id, sX + i*(CONFIG.CARD_W+4), yCard); return;
      }
    }
  }
});

function handleTap(id, fromX, fromY) {
  if (gameState.currentPlayerIndex !== 0) { statusMsg = '不是你的回合'; render(); return; }

  // 计算场牌目标位置
  const W = canvas.width;
  const field = gameState.field || [];
  const fStart = (W - (field.length+1) * (CONFIG.CARD_W + 6)) / 2;
  const toX = fStart + field.length * (CONFIG.CARD_W + 6);
  const toY = 120;

  // 播放动画
  playCardAnim(id, fromX, fromY, toX, toY);

  // 发送网络请求
  statusMsg = '出牌中...'; render();
  send('play_card', id);
  selectedCardId = null;
}

function promptJoin() {
  wx.showModal({
    title: '加入房间', editable: true, placeholderText: '6位数字',
    success: res => { if (res.confirm && res.content) { statusMsg='加入中...'; render(); send('join_room', res.content); } }
  });
}

function send(ev, data) {
  const payload = data !== undefined ? JSON.stringify(data) : '';
  wx.sendSocketMessage({ data: payload ? `42["${ev}",${payload}]` : `42["${ev}"]` });
}

// ================= 网络逻辑 =================
connectServer();

function connectServer() {
  wx.connectSocket({ url: CONFIG.SERVER_URL, fail: () => { statusMsg='连接失败'; render(); } });

  wx.onSocketMessage(res => {
    let d = res.data;
    if (d instanceof ArrayBuffer) d = String.fromCharCode.apply(null, new Uint8Array(d));
    if (typeof d !== 'string') return;

    if (d.charAt(0) === '0') wx.sendSocketMessage({ data: '40' }); // 握手
    if (d.charAt(0) === '2') wx.sendSocketMessage({ data: '3' });  // Ping

    if (d.startsWith('42')) {
      try {
        const arr = JSON.parse(d.substring(2));
        onEvent(arr[0], arr[1]);
      } catch(e) {}
    }
  });

  wx.onSocketClose(() => { statusMsg='断开重连...'; render(); setTimeout(connectServer, 3000); });
}

function onEvent(ev, pay) {
  console.log('[Event]', ev, pay);

  if (ev === 'room_created') { myRoomId=pay.room.id; playerCount=pay.room.players.length; currentState=STATE.LOBBY; }
  else if (ev === 'room_joined') { myRoomId=pay.room.id; playerCount=pay.room.players.length; currentState=STATE.LOBBY; }
  else if (ev === 'player_joined') { if (pay.room) playerCount=pay.room.players.length; }
  else if (ev === 'game_start') {
    gameState = pay.state; currentState = STATE.GAME; selectedCardId = null;
    statusMsg = '游戏开始！你的回合'; startTurnTimer();
  }
  else if (ev === 'state_update') {
    gameState = pay.state;
    if (gameState.currentPlayerIndex === 0) { statusMsg = '你的回合：请点击出牌'; startTurnTimer(); }
    else { statusMsg = '对手思考中...'; stopTurnTimer(); }
    if (selectedCardId !== null && !gameState.hands[0].includes(selectedCardId)) selectedCardId = null;
  }
  else if (ev === 'yaku_found') {
    stopTurnTimer();
    statusMsg = '役达成！';
    popupState = { show: true, type: 'yaku', animProgress: 1 };
    currentState = STATE.POPUP;
  }
  else if (ev === 'round_end') {
    stopTurnTimer();
    resultData = pay; currentState = STATE.RESULT;
  }
  else if (ev === 'error') { statusMsg='错误：'+pay.message; wx.showToast({title:pay.message, icon:'none'}); }

  render();
}

// ================= 回合倒计时 =================
function startTurnTimer() {
  stopTurnTimer();
  turnTimeLeft = CONFIG.TURN_TIMEOUT;
  turnTimer = setInterval(() => {
    turnTimeLeft -= 1000;
    if (turnTimeLeft <= 0) {
      stopTurnTimer();
      // 超时自动出一张牌
      if (gameState && gameState.hands && gameState.hands[0] && gameState.hands[0].length > 0) {
        const randomCard = gameState.hands[0][0];
        statusMsg = '超时，自动出牌...'; render();
        send('play_card', randomCard);
      }
    } else {
      render();
    }
  }, 1000);
}

function stopTurnTimer() {
  if (turnTimer) { clearInterval(turnTimer); turnTimer = null; }
}

// ================= 启动 =================
render();
