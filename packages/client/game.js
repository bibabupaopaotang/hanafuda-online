/**
 * 花札 Hanafuda - 稳定版
 * 修复：图片加载、屏幕适配、双人操作
 */

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

const CONFIG = {
  // 通过 Nginx 80 端口连接（已配置反向代理）
  SERVER_URL: 'ws://47.253.96.212/socket.io/?EIO=4&transport=websocket',
  TURN_TIMEOUT: 15000
};

const STATE = { MENU: 0, LOBBY: 1, GAME: 2, RESULT: 3, POPUP: 4 };

// 状态变量
let currentState = STATE.MENU;
let mySeatIndex = 0;
let myRoomId = '';
let playerCount = 0;
let gameState = null;
let resultData = null;
let statusMsg = '初始化中...';
let turnTimer = null;
let selectedCardId = null;
let socketConnected = false;

// 动画
let animatingCard = null;
let popupState = { show: false };

// UI
let _buttons = [];
let cardImages = {};
let cardBackImg = null;

// ================= 加载卡牌图片 =================
function loadCardImages(callback) {
  let loaded = 0;
  const total = 49;
  
  function onCardLoad() {
    loaded++;
    if (loaded >= total && callback) {
      console.log('[资源] 所有卡牌加载完成');
      callback();
    }
  }
  
  // 微信小游戏加载本地图片
  for (let i = 0; i < 48; i++) {
    const img = wx.createImage();
    img.onload = onCardLoad;
    img.onerror = () => { 
      console.warn('图片加载失败：card_' + i + '，使用色块代替');
      loaded++; 
    };
    // 尝试加载，失败也不阻塞
    img.src = './assets/cards/card_' + String(i).padStart(2, '0') + '.png';
    cardImages[i] = img;
  }
  
  cardBackImg = wx.createImage();
  cardBackImg.onload = onCardLoad;
  cardBackImg.onerror = () => { 
    console.warn('图片加载失败：card_back，使用色块代替');
    loaded++; 
  };
  cardBackImg.src = './assets/cards/card_back.png';
  
  // 5 秒后强制开始（即使图片没加载完）
  setTimeout(() => {
    if (callback && loaded < total) {
      console.warn('[资源] 图片加载超时，强制开始');
      callback();
    }
  }, 5000);
}

// ================= 渲染 =================
function render() {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  _buttons = [];

  // 动态卡牌尺寸（适配不同屏幕）
  const baseW = Math.min(W, 400);
  const scale = baseW / 375;
  const CARD_W = 50 * scale;
  const CARD_H = 80 * scale;
  const CARD_GAP = 6 * scale;

  if (currentState === STATE.MENU) drawMenu(W, H);
  else if (currentState === STATE.LOBBY) drawLobby(W, H);
  else if (currentState === STATE.GAME) drawGameScene(W, H, CARD_W, CARD_H, CARD_GAP);
  else if (currentState === STATE.RESULT) drawResultScreen(W, H);
  else if (currentState === STATE.POPUP) { 
    drawGameScene(W, H, CARD_W, CARD_H, CARD_GAP); 
    drawPopup(W, H); 
  }

  // 动画
  if (animatingCard) {
    const progress = Math.min((Date.now() - animatingCard.startTime) / animatingCard.duration, 1);
    if (progress < 1) {
      drawAnimatingCard(progress, CARD_W, CARD_H);
      requestAnimationFrame(render);
      return;
    } else {
      animatingCard = null;
    }
  }
}

