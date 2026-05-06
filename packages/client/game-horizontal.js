/**
 * 花札 Hanafuda - 横屏麻将风格版
 * 横屏布局 + 计分区显示得分明细
 */

const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

const CONFIG = {
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
let popupState = { show: false, yakuList: [] };

// 役提示
let yakuProgress = {
  lights: 0,
  akaStrips: 0,
  aoStrips: 0,
  inoshikacho: [],
  strips: 0,
  seeds: 0,
  waste: 0,
  sake: []
};

// UI
let _buttons = [];
let cardImages = {};
let cardBackImg = null;

// ================= 横屏布局配置 =================
const HORIZONTAL_LAYOUT = {
  // 区域布局（基于 1920×1080 比例）
  areas: {
    opponentHand: { x: 0.15, y: 0.05, w: 0.7, h: 0.12 },    // 对手手牌（顶部）
    field: { x: 0.3, y: 0.25, w: 0.4, h: 0.45 },            // 场牌区（中央）
    playerHand: { x: 0.15, y: 0.78, w: 0.7, h: 0.15 },      // 玩家手牌（底部）
    leftCapture: { x: 0.02, y: 0.2, w: 0.25, h: 0.55 },     // 左侧计分区（对手）
    rightCapture: { x: 0.73, y: 0.2, w: 0.25, h: 0.55 },    // 右侧计分区（玩家）
    mountain: { x: 0.45, y: 0.72, w: 0.1, h: 0.08 },        // 山札
    statusBar: { x: 0, y: 0.95, w: 1, h: 0.05 },            // 状态栏
  },
  // 卡牌尺寸比例
  cardScale: {
    hand: 1.0,       // 手牌尺寸
    field: 0.9,      // 场牌尺寸
    opponent: 0.6,   // 对手手牌（缩小）
    capture: 0.35,   // 计分区缩略图
  }
};

// ================= 加载卡牌图片 =================
function loadCardImages(callback) {
  let loaded = 0;
  const total = 49;
  
  function onCardLoad() {
    loaded++;
    if (loaded >= total && callback) {
      console.log('[资源] 卡牌加载完成');
      callback();
    }
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

// ================= 渲染 =================
function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  _buttons = [];

  // 横屏基准尺寸
  const baseW = 1920;
  const baseH = 1080;
  const scale = Math.min(W / baseW, H / baseH);
  
  // 卡牌基准尺寸（115×177 px）
  const CARD_W = 115 * scale;
  const CARD_H = 177 * scale;
  const CARD_GAP = 8 * scale;

  if (currentState === STATE.MENU) drawMenu(W, H);
  else if (currentState === STATE.LOBBY) drawLobby(W, H);
  else if (currentState === STATE.GAME) drawGameSceneHorizontal(W, H, CARD_W, CARD_H, CARD_GAP);
  else if (currentState === STATE.RESULT) drawResultScreen(W, H);
  else if (currentState === STATE.POPUP) { 
    drawGameSceneHorizontal(W, H, CARD_W, CARD_H, CARD_GAP); 
    drawPopup(W, H);
  }

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

// ================= 基础绘图 =================
function drawBg() {
  const W = canvas.width, H = canvas.height;
  // 麻将绿渐变背景
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2D5016');
  grad.addColorStop(1, '#1a3d0f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawText(t, x, y, size, color, align = 'center') {
  ctx.fillStyle = color || '#fff';
  ctx.font = size + 'px sans-serif';
  ctx.textAlign = align;
  ctx.fillText(t, x, y);
}

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

function drawCardIMG(x, y, id, w, h, selected = false) {
  if (id === null || id === undefined) {
    // 牌背
    if (cardBackImg) {
      ctx.drawImage(cardBackImg, x, y, w, h);
    }
  } else {
    // 牌面
    const img = cardImages[id];
    if (img) {
      ctx.drawImage(img, x, y, w, h);
      // 选中效果
      if (selected) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
      }
    }
  }
}

// ================= 界面：菜单 =================
function drawMenu(W, H) {
  drawBg();
  drawText('🌸 花札 Hanafuda 🌸', W/2, H * 0.35, 42, '#fff');
  const btnW = W * 0.5, btnH = 60;
  drawBtn('创建房间', W/2 - btnW/2, H * 0.48, btnW, btnH, '#4CAF50', () => {
    if (!socketConnected) {
      wx.showToast({ title: '连接中...', icon: 'loading' });
      return;
    }
    send('create_room');
  });
  drawBtn('加入房间', W/2 - btnW/2, H * 0.58, btnW, btnH, '#2196F3', () => promptJoin());
  drawBtn('📋 役说明', W/2 - btnW/2, H * 0.68, btnW, btnH, '#9C27B0', () => {
    currentState = STATE.POPUP;
    popupState.show = true;
    popupState.yakuHelp = true;
    render();
  });
  drawText(statusMsg, W/2, H * 0.85, 18, '#aaa');
}

// ================= 界面：大厅 =================
function drawLobby(W, H) {
  drawBg();
  drawText('🏠 房间大厅', W/2, H * 0.25, 38, '#fff');
  drawText('房间号：' + myRoomId, W/2, H * 0.4, 32, '#ffcc00');
  drawText('人数：' + playerCount + ' / 2', W/2, H * 0.5, 26, '#fff');
  const btnW = W * 0.5, btnH = 60;
  drawBtn('开始游戏', W/2 - btnW/2, H * 0.6, btnW, btnH, '#FF9800', () => {
    send('start_game');
  });
  drawText('提示：单人测试也可开始', W/2, H * 0.78, 18, '#aaa');
}

// ================= 界面：游戏场景（横屏） =================
function drawGameSceneHorizontal(W, H, cw, ch, gap) {
  drawBg();
  if (!gameState) {
    drawText('等待发牌...', W/2, H/2, 32, '#fff');
    return;
  }

  const oppIdx = (mySeatIndex + 1) % 2;
  const layout = HORIZONTAL_LAYOUT;
  
  // ========== 1. 对手手牌区（顶部） ==========
  const oppArea = layout.areas.opponentHand;
  const oppHandX = W * oppArea.x;
  const oppHandY = H * oppArea.y;
  const oppCardW = cw * layout.cardScale.opponent;
  const oppCardH = ch * layout.cardScale.opponent;
  const oppHand = gameState.hands[oppIdx] || [];
  
  // 对手手牌背景
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(oppHandX - 20, oppHandY - 10, W * oppArea.w + 40, H * oppArea.h + 20, 10);
  ctx.fill();
  
  // 对手手牌（横向排列，牌背）
  const oppTotalW = oppHand.length * (oppCardW + 2);
  const oppStart = oppHandX + (W * oppArea.w - oppTotalW) / 2;
  for (let i = 0; i < oppHand.length; i++) {
    drawCardIMG(oppStart + i * (oppCardW + 2), oppHandY, null, oppCardW, oppCardH);
  }
  
  // 对手信息
  drawText(`对手`, oppHandX, oppHandY + oppCardH + 20, 20, '#aaa', 'left');
  const oppScore = gameState.totalScores?.[oppIdx] || 0;
  drawText(`积分：${oppScore}`, oppHandX + 100, oppHandY + oppCardH + 20, 24, '#ffcc00', 'left');
  
  // ========== 2. 玩家手牌区（底部） ==========
  const playerArea = layout.areas.playerHand;
  const playerHandX = W * playerArea.x;
  const playerHandY = H * playerArea.y;
  const handCardW = cw * layout.cardScale.hand;
  const handCardH = ch * layout.cardScale.hand;
  const myHand = gameState.hands[mySeatIndex] || [];
  
  // 玩家手牌背景
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(playerHandX - 20, playerHandY - 10, W * playerArea.w + 40, H * playerArea.h + 20, 10);
  ctx.fill();
  
  // 玩家手牌（横向排列，重叠 40%，麻将风格）
  const overlap = handCardW * 0.4;
  const handTotalW = handCardW + (myHand.length - 1) * overlap;
  const handStart = playerHandX + (W * playerArea.w - handTotalW) / 2;
  
  myHand.forEach((id, i) => {
    const isSel = (id === selectedCardId);
    const y = isSel ? playerHandY - 20 : playerHandY;
    drawCardIMG(handStart + i * overlap, y, id, handCardW, handCardH, isSel);
  });
  
  // 玩家信息
  const myScore = gameState.totalScores?.[mySeatIndex] || 0;
  drawText(`积分：${myScore}`, playerHandX, playerHandY - 20, 24, '#ffcc00', 'left');
  
  // ========== 3. 场牌区（中央） ==========
  const fieldArea = layout.areas.field;
  const fieldX = W * fieldArea.x;
  const fieldY = H * fieldArea.y;
  const fieldW = W * fieldArea.w;
  const fieldH = H * fieldArea.h;
  const fieldCardW = cw * layout.cardScale.field;
  const fieldCardH = ch * layout.cardScale.field;
  
  // 场牌区背景
  ctx.fillStyle = 'rgba(8, 45, 21, 0.8)';
  roundRect(fieldX, fieldY, fieldW, fieldH, 15);
  ctx.fill();
  ctx.strokeStyle = '#2e5c3e';
  ctx.lineWidth = 3;
  roundRect(fieldX, fieldY, fieldW, fieldH, 15);
  ctx.stroke();
  
  // 场牌区标题
  drawText('场牌区', fieldX + fieldW/2, fieldY + 30, 22, '#558855');
  
  // 场牌（3×4 网格）
  const field = gameState.field || [];
  const cols = 4;
  const rows = 3;
  const gridW = (fieldW - 40) / cols;
  const gridH = (fieldH - 60) / rows;
  
  field.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cardX = fieldX + 20 + col * gridW + (gridW - fieldCardW) / 2;
    const cardY = fieldY + 50 + row * gridH + (gridH - fieldCardH) / 2;
    drawCardIMG(cardX, cardY, id, fieldCardW, fieldCardH);
  });
  
  // ========== 4. 山札 ==========
  const mountainArea = layout.areas.mountain;
  const mountainX = W * mountainArea.x;
  const mountainY = H * mountainArea.y;
  const mountainW = W * mountainArea.w;
  const mountainH = H * mountainArea.h;
  
  ctx.fillStyle = '#5D4037';
  roundRect(mountainX, mountainY, mountainW, mountainH, 8);
  ctx.fill();
  drawText('山札', mountainX + mountainW/2, mountainY + mountainH * 0.35, 18, '#fff');
  drawText(String(gameState.deck.length), mountainX + mountainW/2, mountainY + mountainH * 0.6, 22, '#ffcc00');
  
  // ========== 5. 左侧计分区（对手） ==========
  const leftCapArea = layout.areas.leftCapture;
  const leftCapX = W * leftCapArea.x;
  const leftCapY = H * leftCapArea.y;
  const leftCapW = W * leftCapArea.w;
  const leftCapH = H * leftCapArea.h;
  
  // 计分区背景
  ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
  roundRect(leftCapX, leftCapY, leftCapW, leftCapH, 10);
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  roundRect(leftCapX, leftCapY, leftCapW, leftCapH, 10);
  ctx.stroke();
  
  // 标题
  drawText('📊 对手得分', leftCapX + 15, leftCapY + 30, 24, '#333', 'left');
  
  // 对手总分
  drawText(`${oppScore}分`, leftCapX + leftCapW/2, leftCapY + leftCapH/2, 42, '#333');
  
  // 收集牌数
  const oppCaptured = gameState.captured?.[oppIdx]?.length || 0;
  drawText(`收集：${oppCaptured}张`, leftCapX + leftCapW/2, leftCapY + leftCapH/2 + 50, 20, '#666');
  
  // ========== 6. 右侧计分区（玩家）⭐ 显示得分明细 ==========
  const rightCapArea = layout.areas.rightCapture;
  const rightCapX = W * rightCapArea.x;
  const rightCapY = H * rightCapArea.y;
  const rightCapW = W * rightCapArea.w;
  const rightCapH = H * rightCapArea.h;
  
  // 计分区背景（浅米色）
  ctx.fillStyle = 'rgba(245, 245, 220, 0.95)';
  roundRect(rightCapX, rightCapY, rightCapW, rightCapH, 10);
  ctx.fill();
  ctx.strokeStyle = '#3C2415';
  ctx.lineWidth = 2;
  roundRect(rightCapX, rightCapY, rightCapW, rightCapH, 10);
  ctx.stroke();
  
  // 标题
  drawText('📊 得分明细', rightCapX + 15, rightCapY + 30, 24, '#3C2415', 'left');
  
  // 玩家役明细
  const myCaptured = gameState.captured?.[mySeatIndex] || [];
  const yakuDetails = parseYakuDetailsSimple(myCaptured);
  
  let currentY = rightCapY + 60;
  const padding = 15;
  
  if (yakuDetails.length > 0) {
    yakuDetails.forEach((yaku) => {
      if (currentY > rightCapY + rightCapH - 120) return;
      
      // 役名 + 分数
      ctx.fillStyle = yaku.isComplete ? '#8B0000' : '#888';
      ctx.font = yaku.isComplete ? 'bold 20px sans-serif' : '18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${yaku.name}${yaku.isComplete ? ' ✅' : ''}`, rightCapX + padding, currentY);
      
      ctx.textAlign = 'right';
      ctx.fillText(`${yaku.score}分`, rightCapX + rightCapW - padding, currentY);
      
      // 注释
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(yaku.description, rightCapX + padding, currentY + 22);
      
      currentY += 55;
    });
  } else {
    drawText('暂无成役', rightCapX + rightCapW/2, rightCapY + 100, 18, '#888');
  }
  
  // 分隔线
  ctx.strokeStyle = '#DDD';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rightCapX + padding, currentY);
  ctx.lineTo(rightCapX + rightCapW - padding, currentY);
  ctx.stroke();
  currentY += 30;
  
  // 本局得分
  ctx.fillStyle = '#8B0000';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`本局：${myScore}分`, rightCapX + padding, rightCapY + rightCapH - 40);
  
  // ========== 7. 回合指示器 ==========
  drawTurnIndicatorHorizontal(W, H, oppIdx);
  
  // ========== 8. 状态栏 ==========
  const statusArea = layout.areas.statusBar;
  ctx.fillStyle = 'rgba(26, 26, 46, 0.9)';
  ctx.fillRect(W * statusArea.x, H * statusArea.y, W * statusArea.w, H * statusArea.h);
  
  const isMyTurn = (gameState.currentPlayerIndex === mySeatIndex);
  drawText(`第 ${gameState.round || 1} 局`, W * 0.1, H * 0.97, 20, '#fff', 'left');
  drawText(isMyTurn ? '🟢 你的回合' : '⏳ 对手回合', W/2, H * 0.97, 22, isMyTurn ? '#4CAF50' : '#FF9800');
  drawText(`剩余：${gameState.deck.length}张`, W * 0.9, H * 0.97, 20, '#aaa', 'right');
  
  // 状态提示
  drawText(statusMsg, W/2, H - 25, 18, '#ffcc00');
}

