/**
 * 花札在线对战 — 优化版交互逻辑（纯 JavaScript 版）
 * 可直接替换微信小游戏目录下的 game.js
 *
 * ===== 优化清单 =====
 * 1. 点击即出：单击手牌直接打出，无需"先选中再确认"
 * 2. 出牌动画：卡牌从手牌位置平滑移动到场牌位置（requestAnimationFrame + easeOutCubic 抛物线）
 * 3. 回合倒计时 + 高亮指示器：15秒倒计时，当前玩家区域发光高亮
 * 4. 自定义役达成弹窗：Canvas 内渲染，带动画进入/退出（替换 native wx.showModal）
 * 5. 触摸反馈：手牌按下缩小 5% + 微抬
 * 6. 长按拖拽：长按 200ms 可拖拽出牌，拖到场牌区松手即出
 * 7. 动画循环：requestAnimationFrame 驱动，统一管理所有动画
 * 8. 捕获区展示：已捕获卡牌按月分组显示
 */

// ==================== 配置 ====================
var CONFIG = {
  SERVER_URL: 'wss://your-server-url',
  CARD_W: 60,
  CARD_H: 96,
  SCREEN_W: 375,
  SCREEN_H: 667,
  TURN_TIMEOUT: 15,
  ANIM_DURATION: 350,
  MODAL_ANIM_IN: 200,
  MODAL_ANIM_OUT: 150,
  LONG_PRESS_DURATION: 200,
};