// ================= 背景 =================
function drawBg() {
  const W = canvas.width, H = canvas.height;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a472a');
  grad.addColorStop(1, '#0b3d1e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// ================= 文字 =================
function drawText(t, x, y, size, color) {
  ctx.fillStyle = color || '#fff';
  ctx.font = size + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(t, x, y);
}

// ================= 按钮 =================
function drawBtn(text, x, y, w, h, color, onClick, disabled) {
  ctx.fillStyle = disabled ? '#555' : color;
  roundRect(x, y, w, h, 8);
  ctx.fill();
  
  ctx.fillStyle = disabled ? '#888' : '#fff';
  ctx.font = 'bold ' + (h * 0.45) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w/2, y + h * 0.6);
  
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

// ================= 界面：菜单 =================
function drawMenu(W, H) {
  drawBg();
  
  drawText('🌸 花札 Hanafuda 🌸', W/2, H * 0.3, 32, '#fff');
  
  const btnW = W * 0.6;
  const btnH = 50;
  
  drawBtn('创建房间', W/2 - btnW/2, H * 0.45, btnW, btnH, '#4CAF50', () => {
    console.log('[按钮] 创建房间被点击');
    if (!socketConnected) {
      console.warn('[Socket] 未连接，等待中...');
      wx.showToast({ title: '连接中...', icon: 'loading' });
      statusMsg = '连接中...';
      render();
      return;
    }
    statusMsg = '创建中...';
    render();
    send('create_room');
  });
  
  drawBtn('加入房间', W/2 - btnW/2, H * 0.58, btnW, btnH, '#2196F3', () => {
    promptJoin();
  });
  
  drawText(statusMsg, W/2, H * 0.75, 16, '#aaa');
}

// ================= 界面：大厅 =================
function drawLobby(W, H) {
  drawBg();
  
  drawText('🏠 房间大厅', W/2, H * 0.2, 28, '#fff');
  drawText('房间号：' + myRoomId, W/2, H * 0.35, 24, '#ffcc00');
  drawText('人数：' + playerCount + ' / 2', W/2, H * 0.45, 20, '#fff');
  
  const btnW = W * 0.6;
  const btnH = 50;
  
  drawBtn('开始游戏', W/2 - btnW/2, H * 0.55, btnW, btnH, '#FF9800', () => {
    statusMsg = '请求开始...';
    render();
    send('start_game');
  });
  
  drawText('提示：单人测试也可开始', W/2, H * 0.7, 14, '#aaa');
}

// ================= 界面：游戏场景 =================
function drawGameScene(W, H, cw, ch, gap) {
  drawBg();
  
  if (!gameState) {
    drawText('等待发牌...', W/2, H/2, 24, '#fff');
    return;
  }

  // --- 对手手牌 (顶部) ---
  drawText('对手', W * 0.1, H * 0.06, 14, '#aaa');
  const oppIdx = (mySeatIndex + 1) % 2;
  const oppHand = gameState.hands[oppIdx] || [];
  const oppStart = (W - oppHand.length * (cw * 0.7 + 3)) / 2;
  for (let i = 0; i < oppHand.length; i++) {
    drawCardImg(oppStart + i * (cw * 0.7 + 3), H * 0.08, null, cw * 0.7, ch * 0.7);
  }

  // --- 场牌区 (中间) ---
  const fieldY = H * 0.25;
  const fieldH = H * 0.35;
  ctx.fillStyle = '#082d15';
  roundRect(W * 0.05, fieldY, W * 0.9, fieldH, 10);
  ctx.fill();
  ctx.strokeStyle = '#2e5c3e';
  ctx.lineWidth = 2;
  roundRect(W * 0.05, fieldY, W * 0.9, fieldH, 10);
  ctx.stroke();
  
  drawText('场牌区', W/2, fieldY + fieldH * 0.06, 16, '#558855');

  const field = gameState.field || [];
  const fStart = (W - field.length * (cw + gap)) / 2;
  field.forEach((id, i) => {
    drawCardIMG(fStart + i * (cw + gap), fieldY + fieldH * 0.15, id, cw, ch);
  });

  // --- 山札 (右侧) ---
  const deckX = W * 0.82;
  const deckY = fieldY + fieldH * 0.1;
  ctx.fillStyle = '#5D4037';
  roundRect(deckX, deckY, cw, ch, 6);
  ctx.fill();
  drawText('山札', deckX + cw/2, deckY + ch * 0.25, 12, '#fff');
  drawText(String(gameState.deck.length), deckX + cw/2, deckY + ch * 0.45, 14, '#fff');

  // --- 回合指示器 (右上角) ---
  drawTurnIndicator(W, H);

  // --- 玩家手牌 (底部) ---
  const handY = H * 0.65;
  const myHand = gameState.hands[mySeatIndex] || [];
  const hTotalW = myHand.length * (cw + gap);
  const hStart = (W - hTotalW) / 2;
  
  myHand.forEach((id, i) => {
    const isSel = (id === selectedCardId);
    const y = isSel ? handY - 15 : handY;
    drawCardIMG(hStart + i * (cw + gap), y, id, cw, ch, isSel);
  });

  drawText(statusMsg, W/2, H - 20, 18, '#ffcc00');
}

// ================= 回合指示器 =================
function drawTurnIndicator(W, H) {
  if (!gameState) return;
  
  const isMyTurn = (gameState.currentPlayerIndex === mySeatIndex);
  const x = W * 0.72;
  const y = H * 0.03;
  const w = W * 0.25;
  const h = 35;
  
  ctx.fillStyle = isMyTurn ? 'rgba(76,175,80,0.85)' : 'rgba(255,152,0,0.85)';
  roundRect(x, y, w, h, 8);
  ctx.fill();
  
  drawText(isMyTurn ? '✋ 你的回合' : '⏳ 对手回合', x + w/2, y + h * 0.65, 14, '#fff');
}

// ================= 界面：结算 =================
function drawResultScreen(W, H) {
  drawBg();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);
  
  const pw = W * 0.75;
  const ph = H * 0.5;
  
  ctx.fillStyle = '#fff';
  roundRect(W/2 - pw/2, H/2 - ph/2, pw, ph, 15);
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  roundRect(W/2 - pw/2, H/2 - ph/2, pw, ph, 15);
  ctx.stroke();

  drawText('🏁 本局结束', W/2, H/2 - ph * 0.3, 26, '#333');
  
  if (resultData) {
    const s = resultData.roundScores;
    drawText('本局：' + s[0] + ' - ' + s[1], W/2, H/2 - ph * 0.1, 18, '#555');
    drawText('累计：' + resultData.totalScores[0] + ' - ' + resultData.totalScores[1], W/2, H/2 + ph * 0.05, 22, '#000');
    if (resultData.gameOver) {
      drawText('游戏结束！', W/2, H/2 + ph * 0.2, 20, '#D32F2F');
    }
  }

  const bw = pw * 0.5;
  const bh = ph * 0.12;
  drawBtn('返回大厅', W/2 - bw/2, H/2 + ph * 0.35, bw, bh, '#4CAF50', () => {
    currentState = STATE.LOBBY;
    gameState = null;
    resultData = null;
    render();
  });
}

// ================= 界面：弹窗 =================
function drawPopup(W, H) {
  if (!popupState.show) return;
  
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, W, H);
  
  const pw = W * 0.75;
  const ph = H * 0.4;
  const px = W/2 - pw/2;
  const py = H/2 - ph/2;
  
  ctx.fillStyle = '#fff';
  roundRect(px, py, pw, ph, 15);
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  roundRect(px, py, pw, ph, 15);
  ctx.stroke();

  drawText('🎉 役达成！', W/2, py + ph * 0.25, 24, '#D32F2F');
  drawText('是否继续 (Koi-Koi)?', W/2, py + ph * 0.42, 16, '#333');
  
  const bw = pw * 0.35;
  const bh = ph * 0.18;
  
  drawBtn('继续 (x2)', px + pw * 0.1, py + ph * 0.62, bw, bh, '#4CAF50', () => {
    popupState.show = false;
    send('koi_koi');
    statusMsg = '继续游戏！';
    render();
  });
  
  drawBtn('结算', px + pw * 0.55, py + ph * 0.62, bw, bh, '#f44336', () => {
    popupState.show = false;
    send('end_round');
    statusMsg = '结算中...';
    render();
  });
}

