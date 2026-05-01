/**
 * 花札 Hanafuda - 最终修复版
 * 修复：1. 回合判断逻辑（基于 seatIndex）
 *       2. 手机屏幕适配（动态比例坐标）
 */

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

const CONFIG = {
  SERVER_URL: 'ws://47.253.96.212/socket.io/?EIO=4&transport=websocket',
  CARD_W_RATIO: 0.22,   // 卡牌宽度占屏幕宽度的比例
  CARD_H_RATIO: 0.12,   // 卡牌高度占屏幕高度的比例
  ANIM_DURATION: 400,
  TURN_TIMEOUT: 15000
};

const STATE = { MENU: 0, LOBBY: 1, GAME: 2, RESULT: 3, POPUP: 4 };

// 状态变量
let currentState = STATE.MENU;
let mySeatIndex = 0; // 记录自己的位置 (0 或 1)
let myRoomId = '';
let playerCount = 0;
let gameState = null;
let resultData = null;
let statusMsg = '初始化中...';
let turnTimer = null;

// 动画系统
let animatingCard = null;
let popupState = { show: false, animProgress: 1 };

// UI 元素
let _buttons = [];
let cardImages = {};
let cardBackImg = null;

// 常量
const MONTHS = ['', '松', '梅', '桜', '藤', '菖蒲', '牡丹', '萩', '芒', '菊', '紅葉', '柳', '桐'];
const LIGHT_IDS = [0, 8, 28, 40, 44];

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
    img.src = `assets/cards/card_${String(i).padStart(2, '0')}.png`;
    cardImages[i] = img;
  }
  
  cardBackImg = wx.createImage();
  cardBackImg.onload = onCardLoad;
  cardBackImg.src = 'assets/cards/card_back.png';
}

// ================= 渲染 =================
function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  _buttons = [];

  // 动态计算卡牌尺寸
  const CARD_W = Math.min(W * CONFIG.CARD_W_RATIO, 80);
  const CARD_H = CARD_W * 1.6;
  const CARD_GAP = CARD_W * 0.1;

  if (currentState === STATE.MENU) drawMenu(W, H);
  else if (currentState === STATE.LOBBY) drawLobby(W, H);
  else if (currentState === STATE.GAME) drawGameScene(W, H, CARD_W, CARD_H, CARD_GAP);
  else if (currentState === STATE.RESULT) drawResultScreen(W, H);
  else if (currentState === STATE.POPUP) { drawGameScene(W, H, CARD_W, CARD_H, CARD_GAP); drawPopup(W, H); }

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