// ================= 役详情解析（简化版） =================
function parseYakuDetailsSimple(capturedCards) {
  const yakuList = [];
  
  if (!capturedCards || capturedCards.length === 0) return yakuList;
  
  // 光牌检查
  const lightIds = [0, 8, 28, 40, 44];
  const lightCount = capturedCards.filter(id => lightIds.includes(id)).length;
  
  if (lightCount >= 5) {
    yakuList.push({ name: '五光', score: 10, description: '集齐全部 5 张光牌', isComplete: true });
  } else if (lightCount === 4) {
    const hasRain = capturedCards.includes(40);
    yakuList.push({ 
      name: hasRain ? '雨四光' : '四光', 
      score: hasRain ? 7 : 8, 
      description: `${lightCount}张光牌`, 
      isComplete: true 
    });
  } else if (lightCount === 3 && !capturedCards.includes(40)) {
    yakuList.push({ name: '三光', score: 6, description: '3 张光牌（不含雨）', isComplete: true });
  }
  
  // 赤短检查（1, 5, 9, 45）
  const akaStripIds = [1, 5, 9, 45];
  const akaCount = capturedCards.filter(id => akaStripIds.includes(id)).length;
  
  if (akaCount >= 3) {
    yakuList.push({ name: '赤短', score: 5, description: `${akaCount}张赤短`, isComplete: true });
  } else if (akaCount > 0) {
    yakuList.push({ name: '赤短', score: 0, description: `差${3-akaCount}张成役`, isComplete: false });
  }
  
  // 青短检查（16, 20, 24, 29, 32, 36）
  const aoStripIds = [16, 20, 24, 29, 32, 36];
  const aoCount = capturedCards.filter(id => aoStripIds.includes(id)).length;
  
  if (aoCount >= 3) {
    yakuList.push({ name: '青短', score: 5, description: `${aoCount}张青/紫短册`, isComplete: true });
  }
  
  // 种牌检查
  const seedIds = [2, 4, 13, 17, 21, 25, 30, 33, 37];
  const seedCount = capturedCards.filter(id => seedIds.includes(id)).length;
  
  if (seedCount >= 5) {
    yakuList.push({ name: `种×${seedCount}`, score: seedCount, description: `${seedCount}张种牌`, isComplete: true });
  }
  
  return yakuList;
}

