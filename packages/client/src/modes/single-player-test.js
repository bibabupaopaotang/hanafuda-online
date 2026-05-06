/**
 * 单机测试模式 - 用于测试横屏布局和素材
 * 不需要服务器，直接发牌测试
 */

// 测试模式状态
let testModeState = null;

// 开始单机测试
function startSinglePlayerTest() {
  console.log('[单机测试] 启动测试模式');
  
  // 初始化测试状态
  testModeState = {
    field: [],
    hand: [],
    captured: [],
    deck: []
  };
  
  // 生成 48 张牌
  const deck = [];
  for (let i = 0; i < 48; i++) deck.push(i);
  
  // 洗牌
  shuffle(deck);
  
  // 发牌：场牌 8 张，手牌 8 张
  testModeState.field = deck.slice(0, 8);
  testModeState.hand = deck.slice(8, 16);
  testModeState.deck = deck.slice(16);
  
  // 进入测试模式
  currentState = STATE.GAME;
  statusMsg = '单机测试模式 - 点击手牌出牌';
  
  render();
}

// 洗牌算法
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// 测试模式出牌
function handleTestModeCardClick(cardId) {
  if (!testModeState) return;
  
  console.log('[单机测试] 出牌:', cardId);
  
  // 检查是否匹配场牌
  const matchingCards = [];
  for (let i = 0; i < testModeState.field.length; i++) {
    const fieldCardMonth = getCardMonth(testModeState.field[i]);
    const playedCardMonth = getCardMonth(cardId);
    if (fieldCardMonth === playedCardMonth) {
      matchingCards.push(i);
    }
  }
  
  if (matchingCards.length > 0) {
    // 配对成功
    const matchedIndex = matchingCards[0];
    const matchedCard = testModeState.field[matchedIndex];
    
    // 从场牌移除
    testModeState.field.splice(matchedIndex, 1);
    
    // 加入收集区
    testModeState.captured.push(cardId, matchedCard);
    
    statusMsg = `配对成功！获得 ${cardId} 和 ${matchedCard}`;
    
    // 从手牌移除
    const handIndex = testModeState.hand.indexOf(cardId);
    if (handIndex > -1) {
      testModeState.hand.splice(handIndex, 1);
    }
    
    // 如果手牌没了，重新发
    if (testModeState.hand.length === 0 && testModeState.deck.length >= 8) {
      testModeState.hand = testModeState.deck.slice(0, 8);
      testModeState.deck = testModeState.deck.slice(8);
      statusMsg += ' - 重新发牌';
    }
  } else {
    // 不匹配，牌留在场中
    testModeState.field.push(cardId);
    
    // 从手牌移除
    const handIndex = testModeState.hand.indexOf(cardId);
    if (handIndex > -1) {
      testModeState.hand.splice(handIndex, 1);
    }
    
    statusMsg = `打出 ${cardId} 号牌（未匹配）`;
  }
  
  render();
}

// 获取牌的月份（1-12）
function getCardMonth(cardId) {
  const monthMap = {
    0:1, 1:1, 2:1, 3:1,
    4:2, 5:2, 6:2, 7:2,
    8:3, 9:3, 10:3, 11:3,
    12:4, 13:4, 14:4, 15:4,
    16:5, 17:5, 18:5, 19:5,
    20:6, 21:6, 22:6, 23:6,
    24:7, 25:7, 26:7, 27:7,
    28:8, 29:8, 30:8, 31:8,
    32:9, 33:9, 34:9, 35:9,
    36:10, 37:10, 38:10, 39:10,
    40:11, 41:11, 42:11, 43:11,
    44:12, 45:12, 46:12, 47:12,
  };
  return monthMap[cardId] || 1;
}