// ================= 卡牌渲染 =================
function drawCardIMG(x, y, id, w, h, selected) {
  if (id === null || id === undefined) return;
  
  const img = cardImages[id];
  if (!img) {
    // 图片未加载时的占位符
    ctx.fillStyle = '#fff';
    roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ID:' + id, x + w/2, y + h/2);
    return;
  }
  
  // 阴影
  ctx.shadowBlur = selected ? 10 : 3;
  ctx.shadowColor = selected ? '#FFD700' : 'rgba(0,0,0,0.5)';
  ctx.shadowOffsetY = selected ? -8 : 2;
  
  // 绘制图片
  ctx.drawImage(img, x, y, w, h);
  
  // 选中边框
  if (selected) {
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    roundRect(x - 2, y - 2, w + 4, h + 4, 6);
    ctx.stroke();
  }
  
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function drawCardImg(x, y, id, w, h) {
  // 对手牌背
  if (!cardBackImg) {
    ctx.fillStyle = '#2E7D32';
    roundRect(x, y, w, h, 4);
    ctx.fill();
    return;
  }
  ctx.drawImage(cardBackImg, x, y, w, h);
}

// ================= 动画 =================
function drawAnimatingCard(progress, w, h) {
  if (!animatingCard) return;
  const a = animatingCard;
  const eased = 1 - Math.pow(1 - progress, 3);
  const cx = a.fromX + (a.toX - a.fromX) * eased;
  const cy = a.fromY + (a.toY - a.fromY) * eased - Math.sin(progress * Math.PI) * 20;
  drawCardIMG(cx, cy, a.id, w, h, true);
}

// ================= 交互 =================
wx.onTouchStart(e => {
  const t = e.touches[0];
  const x = t.clientX;
  const y = t.clientY;

  // 1. 弹窗优先
  if (currentState === STATE.POPUP) {
    const W = canvas.width;
    const H = canvas.height;
    const pw = W * 0.75;
    const ph = H * 0.4;
    const px = W/2 - pw/2;
    const py = H/2 - ph/2;
    const bw = pw * 0.35;
    const bh = ph * 0.18;
    
    if (x > px + pw * 0.1 && x < px + pw * 0.1 + bw && y > py + ph * 0.62 && y < py + ph * 0.62 + bh) {
      popupState.show = false;
      send('koi_koi');
      statusMsg = '继续！';
      render();
      return;
    }
    if (x > px + pw * 0.55 && x < px + pw * 0.55 + bw && y > py + ph * 0.62 && y < py + ph * 0.62 + bh) {
      popupState.show = false;
      send('end_round');
      statusMsg = '结算中...';
      render();
      return;
    }
    return;
  }

  // 2. 按钮点击
  for (let i = 0; i < _buttons.length; i++) {
    const b = _buttons[i];
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
      b.onClick();
      _buttons = [];
      return;
    }
  }
  _buttons = [];

  // 3. 手牌点击
  if (currentState === STATE.GAME && gameState) {
    const W = canvas.width;
    const H = canvas.height;
    const baseW = Math.min(W, 400);
    const scale = baseW / 375;
    const cw = 50 * scale;
    const ch = 80 * scale;
    const gap = 6 * scale;
    const handY = H * 0.65;
    const myHand = gameState.hands[mySeatIndex] || [];
    const hTotalW = myHand.length * (cw + gap);
    const hStart = (W - hTotalW) / 2;

    for (let i = myHand.length - 1; i >= 0; i--) {
      const id = myHand[i];
      const isSel = (id === selectedCardId);
      const cardX = hStart + i * (cw + gap);
      const cardY = isSel ? handY - 15 : handY;
      
      if (x > cardX && x < cardX + cw && y > cardY && y < cardY + ch) {
        handleTap(id, cardX, cardY, cw, ch, gap, handY);
        return;
      }
    }
  }
});