function drawBg() {
  const W = canvas.width, H = canvas.height;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a472a');
  grad.addColorStop(1, '#0b3d1e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // 网格
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function drawText(t, x, y, f, c) {
  ctx.fillStyle = c; ctx.font = f; ctx.textAlign = 'center'; ctx.fillText(t, x, y);
}

function drawBtn(text, x, y, w, h, color, onClick, disabled = false) {
  ctx.fillStyle = disabled ? '#555' : color;
  roundRect(x, y, w, h, h * 0.15); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(x, y + h * 0.05, w, h, h * 0.15); ctx.fill();
  ctx.fillStyle = disabled ? '#888' : '#fff';
  ctx.font = `bold ${h * 0.4}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillText(text, x + w/2, y + h * 0.6);
  if (!disabled) _buttons.push({ x, y, w, h, onClick });
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r); ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h); ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r); ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath();
}

// ================= 界面绘制 =================
function drawMenu(W, H) {
  drawBg();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${H * 0.08}px serif`; ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(255,215,0,0.5)'; ctx.shadowBlur = 15;
  ctx.fillText('🌸 花札 Hanafuda 🌸', W/2, H * 0.3); ctx.shadowBlur = 0;
  
  const btnW = W * 0.5, btnH = H * 0.08;
  drawBtn('创建房间', W/2 - btnW/2, H * 0.45, btnW, btnH, '#4CAF50', () => { statusMsg='创建中...'; render(); send('create_room'); });
  drawBtn('加入房间', W/2 - btnW/2, H * 0.58, btnW, btnH, '#2196F3', () => promptJoin());
  drawText(statusMsg, W/2, H * 0.75, `${H * 0.03}px sans-serif`, '#aaa');
}

function drawLobby(W, H) {
  drawBg();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${H * 0.06}px serif`; ctx.textAlign = 'center';
  ctx.fillText('🏠 房间大厅', W/2, H * 0.2);
  ctx.fillStyle = '#ffcc00'; ctx.font = `${H * 0.05}px sans-serif`;
  ctx.fillText(`房间号：${myRoomId}`, W/2, H * 0.3);
  ctx.fillStyle = '#fff'; ctx.fillText(`人数：${playerCount} / 2`, W/2, H * 0.4);

  const btnW = W * 0.5, btnH = H * 0.08;
  drawBtn('开始游戏', W/2 - btnW/2, H * 0.55, btnW, btnH, '#FF9800', () => { statusMsg='请求开始...'; render(); send('start_game'); });
  drawText('提示：目前支持单人测试', W/2, H * 0.65, `${H * 0.025}px sans-serif`, '#aaa');
}

function drawGameScene(W, H, cw, ch, gap) {
  drawBg();
  if (!gameState) { drawText('等待发牌...', W/2, H/2, `bold ${H * 0.05}px sans-serif`, '#fff'); return; }

  // --- 对手手牌 (顶部) ---
  drawText('对手', W * 0.15, H * 0.05, `${H * 0.03}px sans-serif`, '#aaa');
  const oppHand = gameState.hands[1] || []; // 简化：默认自己在 0 位，对手在 1 位。如果是 1 位，对手就是 0 位。
  const myOppIdx = (mySeatIndex + 1) % 2;
  const realOppHand = gameState.hands[myOppIdx] || [];
  
  // 动态计算对手手牌起始位置
  const oppCardW = cw * 0.8;
  const oppStart = (W - realOppHand.length * (oppCardW + 5)) / 2;
  for (let i = 0; i < realOppHand.length; i++) {
    drawCardImg(oppStart + i * (oppCardW + 5), H * 0.08, null, oppCardW, ch * 0.8);
  }

  // --- 场牌区 (中间) ---
  const fieldAreaY = H * 0.25;
  const fieldAreaH = H * 0.35;
  ctx.fillStyle = '#082d15'; roundRect(W * 0.05, fieldAreaY, W * 0.9, fieldAreaH, 10); ctx.fill();
  ctx.strokeStyle = '#2e5c3e'; ctx.lineWidth = 2; roundRect(W * 0.05, fieldAreaY, W * 0.9, fieldAreaH, 10); ctx.stroke();
  drawText('场牌区', W/2, fieldAreaY + H * 0.04, `${H * 0.025}px sans-serif`, '#558855');

  const field = gameState.field || [];
  // 场牌居中排列
  const fTotalW = field.length * (cw + gap);
  let fStart = (W - fTotalW) / 2;
  // 如果牌太多，缩小间距
  if (fTotalW > W * 0.85) {
     fStart = W * 0.075;
  }
  field.forEach((id, i) => drawCardIMG(fStart + i * (cw + gap), fieldAreaY + H * 0.1, id, cw, ch));

  // --- 山札 (右侧) ---
  const deckX = W * 0.85;
  const deckY = fieldAreaY;
  ctx.fillStyle = '#5D4037'; roundRect(deckX, deckY, cw, ch, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `${H * 0.02}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillText('山札', deckX + cw/2, deckY + ch * 0.2);
  ctx.fillText(`${gameState.deck.length}`, deckX + cw/2, deckY + ch * 0.4);

  // --- 回合指示器 (右上角) ---
  drawTurnIndicator(W, H);

  // --- 玩家手牌 (底部) ---
  const handAreaY = H * 0.7;
  const myRealHand = gameState.hands[mySeatIndex] || [];
  const hTotalW = myRealHand.length * (cw + gap);
  const hStart = (W - hTotalW) / 2;
  myRealHand.forEach((id, i) => {
    const isSel = (id === selectedCardId);
    const y = isSel ? handAreaY - H * 0.05 : handAreaY;
    drawCardIMG(hStart + i * (cw + gap), y, id, cw, ch, isSel);
  });

  drawText(statusMsg, W/2, H - H * 0.03, `bold ${H * 0.03}px sans-serif`, '#ffcc00');
}

function drawTurnIndicator(W, H) {
  if (!gameState) return;
  
  // 修复：使用 mySeatIndex 对比
  const isMyTurn = (gameState.currentPlayerIndex === mySeatIndex);
  
  const x = W * 0.75, y = H * 0.05, w = W * 0.22, h = H * 0.05;
  ctx.fillStyle = isMyTurn ? 'rgba(76,175,80,0.8)' : 'rgba(255,152,0,0.8)';
  roundRect(x, y, w, h, 10); ctx.fill();
  
  const fontSize = h * 0.6;
  drawText(isMyTurn ? '✋ 你的回合' : '⏳ 对手回合', x + w/2, y + h * 0.65, `bold ${fontSize}px sans-serif`, '#fff');
}

function drawResultScreen(W, H) {
  drawBg();
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
  const pw = W * 0.7, ph = H * 0.5;
  ctx.fillStyle = '#fff'; roundRect(W/2-pw/2, H/2-ph/2, pw, ph, 15); ctx.fill();
  ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 3; roundRect(W/2-pw/2, H/2-ph/2, pw, ph, 15); ctx.stroke();

  drawText('🏁 本局结束', W/2, H/2 - ph*0.3, `bold ${H*0.05}px sans-serif`, '#333');
  if (resultData) {
    const s = resultData.roundScores;
    drawText(`本局：${s[0]} - ${s[1]}`, W/2, H/2 - ph*0.1, `${H*0.03}px sans-serif`, '#555');
    drawText(`累计：${resultData.totalScores[0]} - ${resultData.totalScores[1]}`, W/2, H/2 + ph*0.05, `bold ${H*0.04}px sans-serif`, '#000');
    if (resultData.gameOver) drawText('游戏结束！', W/2, H/2 + ph*0.2, `bold ${H*0.03}px sans-serif`, '#D32F2F');
  }

  const bw = pw * 0.6, bh = ph * 0.15;
  drawBtn('返回大厅', W/2-bw/2, H/2 + ph*0.3, bw, bh, '#4CAF50', () => { currentState=STATE.LOBBY; gameState=null; resultData=null; render(); });
}

function drawPopup(W, H) {
  if (!popupState.show) return;
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, W, H);
  const pw = W * 0.7, ph = H * 0.4;
  const px = W/2 - pw/2, py = H/2 - ph/2;
  
  ctx.fillStyle = '#fff'; roundRect(px, py, pw, ph, 15); ctx.fill();
  ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; roundRect(px, py, pw, ph, 15); ctx.stroke();

  drawText('🎉 役达成！', W/2, py + ph * 0.25, `bold ${H*0.04}px sans-serif`, '#D32F2F');
  drawText('是否继续 (Koi-Koi)?', W/2, py + ph * 0.4, `${H*0.03}px sans-serif`, '#333');
  
  const bw = pw * 0.35, bh = ph * 0.2;
  drawBtn('继续 (x2)', px + pw * 0.1, py + ph * 0.6, bw, bh, '#4CAF50', () => { popupState.show=false; send('koi_koi'); statusMsg='继续！'; render(); });
  drawBtn('结算', px + pw * 0.55, py + ph * 0.6, bw, bh, '#f44336', () => { popupState.show=false; send('end_round'); statusMsg='结算中...'; render(); });
}

// ================= 卡牌渲染 =================
function drawCardIMG(x, y, id, w, h, selected = false) {
  if (id === null || id === undefined) return; // 不渲染空牌
  const img = cardImages[id];
  if (!img) {
    // 图片未加载时的占位符
    ctx.fillStyle = '#fff'; roundRect(x, y, w, h, 4); ctx.fill();
    return;
  }
  
  ctx.shadowBlur = selected ? 15 : 5;
  ctx.shadowColor = selected ? '#FFD700' : 'rgba(0,0,0,0.4)';
  ctx.shadowOffsetY = selected ? -10 : 2;
  
  ctx.drawImage(img, x, y, w, h);
  
  if (selected) {
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10;
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 3;
    roundRect(x-2, y-2, w+4, h+4, 6); ctx.stroke();
  }
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
}

function drawCardBack(x, y, w, h) {
  if (!cardBackImg) return;
  ctx.drawImage(cardBackImg, x, y, w, h);
}

// ================= 动画 & 缓动 =================
function drawAnimatingCard(progress) {
  if (!animatingCard) return;
  const a = animatingCard;
  const eased = 1 - Math.pow(1 - progress, 3);
  const cx = a.fromX + (a.toX - a.fromX) * eased;
  const cy = a.fromY + (a.toY - a.fromY) * eased - Math.sin(progress * Math.PI) * 30;
  drawCardIMG(cx, cy, a.id, animatingCard.w, animatingCard.h, true);
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t) { const c=1.70158; return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2); }