// ================= 回合指示器（横屏） =================
function drawTurnIndicatorHorizontal(W, H, oppIdx) {
  if (!gameState) return;
  const isMyTurn = (gameState.currentPlayerIndex === mySeatIndex);
  const x = W * 0.38, y = H * 0.18, w = W * 0.24, h = 35;
  ctx.fillStyle = isMyTurn ? 'rgba(76,175,80,0.9)' : 'rgba(255,152,0,0.9)';
  roundRect(x, y, w, h, 12);
  ctx.fill();
  drawText(isMyTurn ? '✋ 你的回合' : '⏳ 对手', x + w/2, y + h * 0.65, 18, '#fff');
}

// ================= 界面：弹窗 =================
function drawPopup(W, H) {
  if (!popupState.show) return;
  
  // 役说明帮助界面
  if (popupState.yakuHelp) {
    drawYakuHelp(W, H);
    return;
  }
  
  // 半透明遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);
  
  const pw = Math.min(W * 0.7, 500);
  const ph = H * 0.5;
  const px = W/2 - pw/2;
  const py = H/2 - ph/2;
  
  // 弹窗背景
  ctx.fillStyle = '#fff';
  roundRect(px, py, pw, ph, 15);
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  roundRect(px, py, pw, ph, 15);
  ctx.stroke();
  
  // 标题
  drawText('🎉 役达成！', W/2, py + ph * 0.15, 32, '#D32F2F');
  drawText('是否继续 (Koi-Koi)?', W/2, py + ph * 0.28, 20, '#333');
  
  // 役列表
  if (popupState.yakuList && popupState.yakuList.length > 0) {
    let y = py + ph * 0.38;
    popupState.yakuList.forEach((yaku, i) => {
      drawText(yaku.label + '：' + yaku.points + '分', W/2, y + i * 28, 18, '#555');
    });
  }
  
  drawText('继续则分数翻倍，对手先结束则 0 分', W/2, py + ph * 0.55, 16, '#888');
  
  // 按钮
  const bw = pw * 0.35, bh = ph * 0.12;
  drawBtn('继续 (×2)', px + pw * 0.1, py + ph * 0.72, bw, bh, '#4CAF50', () => {
    popupState.show = false;
    popupState.yakuList = [];
    send('koi_koi');
    statusMsg = '继续游戏！';
    currentState = STATE.GAME;
    render();
  });
  drawBtn('结算', px + pw * 0.55, py + ph * 0.72, bw, bh, '#f44336', () => {
    popupState.show = false;
    popupState.yakuList = [];
    send('end_round');
    statusMsg = '结算中...';
    currentState = STATE.GAME;
    render();
  });
}