// 测试模式渲染
function renderTestMode(W, H, cw, ch, gap) {
  drawBg();
  
  if (!testModeState) {
    drawText('测试模式初始化中...', W/2, H/2, 24, '#fff');
    return;
  }
  
  const layout = HORIZONTAL_LAYOUT;
  
  // 场牌区
  const fieldArea = layout.areas.field;
  const fieldX = W * fieldArea.x;
  const fieldY = H * fieldArea.y;
  const fieldW = W * fieldArea.w;
  const fieldH = H * fieldArea.h;
  const fieldCardW = cw * layout.cardScale.field;
  const fieldCardH = ch * layout.cardScale.field;
  
  ctx.fillStyle = 'rgba(8, 45, 21, 0.8)';
  roundRect(fieldX, fieldY, fieldW, fieldH, 15);
  ctx.fill();
  ctx.strokeStyle = '#2e5c3e';
  ctx.lineWidth = 3;
  roundRect(fieldX, fieldY, fieldW, fieldH, 15);
  ctx.stroke();
  
  drawText('场牌区', fieldX + fieldW/2, fieldY + 30, 22, '#558855');
  
  // 绘制场牌
  const cols = 4;
  const rows = 3;
  const gridW = (fieldW - 40) / cols;
  const gridH = (fieldH - 60) / rows;
  
  testModeState.field.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cardX = fieldX + 20 + col * gridW + (gridW - fieldCardW) / 2;
    const cardY = fieldY + 50 + row * gridH + (gridH - fieldCardH) / 2;
    drawCardIMG(cardX, cardY, id, fieldCardW, fieldCardH);
  });
  
  // 手牌区
  const playerArea = layout.areas.playerHand;
  const playerHandX = W * playerArea.x;
  const playerHandY = H * playerArea.y;
  const handCardW = cw * layout.cardScale.hand;
  const handCardH = ch * layout.cardScale.hand;
  
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(playerHandX - 20, playerHandY - 10, W * playerArea.w + 40, H * playerArea.h + 20, 10);
  ctx.fill();
  
  // 手牌横向排列（重叠 40%）
  const overlap = handCardW * 0.4;
  const handTotalW = handCardW + (testModeState.hand.length - 1) * overlap;
  const handStart = playerHandX + (W * playerArea.w - handTotalW) / 2;
  
  testModeState.hand.forEach((id, i) => {
    const cardX = handStart + i * overlap;
    drawCardIMG(cardX, playerHandY, id, handCardW, handCardH, false);
  });
  
  // 计分区（右侧）
  const rightCapArea = layout.areas.rightCapture;
  const rightCapX = W * rightCapArea.x;
  const rightCapY = H * rightCapArea.y;
  const rightCapW = W * rightCapArea.w;
  const rightCapH = H * rightCapArea.h;
  
  ctx.fillStyle = 'rgba(245, 245, 220, 0.95)';
  roundRect(rightCapX, rightCapY, rightCapW, rightCapH, 10);
  ctx.fill();
  ctx.strokeStyle = '#3C2415';
  ctx.lineWidth = 2;
  roundRect(rightCapX, rightCapY, rightCapW, rightCapH, 10);
  ctx.stroke();
  
  drawText('📊 收集区', rightCapX + 15, rightCapY + 30, 24, '#3C2415', 'left');
  drawText(`已收集：${testModeState.captured.length}张`, rightCapX + rightCapW/2, rightCapY + 80, 20, '#666');
  
  // 显示收集的牌
  const captureCards = testModeState.captured.slice(-12);
  const captureCardW = 30;
  const captureCardH = 48;
  const captureStartX = rightCapX + 20;
  const captureStartY = rightCapY + 100;
  
  captureCards.forEach((id, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    drawCardIMG(captureStartX + col * (captureCardW + 5), captureStartY + row * (captureCardH + 5), id, captureCardW, captureCardH);
  });
  
  // 山札
  const mountainArea = layout.areas.mountain;
  const mountainX = W * mountainArea.x;
  const mountainY = H * mountainArea.y;
  const mountainW = W * mountainArea.w;
  const mountainH = H * mountainArea.h;
  
  ctx.fillStyle = '#5D4037';
  roundRect(mountainX, mountainY, mountainW, mountainH, 8);
  ctx.fill();
  drawText('山札', mountainX + mountainW/2, mountainY + mountainH * 0.35, 18, '#fff');
  drawText(String(testModeState.deck.length), mountainX + mountainW/2, mountainY + mountainH * 0.6, 22, '#ffcc00');
  
  // 状态栏
  const statusArea = layout.areas.statusBar;
  ctx.fillStyle = 'rgba(26, 26, 46, 0.9)';
  ctx.fillRect(W * statusArea.x, H * statusArea.y, W * statusArea.w, H * statusArea.h);
  
  drawText('🎮 单机测试模式', W/2, H * 0.97, 22, '#4CAF50');
  drawText(`剩余：${testModeState.deck.length}张`, W * 0.9, H * 0.97, 20, '#aaa', 'right');
  
  // 状态提示
  drawText(statusMsg, W/2, H - 25, 18, '#ffcc00');
}