function handleTap(id, fromX, fromY, cw, ch, gap, handY) {
  // 检查是否轮到自己
  if (gameState.currentPlayerIndex !== mySeatIndex) {
    statusMsg = '不是你的回合！';
    render();
    return;
  }

  if (selectedCardId === id) {
    // 再次点击 -> 出牌
    const W = canvas.width;
    const H = canvas.height;
    const fieldY = H * 0.25;
    const field = gameState.field || [];
    const fStart = (W - (field.length + 1) * (cw + gap)) / 2;
    const toX = fStart + field.length * (cw + gap);
    const toY = fieldY + H * 0.15;
    
    playCardAnim(id, fromX, fromY, toX, toY);
    statusMsg = '出牌中...';
    render();
    send('play_card', id);
    selectedCardId = null;
  } else {
    // 第一次点击 -> 选中
    selectedCardId = id;
    render();
  }
}

function playCardAnim(id, fromX, fromY, toX, toY) {
  animatingCard = {
    id: id,
    fromX: fromX,
    fromY: fromY,
    toX: toX,
    toY: toY,
    startTime: Date.now(),
    duration: 400
  };
}

function promptJoin() {
  wx.showModal({
    title: '加入房间',
    editable: true,
    placeholderText: '6 位数字',
    success: res => {
      if (res.confirm && res.content) {
        statusMsg = '加入中...';
        render();
        send('join_room', res.content);
      }
    }
  });
}

function send(ev, data) {
  if (!socketConnected) {
    console.warn('[Socket] 连接未建立，消息已丢弃:', ev);
    wx.showToast({ title: '连接中...', icon: 'loading' });
    return;
  }
  const payload = data !== undefined ? JSON.stringify(data) : '';
  const msg = payload ? '42["' + ev + '",' + payload + ']' : '42["' + ev + '"]';
  console.log('[Socket] 发送消息:', ev, msg);
  wx.sendSocketMessage({
    data: msg,
    success: () => console.log('[Socket] 发送成功:', ev),
    fail: (err) => console.error('[Socket] 发送失败:', ev, err)
  });
}