// ================= 界面：役说明帮助 =================
function drawYakuHelp(W, H) {
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(0, 0, W, H);
  
  const pw = Math.min(W * 0.85, 600);
  const ph = H * 0.8;
  const px = W/2 - pw/2;
  const py = H/2 - ph/2;
  
  // 背景
  ctx.fillStyle = '#fff';
  roundRect(px, py, pw, ph, 15);
  ctx.fill();
  
  // 标题
  drawText('📋 役说明', W/2, py + 35, 32, '#333');
  drawText('达成役获得分数，先达到 7 分者获胜', W/2, py + 70, 18, '#888');
  
  // 役列表
  const scrollY = py + 100;
  const lineHeight = 24;
  let y = scrollY;
  
  const yakuList = [
    { title: '🌟 光牌役', items: ['五光 (5 张): 10 分', '四光 (4 张): 8 分', '雨四光 (含柳): 7 分', '三光 (3 张): 6 分'] },
    { title: '📿 短册役', items: ['赤短 (1+2+3+12 月): 5 分', '青短 (5+6+7+9+10 月): 5 分', '短册×5: 1 分', '短册×6: 2 分', '短册×7: 3 分', '短册×8: 4 分'] },
    { title: '🦌 种牌役', items: ['猪鹿蝶 (7+9+10 月): 5 分', '种×5: 1 分', '种×6: 2 分', '种×7: 3 分', '种×8: 4 分'] },
    { title: '🍂 カ斯役', items: ['カ斯×10: 1 分', '每多 1 张 +1 分'] },
    { title: '🍶 特殊役', items: ['呑み (3+8 月 + 杯): 4 分', '花见酒 (3 月 + 杯): 3 分', '月见酒 (8 月 + 杯): 3 分'] },
  ];
  
  yakuList.forEach(section => {
    ctx.fillStyle = '#D32F2F';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(section.title, px + 20, y);
    y += lineHeight;
    
    ctx.fillStyle = '#555';
    ctx.font = '16px sans-serif';
    section.items.forEach(item => {
      ctx.fillText(item, px + 35, y);
      y += lineHeight - 2;
    });
    y += 12;
  });
  
  // 关闭按钮
  const bw = pw * 0.35, bh = 55;
  drawBtn('返回', W/2 - bw/2, py + ph - 70, bw, bh, '#4CAF50', () => {
    popupState.show = false;
    popupState.yakuHelp = false;
    currentState = STATE.MENU;
    render();
  });
}