// ==================== 缓动函数 ====================
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t) {
  var c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ==================== 主游戏类 ====================
function GameOptimized() {
  var canvas = wx.createCanvas();
  this.ctx = canvas.getContext('2d');
  this.scene = 'loading';
  this.gameState = null;
  this.roomId = '';
  this.player = null;
  this.connected = false;
  this.socket = null;

  // 交互
  this.handCards = [];
  this.buttons = [];
  this.touchStartPos = null;
  this.touchStartTime = 0;
  this.longPressTimer = null;
  this.isLongPressing = false;
  this.isDragging = false;
  this.dragCard = null;
  this.dragOffsetX = 0;
  this.dragOffsetY = 0;
  this.pressFeedbackId = null;
  this.pressFeedbackStart = 0;

  // 动画
  this.flyingCards = [];
  this.rafId = null;
  this.lastFrameTime = 0;
  this.animating = false;

  // 弹窗
  this.modal = {
    visible: false, type: null, animProgress: 0,
    animating: false, animIn: true,
    yakuList: [], confirmText: '确定', cancelText: '',
    onConfirm: null, onCancel: null,
    roundScores: '', totalScores: '', gameOver: false,
  };

  // 倒计时
  this.turnTimer = {
    remaining: CONFIG.TURN_TIMEOUT, started: false, totalDuration: CONFIG.TURN_TIMEOUT
  };

  var self = this;
  this.setupEvents();
  this.boot();
}

// ==================== 启动 ====================
GameOptimized.prototype.boot = function () {
  var self = this;
  self.scene = 'loading';
  self.render();
  self.wxLogin().then(function (p) {
    self.player = p;
    console.log('[Auth] 登录成功:', p.nickname);
    self.connect();
  }).catch(function (e) {
    console.error('[Boot] 启动失败:', e);
    wx.showModal({
      title: '启动失败', content: '请检查网络后重试', showCancel: false,
      success: function () { self.boot(); }
    });
  });
};

GameOptimized.prototype.wxLogin = function () {
  var self = this;
  return new Promise(function (resolve) {
    wx.login({
      success: function (res) {
        var id = 'u_' + res.code.slice(-8);
        var nickname = '玩家' + id.slice(2, 6);
        var avatar = '';
        resolve({ id: id, nickname: nickname, avatar: avatar });
      },
      fail: function () { resolve({ id: 'u_guest', nickname: '游客', avatar: '' }); }
    });
  });
};

// ==================== 网络 ====================
GameOptimized.prototype.connect = function () {
  if (!this.player) return;
  var self = this;
  this.socket = wx.connectSocket({ url: CONFIG.SERVER_URL });
  this.socket.onOpen(function () { self.connected = true; });
  this.socket.onMessage(function (res) {
    var msg = JSON.parse(res.data);
    self.handleMsg(msg);
  });
  this.socket.onClose(function () {
    self.connected = false;
    setTimeout(function () { if (!self.connected) self.connect(); }, 3000);
  });
};

GameOptimized.prototype.handleMsg = function (msg) {
  switch (msg.type) {
    case 'room_created': case 'room_joined': case 'player_joined':
      this.roomId = msg.room ? msg.room.id : this.roomId;
      this.scene = 'room'; this.render(); break;
    case 'game_start':
      this.gameState = msg.state; this.scene = 'game';
      this.resetTurnTimer(); this.render(); this.startAnimLoop(); break;
    case 'state_update':
      this.gameState = msg.state;
      if (this.flyingCards.length === 0) this.render(); break;
    case 'yaku_found': this.showCustomYakuModal(msg.yaku || []); break;
    case 'round_end': this.showCustomRoundResult(msg); break;
    case 'game_end': this.showCustomGameResult(msg); break;
    case 'error': wx.showToast({ title: msg.message, icon: 'none', duration: 3000 }); break;
    case 'player_disconnected': wx.showToast({ title: '对手已断开', icon: 'none', duration: 3000 }); break;
  }
};

GameOptimized.prototype.send = function (type, payload) {
  if (!this.socket || !this.connected) return;
  this.socket.send({ data: JSON.stringify({ type: type, seq: Date.now(), timestamp: Date.now(), payload: payload }) });
};

GameOptimized.prototype.createRoom = function () { this.send('create_room'); };
GameOptimized.prototype.joinRoom = function (id) { this.send('join_room', id); };
GameOptimized.prototype.startGame = function () { this.send('start_game'); };
GameOptimized.prototype.playCard = function (id) { this.send('play_card', id); };
GameOptimized.prototype.callKoi = function () { this.send('koi_koi'); };
GameOptimized.prototype.endRound = function () { this.send('end_round'); };

// ==================== 事件 ====================
GameOptimized.prototype.setupEvents = function () {
  var self = this;
  wx.onTouchStart(function (e) {
    var touches = e.changedTouches || e.touches;
    for (var i = 0; i < touches.length; i++) {
      self.handleTouchStart(touches[i].clientX, touches[i].clientY);
    }
  });
  wx.onTouchMove(function (e) {
    var touches = e.changedTouches || e.touches;
    for (var i = 0; i < touches.length; i++) {
      self.handleTouchMove(touches[i].clientX, touches[i].clientY);
    }
  });
  wx.onTouchEnd(function (e) {
    var touches = e.changedTouches || e.touches;
    for (var i = 0; i < touches.length; i++) {
      self.handleTouchEnd(touches[i].clientX, touches[i].clientY);
    }
  });
};

GameOptimized.prototype.handleTouchStart = function (x, y) {
  this.touchStartPos = { x: x, y: y };
  this.touchStartTime = Date.now();
  this.isLongPressing = false;
  this.isDragging = false;

  // 弹窗优先
  if (this.modal.visible) { this.handleModalTouch(x, y); return; }

  // 按钮
  for (var i = 0; i < this.buttons.length; i++) {
    if (this.buttons[i].hit(x, y)) {
      this.buttons[i].setPressed(true);
      this.buttons[i].click();
      return;
    }
  }

  // 手牌
  if (this.scene === 'game' && this.gameState) {
    var myTurn = this.gameState.currentPlayerIndex === 0;
    if (!myTurn) return;
    for (var j = 0; j < this.handCards.length; j++) {
      var card = this.handCards[j];
      if (card.hit(x, y)) {
        var self = this;
        this.longPressTimer = setTimeout(function () {
          self.isLongPressing = true;
          wx.vibrateShort({ type: 'light' });
        }, CONFIG.LONG_PRESS_DURATION);
        this.pressFeedbackId = card.id;
        this.pressFeedbackStart = Date.now();
        return;
      }
    }
  }
};

GameOptimized.prototype.handleTouchMove = function (x, y) {
  if (!this.touchStartPos) return;
  var dx = x - this.touchStartPos.x;
  var dy = y - this.touchStartPos.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (this.isLongPressing && dist > 10 && this.scene === 'game') {
    this.isDragging = true;
    for (var i = 0; i < this.handCards.length; i++) {
      if (this.handCards[i].id === this.pressFeedbackId) {
        this.dragCard = this.handCards[i];
        this.dragOffsetX = dx;
        this.dragOffsetY = dy;
        break;
      }
    }
  }
};

GameOptimized.prototype.handleTouchEnd = function (x, y) {
  if (this.longPressTimer !== null) {
    clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
  }

  if (this.modal.visible) {
    this.closeModal();
    return;
  }

  // 拖拽出牌
  if (this.isDragging && this.dragCard) {
    var fz = this.getFieldZone();
    if (x >= fz.x && x <= fz.x + fz.w && y >= fz.y && y <= fz.y + fz.h) {
      this.playCardWithAnimation(this.dragCard.id);
    }
    this.isDragging = false;
    this.dragCard = null;
    this.render();
    return;
  }

  // 点击即出（核心优化）
  if (this.scene === 'game' && this.gameState && this.gameState.currentPlayerIndex === 0) {
    for (var i = 0; i < this.handCards.length; i++) {
      if (this.handCards[i].hit(x, y)) {
        this.playCardWithAnimation(this.handCards[i].id);
        return;
      }
    }
  }

  this.buttons.forEach(function (b) { b.setPressed(false); });
  this.pressFeedbackId = null;
  this.touchStartPos = null;
  this.isLongPressing = false;
  this.isDragging = false;
  this.dragCard = null;
};

GameOptimized.prototype.handleModalTouch = function () {};

GameOptimized.prototype.getFieldZone = function () {
  if (!this.gameState) return { x: 0, y: 0, w: 0, h: 0 };
  var field = this.gameState.field || [];
  var fStart = (CONFIG.SCREEN_W - field.length * (CONFIG.CARD_W + 6)) / 2;
  return { x: fStart - 20, y: 110, w: field.length * (CONFIG.CARD_W + 6) + 40, h: CONFIG.CARD_H + 30 };
};

// ==================== 出牌动画 ====================
GameOptimized.prototype.playCardWithAnimation = function (cardId) {
  var handCard = null;
  for (var i = 0; i < this.handCards.length; i++) {
    if (this.handCards[i].id === cardId) { handCard = this.handCards[i]; break; }
  }
  if (!handCard) return;

  var target = this.getFieldPlayTarget();
  var self = this;
  this.flyingCards.push({
    cardId: cardId,
    startX: handCard.x, startY: handCard.y,
    targetX: target.x, targetY: target.y,
    startW: CONFIG.CARD_W, startH: CONFIG.CARD_H,
    targetW: CONFIG.CARD_W, targetH: CONFIG.CARD_H,
    progress: 0, duration: CONFIG.ANIM_DURATION,
    onComplete: function () {
      self.playCard(cardId);
      self.pressFeedbackId = null;
    }
  });
  this.startAnimLoop();
};

GameOptimized.prototype.getFieldPlayTarget = function () {
  if (!this.gameState) return { x: CONFIG.SCREEN_W / 2, y: 150 };
  var field = this.gameState.field || [];
  var count = field.length;
  var startX = (CONFIG.SCREEN_W - count * (CONFIG.CARD_W + 6)) / 2;
  return { x: startX + count * (CONFIG.CARD_W + 6) + 10, y: 145 };
};

// ==================== 动画循环 ====================
GameOptimized.prototype.startAnimLoop = function () {
  if (this.animating) return;
  this.animating = true;
  this.lastFrameTime = performance.now();
  var self = this;
  this.animLoop();
};

GameOptimized.prototype.animLoop = function () {
  var self = this;
  var now = performance.now();
  var dt = now - this.lastFrameTime;
  this.lastFrameTime = now;
  var hasActive = false;

  // 飞行卡牌
  for (var i = this.flyingCards.length - 1; i >= 0; i--) {
    var fc = this.flyingCards[i];
    fc.progress += dt / fc.duration;
    if (fc.progress >= 1) {
      fc.progress = 1;
      fc.onComplete();
      this.flyingCards.splice(i, 1);
    } else { hasActive = true; }
  }

  // 弹窗动画
  if (this.modal.animating) {
    var speed = this.modal.animIn ? dt / CONFIG.MODAL_ANIM_IN : dt / CONFIG.MODAL_ANIM_OUT;
    this.modal.animProgress += this.modal.animIn ? speed : -speed;
    if (this.modal.animProgress >= 1) {
      this.modal.animProgress = 1; this.modal.animating = false;
      this.modal.animIn = true; this.modal.visible = true;
    } else if (this.modal.animProgress <= 0) {
      this.modal.animProgress = 0; this.modal.animating = false;
      this.modal.visible = false; this.modal.type = null;
    } else { hasActive = true; }
  }

  // 倒计时
  this.updateTurnTimer(dt);

  // 按下反馈
  if (this.pressFeedbackId !== null) hasActive = true;

  this.render();

  if (hasActive || this.flyingCards.length > 0) {
    this.rafId = requestAnimationFrame(function () { self.animLoop(); });
  } else {
    this.animating = false;
    this.rafId = null;
  }
};

// ==================== 倒计时 ====================
GameOptimized.prototype.resetTurnTimer = function () {
  this.turnTimer = {
    remaining: CONFIG.TURN_TIMEOUT,
    started: true,
    totalDuration: CONFIG.TURN_TIMEOUT
  };
};

GameOptimized.prototype.updateTurnTimer = function (dt) {
  if (!this.gameState) return;
  var myTurn = this.gameState.currentPlayerIndex === 0;
  if (myTurn && this.turnTimer.started) {
    this.turnTimer.remaining -= dt / 1000;
    if (this.turnTimer.remaining <= 0) {
      this.turnTimer.remaining = 0;
      this.autoPlay();
    }
  } else if (!myTurn) {
    this.turnTimer.remaining = CONFIG.TURN_TIMEOUT;
    this.turnTimer.started = false;
  } else {
    this.turnTimer.started = true;
  }
};

GameOptimized.prototype.autoPlay = function () {
  if (!this.gameState) return;
  var hand = this.gameState.hands ? this.gameState.hands[0] : [];
  if (hand.length > 0) {
    var rc = hand[Math.floor(Math.random() * hand.length)];
    this.playCardWithAnimation(rc);
  }
};

// ==================== 自定义弹窗 ====================
GameOptimized.prototype.showCustomYakuModal = function (yaku) {
  var self = this;
  this.modal = {
    visible: true, type: 'yaku', animProgress: 0, animating: true, animIn: true,
    yakuList: yaku, confirmText: '结束结算', cancelText: 'こいこい',
    onConfirm: function () { self.endRound(); },
    onCancel: function () { self.callKoi(); },
    roundScores: '', totalScores: '', gameOver: false,
  };
  if (!this.animating) this.startAnimLoop();
};

GameOptimized.prototype.showCustomRoundResult = function (msg) {
  var self = this;
  this.modal = {
    visible: true, type: 'roundEnd', animProgress: 0, animating: true, animIn: true,
    yakuList: [], confirmText: msg.gameOver ? '返回大厅' : '确定', cancelText: '',
    onConfirm: function () {
      if (msg.gameOver) {
        self.scene = 'menu'; self.gameState = null;
        if (self.rafId) cancelAnimationFrame(self.rafId);
        self.animating = false; self.render();
      }
    }, onCancel: null,
    roundScores: (msg.roundScores || [0, 0]).join(' : '),
    totalScores: (msg.totalScores || [0, 0]).join(' : '),
    gameOver: msg.gameOver || false,
  };
  if (!this.animating) this.startAnimLoop();
};

GameOptimized.prototype.showCustomGameResult = function (msg) {
  var self = this;
  this.modal = {
    visible: true, type: 'gameEnd', animProgress: 0, animating: true, animIn: true,
    yakuList: [], confirmText: '再来一局', cancelText: '返回大厅',
    onConfirm: function () { self.createRoom(); },
    onCancel: function () {
      self.scene = 'menu'; self.gameState = null;
      if (self.rafId) cancelAnimationFrame(self.rafId);
      self.animating = false; self.render();
    },
    roundScores: '', totalScores: (msg.totalScores || [0, 0]).join(' : '), gameOver: false,
  };
  if (!this.animating) this.startAnimLoop();
};

GameOptimized.prototype.closeModal = function () {
  if (this.modal.visible && !this.modal.animating) {
    this.modal.animating = true;
    this.modal.animIn = false;
  }
};

// ==================== 渲染 ====================
GameOptimized.prototype.render = function () {
  if (!this.ctx) return;
  var ctx = this.ctx;
  ctx.fillStyle = '#1a472a';
  ctx.fillRect(0, 0, CONFIG.SCREEN_W, CONFIG.SCREEN_H);
  switch (this.scene) {
    case 'menu': this.renderMenu(); break;
    case 'room': this.renderRoom(); break;
    case 'game': this.renderGame(); break;
  }
  if (this.modal.visible || this.modal.animProgress > 0) this.renderModal();
};

GameOptimized.prototype.renderMenu = function () {
  var ctx = this.ctx;
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 36px serif'; ctx.textAlign = 'center';
  ctx.fillText('🌸 花札 🌸', CONFIG.SCREEN_W / 2, 180);
  ctx.font = '18px serif'; ctx.fillStyle = '#ccc';
  ctx.fillText('Hanafuda Online', CONFIG.SCREEN_W / 2, 220);
  this.buttons = [
    new Btn('创建房间', CONFIG.SCREEN_W / 2 - 100, 300, 200, 50, '#4CAF50', function () { this.createRoom(); }.bind(this)),
    new Btn('加入房间', CONFIG.SCREEN_W / 2 - 100, 370, 200, 50, '#2196F3', function () { this.promptRoomId(); }.bind(this)),
  ];
  this.buttons.forEach(function (b) { b.draw(ctx); });
};

GameOptimized.prototype.renderRoom = function () {
  var ctx = this.ctx;
  ctx.fillStyle = '#fff'; ctx.font = 'bold 24px serif'; ctx.textAlign = 'center';
  ctx.fillText('等待对手', CONFIG.SCREEN_W / 2, 80);
  ctx.font = '20px serif'; ctx.fillStyle = '#FFD700';
  ctx.fillText('房间号: ' + this.roomId, CONFIG.SCREEN_W / 2, 130);
  ctx.font = '14px serif'; ctx.fillStyle = '#aaa';
  ctx.fillText('分享房间号邀请好友', CONFIG.SCREEN_W / 2, 170);
  this.buttons = [
    new Btn('📤 分享', CONFIG.SCREEN_W / 2 - 100, 240, 200, 50, '#FF9800', function () { this.share(); }.bind(this)),
    new Btn('开始游戏', CONFIG.SCREEN_W / 2 - 100, 310, 200, 50, '#4CAF50', function () { this.startGame(); }.bind(this)),
  ];
  this.buttons.forEach(function (b) { b.draw(ctx); });
};

GameOptimized.prototype.share = function () {
  wx.shareAppMessage({ title: '来一局花札！房间号：' + this.roomId, imageUrl: '', query: 'roomId=' + this.roomId });
};

GameOptimized.prototype.promptRoomId = function () {
  var self = this;
  wx.showModal({
    title: '输入房间号', editable: true, placeholderText: '6位数字',
    success: function (res) { if (res.confirm && res.content) self.joinRoom(res.content.trim()); }
  });
};

// ==================== 游戏场景渲染 ====================
GameOptimized.prototype.renderGame = function () {
  var ctx = this.ctx;
  if (!this.gameState) return;
  var gs = this.gameState;
  var myTurn = gs.currentPlayerIndex === 0;

  // --- 对手区 ---
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, CONFIG.SCREEN_W, 60);
  if (!myTurn) {
    ctx.strokeStyle = '#FF9800'; ctx.lineWidth = 2;
    ctx.shadowColor = '#FF9800'; ctx.shadowBlur = 8;
    ctx.strokeRect(2, 2, CONFIG.SCREEN_W - 4, 56);
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('🤵 对手 · ' + (gs.players && gs.players[1] ? gs.players[1].nickname : ''), CONFIG.SCREEN_W / 2, 20);
  ctx.font = '12px sans-serif'; ctx.fillStyle = '#FFD700';
  ctx.fillText('得分: ' + (gs.totalScores ? gs.totalScores[1] : 0), CONFIG.SCREEN_W / 2, 38);

  var oppN = gs.hands && gs.hands[1] ? gs.hands[1].length : 0;
  var oppStart = (CONFIG.SCREEN_W - oppN * 20) / 2;
  for (var i = 0; i < oppN; i++) this.drawCardBack(oppStart + i * 20, 42);

  // --- 场牌 ---
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  this.roundRect(ctx, 10, 105, CONFIG.SCREEN_W - 20, CONFIG.CARD_H + 30, 8); ctx.fill();

  var field = gs.field || [];
  var fStart = (CONFIG.SCREEN_W - field.length * (CONFIG.CARD_W + 6)) / 2;
  for (var j = 0; j < field.length; j++) {
    this.drawCard(fStart + j * (CONFIG.CARD_W + 6), 115, field[j]);
  }

  // 山札
  var deckCount = gs.deck ? gs.deck.length : 0;
  var deckX = CONFIG.SCREEN_W - 75;
  ctx.fillStyle = '#3E2723';
  this.roundRect(ctx, deckX, 115, CONFIG.CARD_W, CONFIG.CARD_H * 0.5, 4); ctx.fill();
  ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 1;
  this.roundRect(ctx, deckX, 115, CONFIG.CARD_W, CONFIG.CARD_H * 0.5, 4); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('山札', deckX + CONFIG.CARD_W / 2, 138);
  ctx.fillText(String(deckCount), deckX + CONFIG.CARD_W / 2, 155);

  // 回合指示器
  this.renderTurnIndicator(myTurn);

  // 飞行动画
  for (var k = 0; k < this.flyingCards.length; k++) {
    var fc = this.flyingCards[k];
    var t = easeOutCubic(fc.progress);
    var cx = fc.startX + (fc.targetX - fc.startX) * t;
    var cy = fc.startY + (fc.targetY - fc.startY) * t;
    var arc = Math.sin(t * Math.PI) * -30;
    var scale = 1 + Math.sin(t * Math.PI) * 0.08;
    var fw = fc.startW * scale, fh = fc.startH * scale;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 15; ctx.shadowOffsetY = 8;
    this.drawCardRaw(cx - (fw - CONFIG.CARD_W) / 2, cy + arc - (fh - CONFIG.CARD_H) / 2, fc.cardId, false, fw, fh);
    ctx.restore();
  }

  // --- 手牌 ---
  var hand = gs.hands && gs.hands[0] ? gs.hands[0] : [];
  var hStart = (CONFIG.SCREEN_W - hand.length * (CONFIG.CARD_W + 4)) / 2;
  var handBaseY = CONFIG.SCREEN_H - 120;
  this.handCards = [];

  for (var l = 0; l < hand.length; l++) {
    var id = hand[l];
    var hx = hStart + l * (CONFIG.CARD_W + 4);
    var hy = handBaseY;
    var scaleX = 1, scaleY = 1;

    if (this.pressFeedbackId === id) {
      var pressDur = Date.now() - this.pressFeedbackStart;
      var pressT = Math.min(pressDur / 100, 1);
      var s = easeOutBack(pressT);
      scaleX = 1 - 0.05 * s; scaleY = 1 - 0.05 * s;
      hy -= 15 * s;
    }

    if (this.isDragging && this.dragCard && this.dragCard.id === id) {
      hx += this.dragOffsetX; hy += this.dragOffsetY;
      scaleX = 1.1; scaleY = 1.1;
    }

    this.drawCard(hx, hy, id, false, scaleX, scaleY);
    this.handCards.push(new CardV(hx, hy, CONFIG.CARD_W * scaleX, CONFIG.CARD_H * scaleY, id));
  }

  // --- 玩家区 ---
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, CONFIG.SCREEN_H - 50, CONFIG.SCREEN_W, 50);
  if (myTurn) {
    ctx.strokeStyle = '#4CAF50'; ctx.lineWidth = 2;
    ctx.shadowColor = '#4CAF50'; ctx.shadowBlur = 8;
    ctx.strokeRect(2, CONFIG.SCREEN_H - 48, CONFIG.SCREEN_W - 4, 46);
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText((gs.players && gs.players[0] ? gs.players[0].nickname : '你') + ' · 得分: ' + (gs.totalScores ? gs.totalScores[0] : 0), CONFIG.SCREEN_W / 2, CONFIG.SCREEN_H - 25);

  if (gs.koiKoiCount > 0) {
    ctx.fillStyle = '#FF5722'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('Koi ×' + gs.koiKoiCount, CONFIG.SCREEN_W - 15, CONFIG.SCREEN_H - 25);
  }

  // 捕获区
  this.renderCapturedArea();
};

GameOptimized.prototype.renderTurnIndicator = function (myTurn) {
  var ctx = this.ctx;
  var bx = 10, by = 125, bw = 110, bh = 34;

  if (myTurn) {
    ctx.save(); ctx.shadowColor = '#4CAF50'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#4CAF50';
    this.roundRect(ctx, bx, by, bw, bh, 6); ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255,152,0,0.7)';
    this.roundRect(ctx, bx, by, bw, bh, 6); ctx.fill();
  }

  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(myTurn ? '✋ 你的回合' : '⏳ 对手思考中', bx + bw / 2, by + 22);

  if (myTurn && this.turnTimer.started) {
    var sec = Math.ceil(this.turnTimer.remaining);
    ctx.fillStyle = sec <= 5 ? '#FF5722' : '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(sec + 's', bx + bw / 2, by + bh + 24);
    var ratio = this.turnTimer.remaining / this.turnTimer.totalDuration;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(bx, by + bh + 30, bw, 4);
    ctx.fillStyle = sec <= 5 ? '#FF5722' : '#4CAF50';
    ctx.fillRect(bx, by + bh + 30, bw * ratio, 4);
  }
};