// ================= 网络 =================
function connectServer() {
  console.log('[Socket] 开始连接:', CONFIG.SERVER_URL);
  
  // 先注册事件处理器（必须在 connectSocket 之前）
  wx.onSocketOpen(() => {
    console.log('[Socket] ✅ onSocketOpen 触发 - 已连接');
    socketConnected = true;
    if (currentState === STATE.MENU && statusMsg === '创建中...') {
      console.log('[Socket] 重发创建房间请求');
      send('create_room');
    }
  });
  
  wx.onSocketError((err) => {
    console.error('[Socket] ❌ onSocketError:', err);
    statusMsg = '连接错误';
    render();
  });
  
  wx.onSocketClose(() => {
    console.log('[Socket] 连接已关闭');
    socketConnected = false;
  });
  
  wx.onSocketMessage((res) => {
    console.log('[Socket] 收到消息:', res.data);
    let d = res.data;
    if (d instanceof ArrayBuffer) {
      d = String.fromCharCode.apply(null, new Uint8Array(d));
    }
    if (typeof d !== 'string') return;
    if (d.charAt(0) === '0') wx.sendSocketMessage({ data: '40' });
    if (d.charAt(0) === '2') wx.sendSocketMessage({ data: '3' });
    if (d.startsWith('42')) {
      try {
        const arr = JSON.parse(d.substring(2));
        onEvent(arr[0], arr[1]);
      } catch(e) {
        console.error('解析失败:', e);
      }
    }
  });
  
  // 然后发起连接
  console.log('[Socket] 调用 wx.connectSocket...');
  wx.connectSocket({
    url: CONFIG.SERVER_URL,
    fail: (err) => {
      console.error('[Socket] ❌ connectSocket fail:', err);
      statusMsg = '连接失败';
      render();
    },
    success: () => {
      console.log('[Socket] connectSocket success - 请求已发送');
    }
  });
  console.log('[Socket] connectSocket 调用完成');
}

  wx.onSocketMessage(res => {
    let d = res.data;
    if (d instanceof ArrayBuffer) {
      d = String.fromCharCode.apply(null, new Uint8Array(d));
    }
    if (typeof d !== 'string') return;
    
    if (d.charAt(0) === '0') wx.sendSocketMessage({ data: '40' });
    if (d.charAt(0) === '2') wx.sendSocketMessage({ data: '3' });
    if (d.startsWith('42')) {
      try {
        const arr = JSON.parse(d.substring(2));
        onEvent(arr[0], arr[1]);
      } catch(e) {
        console.error('解析失败:', e);
      }
    }
  });

  wx.onSocketClose(() => {
    statusMsg = '断开重连...';
    render();
    setTimeout(connectServer, 3000);
  });
}

function onEvent(ev, pay) {
  console.log('[Event] 收到事件:', ev, pay);
  
  if (ev === 'room_created') {
    console.log('[房间] 创建成功，房间号:', pay.room.id);
    myRoomId = pay.room.id;
    mySeatIndex = 0;
    playerCount = pay.room.players.length;
    currentState = STATE.LOBBY;
    statusMsg = '房间已创建';
    console.log('[状态] 切换到 LOBBY');
  }
  else if (ev === 'room_joined') {
    myRoomId = pay.room.id;
    mySeatIndex = pay.mySeatIndex || 0;
    playerCount = pay.room.players.length;
    currentState = STATE.LOBBY;
  }
  else if (ev === 'player_joined') {
    if (pay.room) playerCount = pay.room.players.length;
  }
  else if (ev === 'game_start') {
    gameState = pay.state;
    currentState = STATE.GAME;
    selectedCardId = null;
    statusMsg = '游戏开始！你的回合';
    startTurnTimer();
  }
  else if (ev === 'state_update') {
    gameState = pay.state;
    if (gameState.currentPlayerIndex === mySeatIndex) {
      statusMsg = '你的回合：点击出牌';
      startTurnTimer();
    } else {
      statusMsg = '对手思考中...';
      stopTurnTimer();
    }
    selectedCardId = null;
  }
  else if (ev === 'yaku_found') {
    stopTurnTimer();
    statusMsg = '役达成！';
    popupState.show = true;
  }
  else if (ev === 'round_end') {
    stopTurnTimer();
    resultData = pay;
    currentState = STATE.RESULT;
  }
  else if (ev === 'error') {
    statusMsg = '错误：' + pay.message;
    wx.showToast({ title: pay.message, icon: 'none' });
  }
  
  render();
}

function startTurnTimer() {
  stopTurnTimer();
  turnTimer = setInterval(() => {
    if (gameState && gameState.currentPlayerIndex === mySeatIndex && gameState.hands[mySeatIndex] && gameState.hands[mySeatIndex].length > 0) {
      statusMsg = '超时，自动出牌...';
      render();
      send('play_card', gameState.hands[mySeatIndex][0]);
    }
    stopTurnTimer();
  }, CONFIG.TURN_TIMEOUT);
}

function stopTurnTimer() {
  if (turnTimer) {
    clearInterval(turnTimer);
    turnTimer = null;
  }
}

// ================= 启动 =================
console.log('[启动] 花札 Hanafuda');
loadCardImages(() => {
  console.log('[资源] 卡牌加载完成');
  render();
});
render();