// ================= 界面：结算 =================
function drawResultScreen(W, H) {
  drawBg();
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);
  
  const pw = Math.min(W * 0.7, 600);
  const ph = H * 0.6;
  const px = W/2 - pw/2;
  const py = H/2 - ph/2;
  
  // 背景
  ctx.fillStyle = '#fff';
  roundRect(px, py, pw, ph, 15);
  ctx.fill();
  
  // 标题
  const isWin = resultData?.winner === mySeatIndex;
  drawText(isWin ? '🎉 你赢了！' : '😢 你输了', W/2, py + ph * 0.18, 38, isWin ? '#4CAF50' : '#f44336');
  
  // 分数
  if (resultData?.scores) {
    drawText(`你的分数：${resultData.scores[mySeatIndex]}`, W/2, py + ph * 0.35, 28, '#333');
    drawText(`对手分数：${resultData.scores[(mySeatIndex+1)%2]}`, W/2, py + ph * 0.48, 28, '#333');
  }
  
  // 按钮
  const bw = pw * 0.35, bh = ph * 0.1;
  drawBtn('返回大厅', W/2 - bw/2, py + ph * 0.68, bw, bh, '#2196F3', () => {
    currentState = STATE.LOBBY;
    render();
  });
}

// ================= 动画 =================
function drawAnimatingCard(progress, cw, ch) {
  if (!animatingCard) return;
  const { fromX, fromY, toX, toY, cardId } = animatingCard;
  const curX = fromX + (toX - fromX) * progress;
  const curY = fromY + (toY - fromY) * progress;
  drawCardIMG(curX, curY, cardId, cw, ch);
}