// ================= 交互 =================
let selectedCardId = null;

wx.onTouchStart(e => {
  const t = e.touches[0];
  const x = t.clientX, y = t.clientY;

  // 1. 弹窗优先
  if (currentState === STATE.POPUP) {
    const pw = canvas.width * 0.7, ph = canvas.height * 0.4;
    const px = canvas.width/2 - pw/2, py = canvas.height/2 - ph/2;
    const bw = pw * 0.35, bh = ph * 0.2;
    if (x > px + pw*0.1 && x < px + pw*0.1 + bw && y > py + ph*0.6 && y < py + ph*0.6 + bh) {
      popupState.show = false; send('koi_koi'); statusMsg='继续！'; render(); return;
    }
    if (x > px + pw*0.55 && x < px + pw*0.55 + bw && y > py + ph*0.6 && y < py + ph*0.6 + bh) {
      popupState.show = false; send('end_round'); statusMsg='结算中...'; render(); return;
    }
    return;
  }

  // 2. 按钮点击
  for (const b of _buttons) {
    if (x>b.x && x<b.x+b.w && y>b.y && y<b.y+b.h) { b.onClick(); _buttons=[]; return; }
  }
  _buttons = [];

  // 3. 手牌点击
  if (currentState === STATE.GAME && gameState) {
    const W = canvas.width, H = canvas.height;
    const cw = Math.min(W * CONFIG.CARD_W_RATIO, 80);
    const ch = cw * 1.6;
    const gap = cw * 0.1;
    const handAreaY = H * 0.7;
    const myRealHand = gameState.hands[mySeatIndex] || [];
    const hTotalW = myRealHand.length * (cw + gap);
    const hStart = (W - hTotalW) / 2;

    // 从后往前遍历（防止重叠遮挡）
    for (let i = myRealHand.length - 1; i >= 0; i--) {
      const id = myRealHand[i];
      const isSel = (id === selectedCardId);
      const cardY = isSel ? handAreaY - H * 0.05 : handAreaY;
      const cardX = hStart + i * (cw + gap);
      
      if (x > cardX && x < cardX + cw && y > cardY && y < cardY + ch) {
        handleTap(id, cardX, cardY); return;
      }
    }
  }
});

