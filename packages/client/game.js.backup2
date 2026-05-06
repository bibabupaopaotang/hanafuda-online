/**
 * 花札 Hanafuda - 完整修复版
 * 修复：布局、积分显示、役达成弹窗、收集区
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
  lights: 0,      // 光牌数量
  akaStrips: 0,   // 赤短进度 [0/3]
  aoStrips: 0,    // 青短进度 [0/3]
  inoshikacho: [], // 猪鹿蝶收集 [6,7,10]
  strips: 0,      // 短册总数
  seeds: 0,       // 种牌总数
  waste: 0,       // カ斯总数
  sake: []        // 酒相关 [3 月光，8 月光，9 月杯]
};

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

  // 动态卡牌尺寸
  const scale = Math.min(W / 375, 1.0);
  const CARD_W = 50 * scale;
  const CARD_H = 80 * scale;
  const CARD_GAP = 5 * scale;

  if (currentState === STATE.MENU) drawMenu(W, H);
  else if (currentState === STATE.LOBBY) drawLobby(W, H);
  else if (currentState === STATE.GAME) drawGameScene(W, H, CARD_W, CARD_H, CARD_GAP);
  else if (currentState === STATE.RESULT) drawResultScreen(W, H);
  else if (currentState === STATE.POPUP) { 
    drawGameScene(W, H, CARD_W, CARD_H, CARD_GAP); 
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
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a472a');
  grad.addColorStop(1, '#0b3d1e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawText(t, x, y, size, color) {
  ctx.fillStyle = color || '#fff';
  ctx.font = size + 'px sans-serif';
  ctx.textAlign = 'center';
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

// ================= 界面：菜单 =================
function drawMenu(W, H) {
  drawBg();
  drawText('🌸 花札 Hanafuda 🌸', W/2, H * 0.28, 32, '#fff');
  const btnW = W * 0.6, btnH = 50;
  drawBtn('创建房间', W/2 - btnW/2, H * 0.42, btnW, btnH, '#4CAF50', () => {
    if (!socketConnected) {
      wx.showToast({ title: '连接中...', icon: 'loading' });
      return;
    }
    send('create_room');
  });
  drawBtn('加入房间', W/2 - btnW/2, H * 0.53, btnW, btnH, '#2196F3', () => promptJoin());
  drawBtn('📋 役说明', W/2 - btnW/2, H * 0.64, btnW, btnH, '#9C27B0', () => {
    currentState = STATE.POPUP;
    popupState.show = true;
    popupState.yakuHelp = true;
    render();
  });
  drawText(statusMsg, W/2, H * 0.78, 16, '#aaa');
}

// ================= 界面：大厅 =================
function drawLobby(W, H) {
  drawBg();
  drawText('🏠 房间大厅', W/2, H * 0.2, 28, '#fff');
  drawText('房间号：' + myRoomId, W/2, H * 0.35, 24, '#ffcc00');
  drawText('人数：' + playerCount + ' / 2', W/2, H * 0.45, 20, '#fff');
  const btnW = W * 0.6, btnH = 50;
  drawBtn('开始游戏', W/2 - btnW/2, H * 0.55, btnW, btnH, '#FF9800', () => {
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

  const oppIdx = (mySeatIndex + 1) % 2;
  
  // --- 顶部信息栏 ---
  const infoH = H * 0.15;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, infoH);
  
  // 对手信息（左侧）
  drawText('对手', W * 0.08, infoH * 0.35, 14, '#aaa');
  const oppScore = gameState.totalScores?.[oppIdx] || 0;
  drawText('积分：' + oppScore, W * 0.08, infoH * 0.6, 18, '#ffcc00');
  
  // 对手收集区
  const oppCaptured = gameState.captured?.[oppIdx]?.length || 0;
  drawText('收集：' + oppCaptured + '张', W * 0.08, infoH * 0.85, 12, '#888');
  
  // 我的信息（右侧）
  const myScore = gameState.totalScores?.[mySeatIndex] || 0;
  drawText('我的积分：' + myScore, W * 0.85, infoH * 0.6, 18, '#ffcc00');
  
  // 我的收集区（显示最近 5 张）
  const myCaptured = gameState.captured?.[mySeatIndex] || [];
  drawText('收集：' + myCaptured.length + '张', W * 0.85, infoH * 0.85, 12, '#888');
  
  // 绘制收集的牌（缩略图）
  const recentCards = myCaptured.slice(-6);
  recentCards.forEach((id, i) => {
    const img = cardImages[id];
    if (img) {
      const thumbW = 18, thumbH = 28;
      const thumbX = W * 0.92 - (recentCards.length - 1 - i) * (thumbW + 2);
      const thumbY = infoH * 0.85 - thumbH;
      ctx.drawImage(img, thumbX, thumbY, thumbW, thumbH);
    }
  });

  // --- 对手手牌 ---
  const oppHand = gameState.hands[oppIdx] || [];
  const oppCardW = cw * 0.7;
  const oppTotalW = oppHand.length * (oppCardW + 2);
  const oppStart = (W - oppTotalW) / 2;
  for (let i = 0; i < oppHand.length; i++) {
    drawCardImg(oppStart + i * (oppCardW + 2), H * 0.18, null, oppCardW, ch * 0.7);
  }

  // --- 场牌区 ---
  const fieldY = H * 0.28;
  const fieldH = H * 0.35;
  ctx.fillStyle = '#082d15';
  roundRect(W * 0.05, fieldY, W * 0.9, fieldH, 10);
  ctx.fill();
  ctx.strokeStyle = '#2e5c3e';
  ctx.lineWidth = 2;
  roundRect(W * 0.05, fieldY, W * 0.9, fieldH, 10);
  ctx.stroke();
  drawText('场牌区', W/2, fieldY + 15, 14, '#558855');

  const field = gameState.field || [];
  const maxPerRow = Math.floor((W * 0.85) / (cw + gap));
  const fieldCards = field.slice(0, maxPerRow * 2);
  const rows = Math.ceil(fieldCards.length / maxPerRow) || 1;
  const rowH = (fieldH - 40) / Math.max(rows, 1);
  
  fieldCards.forEach((id, i) => {
    const row = Math.floor(i / maxPerRow);
    const col = i % maxPerRow;
    const cardX = (W - maxPerRow * (cw + gap)) / 2 + col * (cw + gap);
    const cardY = fieldY + 25 + row * (ch * 0.4 + 3);
    drawCardIMG(cardX, cardY, id, cw, ch * 0.4);
  });

  // --- 山札 ---
  const deckX = W * 0.85;
  const deckY = fieldY + 20;
  ctx.fillStyle = '#5D4037';
  roundRect(deckX, deckY, cw, ch, 6);
  ctx.fill();
  drawText('山札', deckX + cw/2, deckY + ch * 0.25, 11, '#fff');
  drawText(String(gameState.deck.length), deckX + cw/2, deckY + ch * 0.45, 13, '#fff');

  // --- 回合指示器 ---
  drawTurnIndicator(W, H);

  // --- 玩家手牌 ---
  const handY = H * 0.72;
  const myHand = gameState.hands[mySeatIndex] || [];
  
  // 动态调整手牌布局：如果牌太多，缩小间距或卡牌尺寸
  let handCardW = cw;
  let handGap = gap;
  const maxHandWidth = W * 0.95; // 手牌最大宽度（留 5% 边距）
  const handTotalW = myHand.length * (cw + gap);
  
  if (handTotalW > maxHandWidth) {
    // 方案 1：缩小间距
    handGap = (maxHandWidth - myHand.length * cw) / (myHand.length - 1);
    if (handGap < 2) {
      // 方案 2：间距太小，缩小卡牌
      handCardW = (maxHandWidth - gap * (myHand.length - 1)) / myHand.length;
      handGap = gap;
    }
  }
  
  const hTotalW = myHand.length * (handCardW + handGap);
  const hStart = (W - hTotalW) / 2;
  myHand.forEach((id, i) => {
    const isSel = (id === selectedCardId);
    const y = isSel ? handY - 12 : handY;
    // 卡牌高度按比例缩放
    const handCardH = handCardW * (ch / cw);
    drawCardIMG(hStart + i * (handCardW + handGap), y, id, handCardW, handCardH, isSel);
  });

  // --- 状态提示 ---
  drawText(statusMsg, W/2, H - 18, 16, '#ffcc00');
  
  // --- 役进度提示（右侧） ---
  drawYakuHints(W, H, H * 0.18);
}

function drawTurnIndicator(W, H) {
  if (!gameState) return;
  const isMyTurn = (gameState.currentPlayerIndex === mySeatIndex);
  const x = W * 0.05, y = H * 0.18, w = W * 0.22, h = 28;
  ctx.fillStyle = isMyTurn ? 'rgba(76,175,80,0.9)' : 'rgba(255,152,0,0.9)';
  roundRect(x, y, w, h, 8);
  ctx.fill();
  drawText(isMyTurn ? '✋ 你的回合' : '⏳ 对手', x + w/2, y + h * 0.6, 13, '#fff');
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
  
  const pw = Math.min(W * 0.85, 340);
  const ph = H * 0.45;
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
  drawText('🎉 役达成！', W/2, py + ph * 0.18, 26, '#D32F2F');
  drawText('是否继续 (Koi-Koi)?', W/2, py + ph * 0.32, 16, '#333');
  
  // 役列表
  if (popupState.yakuList && popupState.yakuList.length > 0) {
    let y = py + ph * 0.42;
    popupState.yakuList.forEach((yaku, i) => {
      drawText(yaku.label + '：' + yaku.points + '分', W/2, y + i * 20, 14, '#555');
    });
  }
  
  drawText('继续则分数翻倍，对手先结束则 0 分', W/2, py + ph * 0.58, 12, '#888');
  
  // 按钮
  const bw = pw * 0.38, bh = ph * 0.14;
  drawBtn('继续 (x2)', px + pw * 0.08, py + ph * 0.72, bw, bh, '#4CAF50', () => {
    popupState.show = false;
    popupState.yakuList = [];
    send('koi_koi');
    statusMsg = '继续游戏！';
    currentState = STATE.GAME;
    render();
  });
  drawBtn('结算', px + pw * 0.54, py + ph * 0.72, bw, bh, '#f44336', () => {
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
  
  const pw = Math.min(W * 0.9, 400);
  const ph = H * 0.75;
  const px = W/2 - pw/2;
  const py = H/2 - ph/2;
  
  // 背景
  ctx.fillStyle = '#fff';
  roundRect(px, py, pw, ph, 15);
  ctx.fill();
  
  // 标题
  drawText('📋 役说明', W/2, py + 25, 24, '#333');
  drawText('达成役获得分数，先达到 7 分者获胜', W/2, py + 50, 14, '#888');
  
  // 役列表（可滚动区域）
  const scrollY = py + 70;
  const lineHeight = 18;
  let y = scrollY;
  
  const yakuList = [
    { title: '光牌役', items: ['五光 (5 张): 10 分', '四光 (4 张): 8 分', '雨四光 (含柳): 7 分', '三光 (3 张): 6 分'] },
    { title: '短册役', items: ['赤短 (1+2+3 月): 5 分', '青短 (6+7+9 月): 5 分', '短册×5: 1 分', '短册×6: 2 分', '短册×7: 3 分', '短册×8: 4 分'] },
    { title: '种牌役', items: ['猪鹿蝶 (6+7+10 月): 5 分', '种×5: 1 分', '种×6: 2 分', '种×7: 3 分', '种×8: 4 分'] },
    { title: 'カ斯役', items: ['カ斯×10: 1 分', '每多 1 张 +1 分'] },
    { title: '特殊役', items: ['呑み (3+8 月 + 杯): 4 分', '花见酒 (3 月 + 杯): 3 分', '月见酒 (8 月 + 杯): 3 分'] },
  ];
  
  yakuList.forEach(section => {
    drawText(section.title, px + 15, y, 16, '#D32F2F');
    y += lineHeight;
    section.items.forEach(item => {
      drawText(item, px + 25, y, 13, '#555');
      y += lineHeight - 2;
    });
    y += 8;
  });
  
  // 关闭按钮
  const bw = pw * 0.4, bh = 45;
  drawBtn('返回', W/2 - bw/2, py + ph - 60, bw, bh, '#4CAF50', () => {
    popupState.show = false;
    popupState.yakuHelp = false;
    currentState = STATE.MENU;
    render();
  });
}

// ================= 界面：结算 =================
function drawResultScreen(W, H) {
  drawBg();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, W, H);
  
  const pw = Math.min(W * 0.85, 360);
  const ph = H * 0.55;
  
  ctx.fillStyle = '#fff';
  roundRect(W/2 - pw/2, H/2 - ph/2, pw, ph, 15);
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  roundRect(W/2 - pw/2, H/2 - ph/2, pw, ph, 15);
  ctx.stroke();
  
  const gameOver = resultData?.gameOver;
  drawText(gameOver ? '🏆 游戏结束' : '🏁 本局结束', W/2, H/2 - ph * 0.35, 28, gameOver ? '#FFD700' : '#333');
  
  if (resultData) {
    const s = resultData.roundScores || [0, 0];
    drawText('本局得分：' + s[0] + ' - ' + s[1], W/2, H/2 - ph * 0.18, 20, '#555');
    
    const total = resultData.totalScores || [0, 0];
    drawText('累计积分：' + total[0] + ' - ' + total[1], W/2, H/2 - ph * 0.05, 24, '#000');
    
    if (gameOver && total.length >= 2) {
      const winnerIdx = total[0] >= total[1] ? 0 : 1;
      const winnerName = winnerIdx === mySeatIndex ? '你' : '对手';
      drawText(winnerName + '获胜！', W/2, H/2 + ph * 0.1, 26, '#D32F2F');
      drawText('目标分数：7 分', W/2, H/2 + ph * 0.22, 16, '#888');
    } else {
      drawText('先达到 7 分者获胜', W/2, H/2 + ph * 0.15, 16, '#888');
    }
  }
  
  const bw = pw * 0.42, bh = ph * 0.12;
  if (gameOver) {
    drawBtn('🔄 再来一局', W/2 - bw - 5, H/2 + ph * 0.38, bw, bh, '#FF9800', () => {
      send('start_game');
    });
    drawBtn('🏠 返回大厅', W/2 + 5, H/2 + ph * 0.38, bw, bh, '#4CAF50', () => {
      currentState = STATE.LOBBY;
      gameState = null;
      resultData = null;
      render();
    });
  } else {
    drawBtn('▶️ 下一局', W/2 - bw - 5, H/2 + ph * 0.38, bw, bh, '#2196F3', () => {
      send('start_game');
    });
    drawBtn('🏠 返回大厅', W/2 + 5, H/2 + ph * 0.38, bw, bh, '#9E9E9E', () => {
      currentState = STATE.LOBBY;
      gameState = null;
      resultData = null;
      render();
    });
  }
}

// ================= 卡牌渲染 =================
function drawCardIMG(x, y, id, w, h, selected) {
  if (id === null || id === undefined) return;
  const img = cardImages[id];
  if (!img) {
    ctx.fillStyle = '#fff';
    roundRect(x, y, w, h, 4);
    ctx.fill();
    return;
  }
  ctx.shadowBlur = selected ? 10 : 3;
  ctx.shadowColor = selected ? '#FFD700' : 'rgba(0,0,0,0.5)';
  ctx.shadowOffsetY = selected ? -8 : 2;
  ctx.drawImage(img, x, y, w, h);
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
  const t = e.touches[0], x = t.clientX, y = t.clientY;

  if (currentState === STATE.POPUP) {
    const W = canvas.width, H = canvas.height;
    
    // 役说明帮助界面
    if (popupState.yakuHelp) {
      const pw = Math.min(W * 0.9, 400);
      const ph = H * 0.75;
      const px = W/2 - pw/2;
      const py = H/2 - ph/2;
      const bw = pw * 0.4, bh = 45;
      
      if (x > W/2 - bw/2 && x < W/2 + bw/2 && y > py + ph - 60 && y < py + ph - 60 + bh) {
        popupState.show = false;
        popupState.yakuHelp = false;
        currentState = STATE.MENU;
        render();
        return;
      }
      return;
    }
    
    // 役达成弹窗
    const pw = Math.min(W * 0.85, 340);
    const ph = H * 0.45;
    const px = W/2 - pw/2;
    const py = H/2 - ph/2;
    const bw = pw * 0.38, bh = ph * 0.14;
    
    if (x > px + pw * 0.08 && x < px + pw * 0.08 + bw && y > py + ph * 0.72 && y < py + ph * 0.72 + bh) {
      popupState.show = false; popupState.yakuList = [];
      send('koi_koi'); statusMsg = '继续游戏！'; currentState = STATE.GAME; render(); return;
    }
    if (x > px + pw * 0.54 && x < px + pw * 0.54 + bw && y > py + ph * 0.72 && y < py + ph * 0.72 + bh) {
      popupState.show = false; popupState.yakuList = [];
      send('end_round'); statusMsg = '结算中...'; currentState = STATE.GAME; render(); return;
    }
    return;
  }

  for (let i = 0; i < _buttons.length; i++) {
    const b = _buttons[i];
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
      b.onClick(); _buttons = []; return;
    }
  }
  _buttons = [];

  if (currentState === STATE.GAME && gameState) {
    const W = canvas.width, H = canvas.height;
    const scale = Math.min(W / 375, 1.0);
    const cw = 50 * scale, ch = 80 * scale, gap = 5 * scale;
    const handY = H * 0.72;
    const myHand = gameState.hands[mySeatIndex] || [];
    
    // 动态计算手牌布局（与渲染逻辑一致）
    let handCardW = cw;
    let handGap = gap;
    const maxHandWidth = W * 0.95;
    const handTotalW = myHand.length * (cw + gap);
    
    if (handTotalW > maxHandWidth) {
      handGap = (maxHandWidth - myHand.length * cw) / (myHand.length - 1);
      if (handGap < 2) {
        handCardW = (maxHandWidth - gap * (myHand.length - 1)) / myHand.length;
        handGap = gap;
      }
    }
    
    const hTotalW = myHand.length * (handCardW + handGap);
    const hStart = (W - hTotalW) / 2;
    
    // 从后往前遍历（先检测选中的牌）
    for (let i = myHand.length - 1; i >= 0; i--) {
      const id = myHand[i];
      const isSel = (id === selectedCardId);
      const cardX = hStart + i * (handCardW + handGap);
      const cardY = isSel ? handY - 12 : handY;
      const cardH = handCardW * (ch / cw);
      // 扩大点击区域（方便手指点击）
      const hitPadding = 5;
      if (x > cardX - hitPadding && x < cardX + handCardW + hitPadding && 
          y > cardY - hitPadding && y < cardY + cardH + hitPadding) {
        handleTap(id, cardX, cardY, handCardW, cardH, handGap, handY); return;
      }
    }
  }
});

function handleTap(id, fromX, fromY, cw, ch, gap, handY) {
  if (gameState.currentPlayerIndex !== mySeatIndex) {
    statusMsg = '不是你的回合！'; render(); return;
  }
  if (selectedCardId === id) {
    const W = canvas.width, H = canvas.height;
    const fieldY = H * 0.28;
    const field = gameState.field || [];
    const maxPerRow = Math.floor((W * 0.85) / (cw + gap));
    const fStart = (W - maxPerRow * (cw + gap)) / 2;
    const toX = fStart + (field.length % maxPerRow) * (cw + gap);
    const toY = fieldY + 25 + Math.floor(field.length / maxPerRow) * (ch * 0.4 + 3);
    playCardAnim(id, fromX, fromY, toX, toY);
    statusMsg = '出牌中...'; render();
    send('play_card', id);
    selectedCardId = null;
  } else {
    // 选中效果
    selectedCardId = id; 
    render();
  }
}

function playCardAnim(id, fromX, fromY, toX, toY) {
  animatingCard = { id, fromX, fromY, toX, toY, startTime: Date.now(), duration: 400 };
}

function promptJoin() {
  wx.showModal({
    title: '加入房间', editable: true, placeholderText: '6 位数字',
    success: res => { if (res.confirm && res.content) { send('join_room', res.content); } }
  });
}

function send(ev, data) {
  if (!socketConnected) {
    console.warn('[Socket] 连接未建立:', ev);
    wx.showToast({ title: '连接中...', icon: 'loading' });
    return;
  }
  const payload = data !== undefined ? JSON.stringify(data) : '';
  const msg = payload ? '42["' + ev + '",' + payload + ']' : '42["' + ev + '"]';
  console.log('[Socket] 发送:', ev);
  wx.sendSocketMessage({
    data: msg,
    success: () => console.log('[Socket] 发送成功:', ev),
    fail: (err) => console.error('[Socket] 发送失败:', ev, err)
  });
}

// ================= 网络 =================
function connectServer() {
  console.log('[Socket] 开始连接:', CONFIG.SERVER_URL);
  
  wx.onSocketOpen(() => {
    console.log('[Socket] ✅ 已连接');
    socketConnected = true;
    if (currentState === STATE.MENU && statusMsg === '创建中...') {
      console.log('[Socket] 重发创建房间请求');
      send('create_room');
    }
  });
  
  wx.onSocketError((err) => {
    console.error('[Socket] ❌ 错误:', err);
    statusMsg = '连接错误'; render();
  });
  
  wx.onSocketClose(() => {
    console.log('[Socket] 连接关闭');
    socketConnected = false;
  });
  
  wx.onSocketMessage((res) => {
    console.log('[Socket] 收到:', res.data);
    let d = res.data;
    if (d instanceof ArrayBuffer) d = String.fromCharCode.apply(null, new Uint8Array(d));
    if (typeof d !== 'string') return;
    if (d.charAt(0) === '0') wx.sendSocketMessage({ data: '40' });
    if (d.charAt(0) === '2') wx.sendSocketMessage({ data: '3' });
    if (d.startsWith('42')) {
      try {
        const arr = JSON.parse(d.substring(2));
        onEvent(arr[0], arr[1]);
      } catch(e) { console.error('解析失败:', e); }
    }
  });
  
  wx.connectSocket({
    url: CONFIG.SERVER_URL,
    fail: (err) => { console.error('[Socket] ❌ 连接失败:', err); },
    success: () => console.log('[Socket] 连接请求已发送')
  });
}

// ================= 事件处理 =================
function onEvent(ev, pay) {
  console.log('[Event] 收到:', ev, pay);
  
  if (ev === 'room_created') {
    myRoomId = pay.room.id;
    mySeatIndex = 0;
    playerCount = pay.room.players.length;
    currentState = STATE.LOBBY;
  }
  else if (ev === 'room_joined') {
    myRoomId = pay.room.id;
    mySeatIndex = pay.mySeatIndex || 0;
    playerCount = pay.room.players.length;
    currentState = STATE.LOBBY;
  }
  else if (ev === 'player_joined') { if (pay.room) playerCount = pay.room.players.length; }
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
    // 更新役进度提示
    updateYakuProgress();
  }
  else if (ev === 'yaku_found') {
    console.log('[役达成] 显示弹窗');
    stopTurnTimer();
    popupState.show = true;
    popupState.yakuList = pay.yaku || [];
    currentState = STATE.POPUP;
    render();
  }
  else if (ev === 'round_end') {
    console.log('[结算] 本局结束', pay);
    stopTurnTimer();
    resultData = pay;
    if (pay.state && pay.state.totalScores) {
      resultData.totalScores = pay.state.totalScores;
    }
    currentState = STATE.RESULT;
    render();
  }
  else if (ev === 'game_end') {
    console.log('[游戏结束] 获胜者:', pay.winner?.nickname, '比分:', pay.totalScores);
    if (resultData) {
      resultData.gameOver = true;
      resultData.winner = pay.winner;
      resultData.totalScores = pay.totalScores;
    }
    render();
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
      statusMsg = '超时，自动出牌...'; render();
      send('play_card', gameState.hands[mySeatIndex][0]);
    }
    stopTurnTimer();
  }, CONFIG.TURN_TIMEOUT);
}

function stopTurnTimer() { if (turnTimer) { clearInterval(turnTimer); turnTimer = null; } }

// ================= 役进度提示 =================
function updateYakuProgress() {
  if (!gameState) return;
  
  const captured = gameState.captured?.[mySeatIndex] || [];
  
  // 重置进度
  yakuProgress = {
    lights: 0,
    akaStrips: 0,
    aoStrips: 0,
    inoshikacho: [],
    strips: 0,
    seeds: 0,
    waste: 0,
    sake: []
  };
  
  // 遍历收集的牌
  captured.forEach(cardId => {
    const month = Math.floor(cardId / 4) + 1;
    const category = cardId % 4; // 0:光，1:短，2:种，3:カ
    
    // 光牌
    if (category === 0) {
      yakuProgress.lights++;
      // 酒相关
      if (month === 3 && !yakuProgress.sake.includes(3)) yakuProgress.sake.push(3);
      if (month === 8 && !yakuProgress.sake.includes(8)) yakuProgress.sake.push(8);
    }
    
    // 短册
    if (category === 1) {
      yakuProgress.strips++;
      if ([1, 2, 3].includes(month)) yakuProgress.akaStrips++;
      if ([6, 7, 9].includes(month)) yakuProgress.aoStrips++;
    }
    
    // 种牌
    if (category === 2) {
      yakuProgress.seeds++;
      if ([6, 7, 10].includes(month) && !yakuProgress.inoshikacho.includes(month)) {
        yakuProgress.inoshikacho.push(month);
      }
      // 酒相关（9 月杯）
      if (month === 9 && !yakuProgress.sake.includes(9)) yakuProgress.sake.push(9);
    }
    
    // カ斯
    if (category === 3) {
      yakuProgress.waste++;
    }
  });
}

function getYakuHints() {
  const hints = [];
  
  // 光牌提示
  if (yakuProgress.lights > 0) {
    hints.push(`光牌：${yakuProgress.lights}/5 张`);
    if (yakuProgress.lights >= 3) hints.push('  → 再收集' + (3 - yakuProgress.lights) + '张达成三光！');
  }
  
  // 赤短提示
  if (yakuProgress.akaStrips > 0) {
    hints.push(`赤短：${yakuProgress.akaStrips}/3 张`);
    if (yakuProgress.akaStrips >= 2) hints.push('  → 再收集' + (3 - yakuProgress.akaStrips) + '张达成赤短！');
  }
  
  // 青短提示
  if (yakuProgress.aoStrips > 0) {
    hints.push(`青短：${yakuProgress.aoStrips}/3 张`);
    if (yakuProgress.aoStrips >= 2) hints.push('  → 再收集' + (3 - yakuProgress.aoStrips) + '张达成青短！');
  }
  
  // 猪鹿蝶提示
  if (yakuProgress.inoshikacho.length > 0) {
    const animals = { 6: '蝶', 7: '猪', 10: '鹿' };
    const collected = yakuProgress.inoshikacho.map(m => animals[m]).join(',');
    hints.push(`猪鹿蝶：${collected} (${yakuProgress.inoshikacho.length}/3)`);
    if (yakuProgress.inoshikacho.length >= 2) hints.push('  → 再收集' + (3 - yakuProgress.inoshikacho.length) + '张达成猪鹿蝶！');
  }
  
  // 酒提示
  if (yakuProgress.sake.length > 0) {
    const sakeNames = { 3: '桜光', 8: '芒光', 9: '杯' };
    const collected = yakuProgress.sake.map(m => sakeNames[m]).join(',');
    hints.push(`酒：${collected}`);
    if (yakuProgress.sake.includes(9)) {
      if (!yakuProgress.sake.includes(3)) hints.push('  → 收集 3 月桜光达成花见酒！');
      if (!yakuProgress.sake.includes(8)) hints.push('  → 收集 8 月芒光达成月见酒！');
    }
  }
  
  // 累计役提示
  if (yakuProgress.strips >= 4) hints.push(`短册：${yakuProgress.strips}张（5 张起有分）`);
  if (yakuProgress.seeds >= 4) hints.push(`种牌：${yakuProgress.seeds}张（5 张起有分）`);
  if (yakuProgress.waste >= 8) hints.push(`カ斯：${yakuProgress.waste}张（10 张起有分）`);
  
  return hints;
}

function drawYakuHints(W, H, startY) {
  const hints = getYakuHints();
  if (hints.length === 0) return;
  
  const boxX = W * 0.05;
  const boxY = startY;
  const boxW = W * 0.35;
  const boxH = 25 + hints.length * 18;
  
  // 背景
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(boxX, boxY, boxW, boxH, 8);
  ctx.fill();
  
  // 标题
  drawText('🎯 役进度', boxX + boxW / 2, boxY + 18, 14, '#FFD700');
  
  // 提示列表
  hints.forEach((hint, i) => {
    const color = hint.includes('→') ? '#ffcc00' : '#aaa';
    const fontSize = hint.includes('→') ? 12 : 13;
    drawText(hint, boxX + 10, boxY + 38 + i * 18, fontSize, color);
  });
}

// ================= 启动 =================
console.log('[启动] 花札 Hanafuda');
loadCardImages(() => {
  console.log('[资源] 卡牌加载完成');
  render();
});
render();
connectServer();