// ================= 输入处理 =================
canvas.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  const x = touch.clientX;
  const y = touch.clientY;
  
  // 按钮点击
  for (let btn of _buttons) {
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
      btn.onClick();
      return;
    }
  }
  
  // 游戏状态：手牌点击
  if (currentState === STATE.GAME && gameState) {
    const myHand = gameState.hands[mySeatIndex] || [];
    const layout = HORIZONTAL_LAYOUT;
    const playerHandX = canvas.width * layout.areas.playerHand.x;
    const playerHandY = canvas.height * layout.areas.playerHand.y;
    const handCardW = 115 * Math.min(canvas.width / 1920, canvas.height / 1080);
    const handCardH = 177 * Math.min(canvas.width / 1920, canvas.height / 1080);
    const overlap = handCardW * 0.4;
    const handTotalW = handCardW + (myHand.length - 1) * overlap;
    const handStart = playerHandX + (canvas.width * layout.areas.playerHand.w - handTotalW) / 2;
    
    // 检查点击了哪张牌
    for (let i = myHand.length - 1; i >= 0; i--) {
      const cardX = handStart + i * overlap;
      if (x >= cardX && x <= cardX + handCardW && y >= playerHandY && y <= playerHandY + handCardH) {
        selectedCardId = myHand[i];
        // 出牌逻辑
        send('play_card', { cardId: selectedCardId });
        statusMsg = `打出 ${selectedCardId} 号牌`;
        render();
        return;
      }
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
    socketConnected = true;
    console.log('[Socket] 已连接');
    statusMsg = '已连接服务器';
  });
  
  wx.onSocketMessage((res) => {
    const data = JSON.parse(res.data);
    handleServerMessage(data);
  });
  
  wx.onSocketClose(() => {
    socketConnected = false;
    console.warn('[Socket] 连接关闭');
    statusMsg = '服务器断开';
  });
}