let selectedTapId = null;
function handleTap(id, fromX, fromY) {
  // 检查是否轮到自己
  if (gameState.currentPlayerIndex !== mySeatIndex) { statusMsg = '不是你的回合'; render(); return; }

  if (selectedTapId === id) {
    // 再次点击同一张牌 -> 出牌
    const W = canvas.width;
    const cw = Math.min(W * CONFIG.CARD_W_RATIO, 80);
    const gap = cw * 0.1;
    const field = gameState.field || [];
    const fTotalW = (field.length + 1) * (cw + gap);
    const fStart = (W - fTotalW) / 2;
    
    playCardAnim(id, fromX, fromY, fStart + field.length * (cw + gap), canvas.height * 0.35);
    statusMsg = '出牌中...'; render();
    send('play_card', id);
    selectedTapId = null;
    selectedCardId = null;
  } else {
    // 第一次点击 -> 选中
    selectedTapId = id;
    selectedCardId = id;
    render();
  }
}

function promptJoin() {
  wx.showModal({ title:'加入房间', editable:true, placeholderText:'6位数字',
    success: res => { if(res.confirm && res.content) { statusMsg='加入中...'; render(); send('join_room', res.content); } }
  });
}

function send(ev, data) {
  const payload = data !== undefined ? JSON.stringify(data) : '';
  wx.sendSocketMessage({ data: payload ? `42["${ev}",${payload}]` : `42["${ev}"]` });
}