GameOptimized.prototype.renderCapturedArea = function () {
  if (!this.gameState) return;
  var captured = this.gameState.captured && this.gameState.captured[0] ? this.gameState.captured[0] : [];
  if (captured.length === 0) return;

  var ctx = this.ctx;
  var startX = 10, startY = 175;
  var months = {};
  for (var i = 0; i < captured.length; i++) {
    var m = Math.floor(captured[i] / 4) + 1;
    months[m] = (months[m] || 0) + 1;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  this.roundRect(ctx, startX - 5, startY - 16, 200, 50, 6); ctx.fill();

  ctx.font = '10px sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  ctx.fillText('已捕获:', startX, startY - 3);

  var monthColors = ['', '#4CAF50', '#FF80AB', '#64B5F6', '#90A4AE', '#FF7043', '#EC407A', '#8D6E63', '#FFB74D', '#FFD54F', '#A1887F', '#66BB6A', '#EF5350'];
  var x = startX;
  var sortedMonths = Object.keys(months).map(Number).sort(function (a, b) { return a - b; });
  for (var j = 0; j < sortedMonths.length; j++) {
    var mm = sortedMonths[j];
    ctx.fillStyle = monthColors[mm] || '#fff';
    ctx.beginPath(); ctx.arc(x + 10, startY + 12, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(mm), x + 10, startY + 15);
    ctx.font = '9px sans-serif';
    ctx.fillText('×' + months[mm], x + 10, startY + 26);
    x += 24;
  }
};

// ==================== 弹窗渲染 ====================
GameOptimized.prototype.renderModal = function () {
  var ctx = this.ctx;
  var alpha = this.modal.animProgress;
  var scaleVal = 0.8 + 0.2 * easeOutBack(Math.min(alpha, 1));

  ctx.fillStyle = 'rgba(0,0,0,' + (0.6 * alpha) + ')';
  ctx.fillRect(0, 0, CONFIG.SCREEN_W, CONFIG.SCREEN_H);

  var mw = 300;
  var mh = this.modal.type === 'yaku' ? 240 : 180;
  var mx = (CONFIG.SCREEN_W - mw) / 2;
  var my = (CONFIG.SCREEN_H - mh) / 2;

  ctx.save();
  ctx.translate(CONFIG.SCREEN_W / 2, CONFIG.SCREEN_H / 2);
  ctx.scale(scaleVal, scaleVal);
  ctx.translate(-CONFIG.SCREEN_W / 2, -CONFIG.SCREEN_H / 2);

  ctx.fillStyle = '#FFF8E1';
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 20;
  this.roundRect(ctx, mx, my, mw, mh, 12); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';

  switch (this.modal.type) {
    case 'yaku': this.renderYakuModal(mx, my, mw, mh); break;
    case 'roundEnd': this.renderRoundEndModal(mx, my, mw, mh); break;
    case 'gameEnd': this.renderGameEndModal(mx, my, mw, mh); break;
  }

  ctx.restore();
};

GameOptimized.prototype.renderYakuModal = function (mx, my, mw, mh) {
  var ctx = this.ctx;
  var yaku = this.modal.yakuList || [];

  ctx.fillStyle = '#FF5722'; ctx.font = 'bold 20px serif';
  ctx.fillText('🎉 役达成！', mx + mw / 2, my + 35);
  ctx.strokeStyle = '#E0E0E0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(mx + 20, my + 45); ctx.lineTo(mx + mw - 20, my + 45); ctx.stroke();

  ctx.fillStyle = '#333'; ctx.font = '15px sans-serif';
  var y = my + 75;
  for (var i = 0; i < yaku.length; i++) {
    ctx.fillText(yaku[i].label, mx + mw / 2, y);
    ctx.fillStyle = '#FF9800'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText(yaku[i].points + '分', mx + mw / 2, y + 18);
    ctx.fillStyle = '#333'; ctx.font = '15px sans-serif';
    y += 38;
  }

  var btnW = 110, btnH = 36, btnY = my + mh - 55;
  var self = this;
  this.buttons = [
    new Btn(this.modal.confirmText, mx + 25, btnY, btnW, btnH, '#4CAF50', function () {
      if (self.modal.onConfirm) self.modal.onConfirm(); self.closeModal();
    }),
  ];
  if (this.modal.cancelText) {
    this.buttons.push(new Btn(this.modal.cancelText, mx + mw - 135, btnY, btnW, btnH, '#FF9800', function () {
      if (self.modal.onCancel) self.modal.onCancel(); self.closeModal();
    }));
  }
  this.buttons.forEach(function (b) { b.draw(ctx); });
};

GameOptimized.prototype.renderRoundEndModal = function (mx, my, mw, mh) {
  var ctx = this.ctx;
  var self = this;
  ctx.fillStyle = this.modal.gameOver ? '#FF5722' : '#2196F3'; ctx.font = 'bold 20px serif';
  ctx.fillText(this.modal.gameOver ? '🏁 游戏结束' : '本局结算', mx + mw / 2, my + 35);
  ctx.strokeStyle = '#E0E0E0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(mx + 20, my + 45); ctx.lineTo(mx + mw - 20, my + 45); ctx.stroke();

  ctx.fillStyle = '#333'; ctx.font = '15px sans-serif';
  ctx.fillText('本局: ' + this.modal.roundScores, mx + mw / 2, my + 75);
  ctx.fillText('累计: ' + this.modal.totalScores, mx + mw / 2, my + 100);

  this.buttons = [
    new Btn(this.modal.confirmText, mx + (mw - 110) / 2, my + mh - 55, 110, 36, '#2196F3', function () {
      if (self.modal.onConfirm) self.modal.onConfirm(); self.closeModal();
    }),
  ];
  this.buttons.forEach(function (b) { b.draw(ctx); });
};

GameOptimized.prototype.renderGameEndModal = function (mx, my, mw, mh) {
  var ctx = this.ctx;
  var self = this;
  ctx.fillStyle = '#FFD700'; ctx.font = 'bold 22px serif';
  ctx.fillText('🏆 游戏结束', mx + mw / 2, my + 35);
  ctx.strokeStyle = '#E0E0E0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(mx + 20, my + 45); ctx.lineTo(mx + mw - 20, my + 45); ctx.stroke();

  ctx.fillStyle = '#333'; ctx.font = '16px sans-serif';
  ctx.fillText('最终比分: ' + this.modal.totalScores, mx + mw / 2, my + 80);

  this.buttons = [
    new Btn(this.modal.confirmText, mx + 25, my + mh - 55, 110, 36, '#4CAF50', function () {
      if (self.modal.onConfirm) self.modal.onConfirm(); self.closeModal();
    }),
    new Btn(this.modal.cancelText, mx + mw - 135, my + mh - 55, 110, 36, '#9E9E9E', function () {
      if (self.modal.onCancel) self.modal.onCancel(); self.closeModal();
    }),
  ];
  this.buttons.forEach(function (b) { b.draw(ctx); });
};

// ==================== 绘制 ====================
GameOptimized.prototype.drawCard = function (x, y, id, selected, scaleX, scaleY) {
  var ctx = this.ctx;
  if (!ctx) return;
  if (scaleX === undefined) scaleX = 1;
  if (scaleY === undefined) scaleY = 1;
  var w = CONFIG.CARD_W * scaleX, h = CONFIG.CARD_H * scaleY;
  var ox = (CONFIG.CARD_W - w) / 2, oy = (CONFIG.CARD_H - h) / 2;
  this.drawCardRaw(x + ox, y + oy, id, selected, w, h);
};

GameOptimized.prototype.drawCardRaw = function (x, y, id, selected, w, h) {
  var ctx = this.ctx;
  if (!ctx) return;
  if (w === undefined) w = CONFIG.CARD_W;
  if (h === undefined) h = CONFIG.CARD_H;

  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#FFFDE7';
  this.roundRect(ctx, x, y, w, h, 4); ctx.fill();
  ctx.shadowColor = 'transparent';

  if (selected) {
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 3;
    this.roundRect(ctx, x - 1, y - 1, w + 2, h + 2, 5); ctx.stroke();
  }

  var month = Math.floor(id / 4) + 1;
  var pos = id % 4;
  var cats = ['光', '短', '種', 'カ'];
  ctx.fillStyle = '#333';
  ctx.font = 'bold ' + Math.round(16 * w / CONFIG.CARD_W) + 'px serif';
  ctx.textAlign = 'center';
  ctx.fillText(month + '月', x + w / 2, y + h / 2 - 5);
  ctx.font = Math.round(10 * w / CONFIG.CARD_W) + 'px sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText(cats[pos], x + w / 2, y + h / 2 + 15);
};

GameOptimized.prototype.drawCardBack = function (x, y) {
  var ctx = this.ctx;
  if (!ctx) return;
  ctx.fillStyle = '#2E7D32';
  this.roundRect(ctx, x, y, 15, 24, 2); ctx.fill();
  ctx.strokeStyle = '#1B5E20'; ctx.lineWidth = 0.5;
  this.roundRect(ctx, x, y, 15, 24, 2); ctx.stroke();
};

// roundRect polyfill
GameOptimized.prototype.roundRect = function (ctx, x, y, w, h, r) {
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
};

// ==================== 按钮 ====================
function Btn(text, x, y, w, h, color, click) {
  this.text = text; this.x = x; this.y = y; this.w = w; this.h = h;
  this.color = color; this.click = click;
  this.pressed = false;
}

Btn.prototype.setPressed = function (p) { this.pressed = p; };
Btn.prototype.hit = function (px, py) {
  return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
};
Btn.prototype.draw = function (ctx) {
  var scale = this.pressed ? 0.96 : 1;
  var ox = this.pressed ? this.w * 0.02 : 0;
  var oy = this.pressed ? this.h * 0.02 : 0;
  ctx.save();
  ctx.fillStyle = this.pressed ? this.darken(this.color) : this.color;
  this._roundRect(ctx, this.x + ox, this.y + oy, this.w * scale, this.h * scale, 8);
  ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(this.text, this.x + this.w / 2, this.y + this.h / 2 + 5);
  ctx.restore();
};
Btn.prototype._roundRect = function (ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
};
Btn.prototype.darken = function (hex) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  function d(c) { return Math.max(0, Math.round(c * 0.85)).toString(16).padStart(2, '0'); }
  return '#' + d(r) + d(g) + d(b);
};

// ==================== 牌视图 ====================
function CardV(x, y, w, h, id) {
  this.x = x; this.y = y; this.w = w; this.h = h; this.id = id;
}
CardV.prototype.hit = function (px, py) {
  return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
};

// ==================== 启动 ====================
new GameOptimized();