function send(event, payload = {}) {
  if (!socketConnected) {
    console.warn('[Socket] 连接未建立:', event);
    return;
  }
  const msg = { event, ...payload };
  console.log('[Socket] 发送:', msg);
  wx.sendSocketMessage({
    data: JSON.stringify(msg),
    success: () => console.log('[Socket] 发送成功:', event),
    fail: (err) => console.error('[Socket] 发送失败:', event, err)
  });
}

function handleServerMessage(data) {
  console.log('[Socket] 收到:', data);
  
  switch (data.event) {
    case 'game_state':
      gameState = data.state;
      statusMsg = '游戏进行中';
      break;
    case 'room_created':
      myRoomId = data.roomId;
      playerCount = data.playerCount || 1;
      statusMsg = `房间已创建：${myRoomId}`;
      break;
    case 'room_joined':
      myRoomId = data.roomId;
      playerCount = data.playerCount;
      statusMsg = `已加入房间：${myRoomId}`;
      break;
    case 'game_started':
      currentState = STATE.GAME;
      statusMsg = '游戏开始！';
      break;
    case 'round_result':
      showRoundResult(data);
      break;
    case 'error':
      statusMsg = `错误：${data.message}`;
      break;
  }
  
  render();
}

function showRoundResult(data) {
  currentState = STATE.RESULT;
  resultData = data;
}

function promptJoin() {
  wx.showPrompt({
    title: '加入房间',
    placeholder: '输入房间号',
    success: (res) => {
      if (res.confirm) {
        myRoomId = res.trim();
        send('join_room', { roomId: myRoomId });
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