// ================= 网络 =================
connectServer();
function connectServer() {
  wx.connectSocket({ url: CONFIG.SERVER_URL, fail: () => { statusMsg='连接失败'; render(); } });
  wx.onSocketMessage(res => {
    let d = res.data;
    if (d instanceof ArrayBuffer) d = String.fromCharCode.apply(null, new Uint8Array(d));
    if (typeof d !== 'string') return;
    if (d.charAt(0) === '0') wx.sendSocketMessage({ data: '40' });
    if (d.charAt(0) === '2') wx.sendSocketMessage({ data: '3' });
    if (d.startsWith('42')) {
      try { const arr = JSON.parse(d.substring(2)); onEvent(arr[0], arr[1]); } catch(e) {}
    }
  });
  wx.onSocketClose(() => { statusMsg='断开重连...'; render(); setTimeout(connectServer, 3000); });
}

function onEvent(ev, pay) {
  console.log('[Event]', ev, pay);
  if (ev === 'room_created') { 
    myRoomId=pay.room.id; 
    mySeatIndex = 0; // 创建者是 0 号位
    playerCount=pay.room.players.length; 
    currentState=STATE.LOBBY; 
  }
  else if (ev === 'room_joined') { 
    myRoomId=pay.room.id; 
    // 加入时获取自己的 seatIndex
    const me = pay.room.players.find(p => p.id === pay.room.players[pay.room.players.length-1]?.id); 
    // 这里简单处理：加入者通常是最后一个
    mySeatIndex = pay.room.players.length - 1; 
    playerCount=pay.room.players.length; 
    currentState=STATE.LOBBY; 
  }
  else if (ev === 'player_joined') { if(pay.room) playerCount=pay.room.players.length; }
  else if (ev === 'game_start') { 
    gameState=pay.state; 
    currentState=STATE.GAME; 
    selectedTapId=null; selectedCardId=null; 
    statusMsg='游戏开始！你的回合'; 
    startTurnTimer(); 
  }
  else if (ev === 'state_update') {
    gameState=pay.state;
    // 修复：基于 seatIndex 判断
    if (gameState.currentPlayerIndex === mySeatIndex) { 
      statusMsg='你的回合：请点击出牌'; 
      startTurnTimer(); 
    } else { 
      statusMsg='对手思考中...'; 
      stopTurnTimer(); 
    }
    selectedTapId = null; selectedCardId = null;
  }
  else if (ev === 'yaku_found') { stopTurnTimer(); statusMsg='役达成！'; popupState={show:true,type:'yaku',animProgress:1}; currentState=STATE.POPUP; }
  else if (ev === 'round_end') { stopTurnTimer(); resultData=pay; currentState=STATE.RESULT; }
  else if (ev === 'error') { statusMsg='错误：'+pay.message; wx.showToast({title:pay.message,icon:'none'}); }
  render();
}

function startTurnTimer() {
  stopTurnTimer(); 
  turnTimer = setInterval(() => {
    if (gameState && gameState.currentPlayerIndex === mySeatIndex && gameState.hands[mySeatIndex] && gameState.hands[mySeatIndex].length > 0) {
      statusMsg = '超时，自动出牌...'; render();
      // 自动出第一张
      send('play_card', gameState.hands[mySeatIndex][0]);
    }
    stopTurnTimer();
  }, CONFIG.TURN_TIMEOUT);
}

function stopTurnTimer() { if(turnTimer) { clearInterval(turnTimer); turnTimer=null; } }

// ================= 启动 =================
loadCardImages(() => {
  console.log('[资源] 卡牌加载完成');
  render();
});
render();