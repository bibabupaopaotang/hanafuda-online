/**
 * 花札在线对战 — 优化版交互逻辑（微信小游戏）
 *
 * 核心优化点：
 * 1. 点击即出：单击手牌直接打出，无需"先选中再确认"
 * 2. 出牌动画：卡牌从手牌位置平滑移动到场牌位置（requestAnimationFrame + easeOutCubic 缓动）
 * 3. 回合倒计时 + 高亮指示器：15秒倒计时，当前玩家区域发光高亮
 * 4. 自定义役达成弹窗：Canvas 内渲染，带动画进入/退出
 * 5. 触摸反馈：手牌按下缩小 5% + 金色边框
 * 6. 拖拽支持：长按 200ms 可拖拽出牌（可选）
 */

// ==================== 配置 ====================
const CONFIG = {
  SERVER_URL: 'wss://your-server-url',
  CARD_W: 60,
  CARD_H: 96,
  SCREEN_W: 375,
  SCREEN_H: 667,
  TURN_TIMEOUT: 15,           // 回合倒计时（秒）
  ANIM_DURATION: 350,         // 出牌动画时长（ms）
  MODAL_ANIM_IN: 200,         // 弹窗进入动画时长
  MODAL_ANIM_OUT: 150,        // 弹窗退出动画时长
  LONG_PRESS_DURATION: 200,   // 长按触发拖拽的时长
};

// ==================== 缓动函数 ====================
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ==================== 场景枚举 ====================
enum Scene { MENU = 'menu', LOADING = 'loading', ROOM = 'room', GAME = 'game' }

// ==================== 用户信息 ====================
interface PlayerInfo {
  id: string;
  nickname: string;
  avatar: string;
}

// ==================== 动画状态 ====================
interface FlyingCard {
  cardId: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startW: number;
  startH: number;
  targetW: number;
  targetH: number;
  progress: number;      // 0 → 1
  duration: number;       // ms
  onComplete: () => void;
}

// ==================== 弹窗状态 ====================
interface ModalState {
  visible: boolean;
  type: 'yaku' | 'roundEnd' | 'gameEnd' | null;
  animProgress: number;  // 0 → 1 (in), 1 → 0 (out)
  animating: boolean;
  animIn: boolean;        // true = entering, false = exiting
  // yaku
  yakuList?: any[];
  // round/game end
  roundScores?: string;
  totalScores?: string;
  gameOver?: boolean;
  // 回调
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

// ==================== 回合倒计时 ====================
interface TurnTimer {
  remaining: number;
  started: boolean;
  totalDuration: number;
}

// ==================== 主游戏类 ====================
class GameOptimized {
  private ctx: WechatMinigame.CanvasRenderingContext | null = null;
  private socket: WechatMinigame.SocketTask | null = null;
  private scene: Scene = Scene.LOADING;
  private gameState: any = null;
  private roomId: string = '';
  private player: PlayerInfo | null = null;
  private connected: boolean = false;

  // 交互相关
  private handCards: CardV[] = [];
  private buttons: BtnV2[] = [];
  private touchStartPos: { x: number; y: number } | null = null;
  private touchStartTime: number = 0;
  private longPressTimer: number | null = null;
  private isLongPressing: boolean = false;
  private isDragging: boolean = false;
  private dragCard: CardV | null = null;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;
  private pressFeedbackId: number | null = null;  // 按下反馈的卡牌ID
  private pressFeedbackStart: number = 0;

  // 动画
  private flyingCards: FlyingCard[] = [];
  private rafId: number | null = null;
  private lastFrameTime: number = 0;
  private animating: boolean = false;

  // 弹窗
  private modal: ModalState = {
    visible: false,
    type: null,
    animProgress: 0,
    animating: false,
    animIn: true,
  };

  // 回合倒计时
  private turnTimer: TurnTimer = {
    remaining: CONFIG.TURN_TIMEOUT,
    started: false,
    totalDuration: CONFIG.TURN_TIMEOUT,
  };

  constructor() {
    const canvas = wx.createCanvas();
    this.ctx = canvas.getContext('2d')!;
    this.setupEvents();
    this.boot();
  }

  // ==================== 启动流程 ====================
  private async boot(): Promise<void> {
    this.scene = Scene.LOADING;
    this.render();

    try {
      this.player = await this.wxLogin();
      console.log('[Auth] 登录成功:', this.player.nickname);
      this.connect();
    } catch (e) {
      console.error('[Boot] 启动失败:', e);
      wx.showModal({
        title: '启动失败',
        content: '请检查网络后重试',
        showCancel: false,
        success: () => this.boot(),
      });
    }
  }

  private async wxLogin(): Promise<PlayerInfo> {
    const loginRes = await new Promise<WechatMinigame.LoginSuccessCallbackResult>(
      (resolve, reject) => wx.login({ success: resolve, fail: reject })
    );
    const id = 'u_' + loginRes.code.slice(-8);

    let nickname = `玩家${id.slice(2, 6)}`;
    let avatar = '';
    try {
      const p: any = await new Promise((resolve, reject) =>
        wx.getUserProfile({ desc: '用于显示昵称和头像', success: resolve, fail: reject })
      );
      nickname = p.userInfo?.nickName || nickname;
      avatar = p.userInfo?.avatarUrl || '';
    } catch { /* 用户拒绝 */ }

    return { id, nickname, avatar };
  }

  // ==================== 网络 ====================
  private connect(): void {
    if (!this.player) return;
    this.socket = wx.connectSocket({
      url: CONFIG.SERVER_URL,
      fail: (e) => console.error('[Socket] 连接失败:', e),
    });

    this.socket.onOpen(() => {
      this.connected = true;
    });

    this.socket.onMessage((res) => {
      const msg = JSON.parse(res.data as string);
      this.handleMsg(msg);
    });

    this.socket.onClose(() => {
      this.connected = false;
      setTimeout(() => { if (!this.connected) this.connect(); }, 3000);
    });

    this.socket.onError((e) => console.error('[Socket] 错误:', e));
  }

  private handleMsg(msg: any): void {
    switch (msg.type) {
      case 'room_created':
      case 'room_joined':
      case 'player_joined':
        this.roomId = msg.room?.id || this.roomId;
        this.scene = Scene.ROOM;
        this.render();
        break;

      case 'game_start':
        this.gameState = msg.state;
        this.scene = Scene.GAME;
        this.resetTurnTimer();
        this.render();
        this.startAnimLoop();
        break;

      case 'state_update':
        this.gameState = msg.state;
        // 如果动画正在进行，不立即渲染，等动画完成
        if (this.flyingCards.length === 0) {
          this.render();
        }
        break;

      case 'yaku_found':
        // 先展示弹窗，而不是 native wx.showModal
        this.showCustomYakuModal(msg.yaku || []);
        break;

      case 'round_end':
        this.showCustomRoundResult(msg);
        break;

      case 'game_end':
        this.showCustomGameResult(msg);
        break;

      case 'error':
        wx.showToast({ title: msg.message, icon: 'none', duration: 3000 });
        break;

      case 'player_disconnected':
        wx.showToast({ title: '对手已断开', icon: 'none', duration: 3000 });
        break;
    }
  }

  private send(type: string, payload?: any): void {
    if (!this.socket || !this.connected) return;
    this.socket.send({
      data: JSON.stringify({ type, seq: Date.now(), timestamp: Date.now(), payload }),
    });
  }

  // ==================== 游戏操作 ====================
  createRoom(): void { this.send('create_room'); }
  joinRoom(id: string): void { this.send('join_room', id); }
  startGame(): void { this.send('start_game'); }
  playCard(id: number): void { this.send('play_card', id); }
  callKoi(): void { this.send('koi_koi'); }
  endRound(): void { this.send('end_round'); }

  // ==================== 事件处理 ====================
  private setupEvents(): void {
    // 触摸开始
    wx.onTouchStart((e) => {
      for (const touch of e.changedTouches || e.touches) {
        this.handleTouchStart(touch.clientX, touch.clientY);
      }
    });

    // 触摸移动
    wx.onTouchMove((e) => {
      for (const touch of e.changedTouches || e.touches) {
        this.handleTouchMove(touch.clientX, touch.clientY);
      }
    });

    // 触摸结束
    wx.onTouchEnd((e) => {
      for (const touch of e.changedTouches || e.touches) {
        this.handleTouchEnd(touch.clientX, touch.clientY);
      }
    });
  }

  // --- 触摸开始 ---
  private handleTouchStart(x: number, y: number): void {
    this.touchStartPos = { x, y };
    this.touchStartTime = Date.now();
    this.isLongPressing = false;
    this.isDragging = false;

    // 1) 先处理弹窗触摸（高优先级）
    if (this.modal.visible) {
      this.handleModalTouch(x, y);
      return;
    }

    // 2) 按钮优先
    for (const btn of this.buttons) {
      if (btn.hit(x, y)) {
        this.buttons.forEach(b => b.setPressed(true));
        btn.click();
        return;
      }
    }

    // 3) 游戏场景：手牌触摸
    if (this.scene === Scene.GAME && this.gameState) {
      const myTurn = this.gameState.currentPlayerIndex === 0;
      if (!myTurn) return; // 不是我的回合

      for (const card of this.handCards) {
        if (card.hit(x, y)) {
          // 启动长按计时器
          this.longPressTimer = setTimeout(() => {
            this.isLongPressing = true;
            wx.vibrateShort({ type: 'light' });
          }, CONFIG.LONG_PRESS_DURATION) as unknown as number;

          this.pressFeedbackId = card.id;
          this.pressFeedbackStart = Date.now();
          return;
        }
      }
    }
  }

  // --- 触摸移动 ---
  private handleTouchMove(x: number, y: number): void {
    if (!this.touchStartPos) return;

    // 拖拽判定：移动超过 10px 且是长按状态
    const dx = x - this.touchStartPos.x;
    const dy = y - this.touchStartPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.isLongPressing && dist > 10 && this.scene === Scene.GAME) {
      this.isDragging = true;
      // 找到被拖拽的牌
      for (const card of this.handCards) {
        if (card.id === this.pressFeedbackId) {
          this.dragCard = card;
          this.dragOffsetX = dx;
          this.dragOffsetY = dy;
          break;
        }
      }
    }

    // 更新按钮按下状态
    if (!this.isDragging) {
      let anyBtnHit = false;
      for (const btn of this.buttons) {
        if (btn.hit(x, y)) {
          btn.setPressed(true);
          anyBtnHit = true;
        } else {
          btn.setPressed(false);
        }
      }
      if (!anyBtnHit) {
        this.buttons.forEach(b => b.setPressed(false));
      }
    }
  }

  // --- 触摸结束 ---
  private handleTouchEnd(x: number, y: number): void {
    // 清除长按计时器
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    // 弹窗优先
    if (this.modal.visible) {
      this.modal.visible = false;
      this.modal.type = null;
      return;
    }

    // 拖拽出牌
    if (this.isDragging && this.dragCard) {
      // 判定拖拽目标：如果手指在「场牌区域」上方则出牌
      const fieldZone = this.getFieldZone();
      if (x >= fieldZone.x && x <= fieldZone.x + fieldZone.w &&
          y >= fieldZone.y && y <= fieldZone.y + fieldZone.h) {
        // 在有效区域松手 → 出牌
        this.playCardWithAnimation(this.dragCard.id);
      }
      // 否则取消
      this.isDragging = false;
      this.dragCard = null;
      this.render();
      return;
    }

    // 非拖拽情况：点击手牌 → 立即出牌（核心优化：点击即出）
    if (this.scene === Scene.GAME && this.gameState &&
        this.gameState.currentPlayerIndex === 0) {
      for (const card of this.handCards) {
        if (card.hit(x, y)) {
          this.playCardWithAnimation(card.id);
          return;
        }
      }
    }

    // 按钮点击已在 TouchStart 中处理，这里恢复状态
    this.buttons.forEach(b => b.setPressed(false));

    // 重置
    this.pressFeedbackId = null;
    this.touchStartPos = null;
    this.isLongPressing = false;
    this.isDragging = false;
    this.dragCard = null;
  }

  // 获取场牌区域（用于拖拽判定）
  private getFieldZone(): { x: number; y: number; w: number; h: number } {
    if (!this.gameState) return { x: 0, y: 0, w: 0, h: 0 };
    const { SCREEN_W, CARD_W, CARD_H } = CONFIG;
    const field = this.gameState.field || [];
    const fStart = (SCREEN_W - field.length * (CARD_W + 6)) / 2;
    return {
      x: fStart - 20,
      y: 120,
      w: field.length * (CARD_W + 6) + 40,
      h: CARD_H + 20,
    };
  }

  // --- 弹窗触摸 ---
  private handleModalTouch(_x: number, _y: number): void {
    // 弹窗中触摸不触发其他交互
  }

  // ==================== 出牌动画 ====================
  private playCardWithAnimation(cardId: number): void {
    // 找到手牌的位置
    let handCard: CardV | null = null;
    for (const c of this.handCards) {
      if (c.id === cardId) { handCard = c; break; }
    }
    if (!handCard) return;

    // 计算目标位置（场牌区中央）
    const fieldTarget = this.getFieldPlayTarget();

    const flyingCard: FlyingCard = {
      cardId,
      startX: handCard.x,
      startY: handCard.y,
      targetX: fieldTarget.x,
      targetY: fieldTarget.y,
      startW: CONFIG.CARD_W,
      startH: CONFIG.CARD_H,
      targetW: CONFIG.CARD_W,
      targetH: CONFIG.CARD_H,
      progress: 0,
      duration: CONFIG.ANIM_DURATION,
      onComplete: () => {
        // 动画完成后才发送网络请求
        this.playCard(cardId);
        this.pressFeedbackId = null;
      },
    };

    this.flyingCards.push(flyingCard);
    this.startAnimLoop();
  }

  // 计算场牌放置目标
  private getFieldPlayTarget(): { x: number; y: number } {
    if (!this.gameState) return { x: CONFIG.SCREEN_W / 2, y: 160 };
    const field = this.gameState.field || [];
    const count = field.length;
    const startX = (CONFIG.SCREEN_W - count * (CONFIG.CARD_W + 6)) / 2;
    // 放在场牌最右端（视觉上即将落下的位置）
    return {
      x: startX + count * (CONFIG.CARD_W + 6) + 10,
      y: 150,
    };
  }

  // ==================== 动画循环 ====================
  private startAnimLoop(): void {
    if (this.animating) return;
    this.animating = true;
    this.lastFrameTime = performance.now();
    this.animLoop();
  }

  private animLoop = (): void => {
    const now = performance.now();
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;

    let hasActive = false;

    // 更新飞行卡牌
    for (let i = this.flyingCards.length - 1; i >= 0; i--) {
      const fc = this.flyingCards[i];
      fc.progress += dt / fc.duration;
      if (fc.progress >= 1) {
        fc.progress = 1;
        fc.onComplete();
        this.flyingCards.splice(i, 1);
      } else {
        hasActive = true;
      }
    }

    // 更新弹窗动画
    if (this.modal.animating) {
      const speed = this.modal.animIn
        ? dt / CONFIG.MODAL_ANIM_IN
        : dt / CONFIG.MODAL_ANIM_OUT;
      this.modal.animProgress += this.modal.animIn ? speed : -speed;

      if (this.modal.animProgress >= 1) {
        this.modal.animProgress = 1;
        this.modal.animating = false;
        this.modal.animIn = true;
        this.modal.visible = true;
      } else if (this.modal.animProgress <= 0) {
        this.modal.animProgress = 0;
        this.modal.animating = false;
        this.modal.visible = false;
        this.modal.type = null;
      } else {
        hasActive = true;
      }
    }

    // 倒计时更新
    this.updateTurnTimer(dt);

    // 按下反馈动画
    if (this.pressFeedbackId !== null) {
      hasActive = true; // 保持渲染以显示按下效果
    }

    this.render();

    if (hasActive || this.flyingCards.length > 0) {
      this.rafId = requestAnimationFrame(this.animLoop);
    } else {
      this.animating = false;
      this.rafId = null;
    }
  };

  // ==================== 回合倒计时 ====================
  private resetTurnTimer(): void {
    this.turnTimer = {
      remaining: CONFIG.TURN_TIMEOUT,
      started: true,
      totalDuration: CONFIG.TURN_TIMEOUT,
    };
  }

  private updateTurnTimer(dt: number): void {
    if (!this.gameState || this.turnTimer.started) {
      const myTurn = this.gameState?.currentPlayerIndex === 0;
      if (myTurn && this.turnTimer.started) {
        this.turnTimer.remaining -= dt / 1000;
        if (this.turnTimer.remaining <= 0) {
          this.turnTimer.remaining = 0;
          // 超时自动随机出一张
          this.autoPlay();
        }
      } else if (!myTurn) {
        // 对手回合，重置计时器
        this.turnTimer.remaining = CONFIG.TURN_TIMEOUT;
        this.turnTimer.started = false;
      } else {
        this.turnTimer.started = true;
      }
    }
  }

  private autoPlay(): void {
    if (!this.gameState) return;
    const hand = this.gameState.hands?.[0] || [];
    if (hand.length > 0) {
      const randomCard = hand[Math.floor(Math.random() * hand.length)];
      this.playCardWithAnimation(randomCard);
    }
  }

  // ==================== 自定义弹窗 ====================
  private showCustomYakuModal(yaku: any[]): void {
    this.modal = {
      visible: true,
      type: 'yaku',
      animProgress: 0,
      animating: true,
      animIn: true,
      yakuList: yaku,
      confirmText: '结束结算',
      cancelText: 'こいこい',
      onConfirm: () => this.endRound(),
      onCancel: () => this.callKoi(),
    };
    if (!this.animating) this.startAnimLoop();
  }

  private showCustomRoundResult(msg: any): void {
    const scores = msg.roundScores?.join(' : ') || '0 : 0';
    const total = msg.totalScores?.join(' : ') || '0 : 0';
    const gameOver = msg.gameOver;

    this.modal = {
      visible: true,
      type: 'roundEnd',
      animProgress: 0,
      animating: true,
      animIn: true,
      roundScores: scores,
      totalScores: total,
      gameOver,
      confirmText: gameOver ? '返回大厅' : '确定',
      cancelText: '',
      onConfirm: () => {
        if (gameOver) {
          this.scene = Scene.MENU;
          this.gameState = null;
          if (this.rafId) cancelAnimationFrame(this.rafId);
          this.animating = false;
          this.render();
        }
      },
    };
    if (!this.animating) this.startAnimLoop();
  }

  private showCustomGameResult(msg: any): void {
    const total = msg.totalScores?.join(' : ') || '';
    this.modal = {
      visible: true,
      type: 'gameEnd',
      animProgress: 0,
      animating: true,
      animIn: true,
      totalScores: total,
      confirmText: '再来一局',
      cancelText: '返回大厅',
      onConfirm: () => this.createRoom(),
      onCancel: () => {
        this.scene = Scene.MENU;
        this.gameState = null;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.animating = false;
        this.render();
      },
    };
    if (!this.animating) this.startAnimLoop();
  }

  private closeModal(): void {
    if (this.modal.visible && !this.modal.animating) {
      this.modal.animating = true;
      this.modal.animIn = false;
    }
  }

  // ==================== 渲染 ====================
  private render(): void {
    if (!this.ctx) return;
    const { ctx } = this;
    const { SCREEN_W, SCREEN_H } = CONFIG;

    ctx.fillStyle = '#1a472a';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    switch (this.scene) {
      case Scene.MENU: this.renderMenu(); break;
      case Scene.ROOM: this.renderRoom(); break;
      case Scene.GAME: this.renderGame(); break;
    }

    // 弹窗覆盖层
    if (this.modal.visible || this.modal.animProgress > 0) {
      this.renderModal();
    }
  }

  private renderMenu(): void {
    const { ctx } = this;
    const { SCREEN_W } = CONFIG;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌸 花札 🌸', SCREEN_W / 2, 180);
    ctx.font = '18px serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText('Hanafuda Online', SCREEN_W / 2, 220);

    this.buttons = [
      new BtnV2('创建房间', SCREEN_W / 2 - 100, 300, 200, 50, '#4CAF50', () => this.createRoom()),
      new BtnV2('加入房间', SCREEN_W / 2 - 100, 370, 200, 50, '#2196F3', () => this.promptRoomId()),
    ];
    for (const b of this.buttons) b.draw(ctx);
  }

  private renderRoom(): void {
    const { ctx } = this;
    const { SCREEN_W } = CONFIG;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px serif';
    ctx.textAlign = 'center';
    ctx.fillText('等待对手', SCREEN_W / 2, 80);
    ctx.font = '20px serif';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`房间号: ${this.roomId}`, SCREEN_W / 2, 130);
    ctx.font = '14px serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('分享房间号邀请好友', SCREEN_W / 2, 170);

    this.buttons = [
      new BtnV2('📤 分享', SCREEN_W / 2 - 100, 240, 200, 50, '#FF9800', () => this.share()),
      new BtnV2('开始游戏', SCREEN_W / 2 - 100, 310, 200, 50, '#4CAF50', () => this.startGame()),
    ];
    for (const b of this.buttons) b.draw(ctx);
  }

  private share(): void {
    wx.shareAppMessage({ title: `来一局花札！房间号：${this.roomId}`, imageUrl: '', query: `roomId=${this.roomId}` });
  }

  private promptRoomId(): void {
    wx.showModal({
      title: '输入房间号',
      editable: true,
      placeholderText: '6位数字',
      success: (res) => {
        if (res.confirm && res.content) this.joinRoom(res.content.trim());
      },
    });
  }

  // ==================== 游戏场景渲染（优化版） ====================
  private renderGame(): void {
    const { ctx } = this;
    const { SCREEN_W, SCREEN_H, CARD_W, CARD_H } = CONFIG;
    if (!this.gameState) return;

    const gs = this.gameState;
    const myTurn = gs.currentPlayerIndex === 0;

    // --- 对手区（顶部） ---
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, SCREEN_W, 60);

    // 对手回合时：发光边框
    if (!myTurn) {
      ctx.strokeStyle = '#FF9800';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#FF9800';
      ctx.shadowBlur = 8;
      ctx.strokeRect(2, 2, SCREEN_W - 4, 56);
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🤵 对手 · ${gs.players?.[1]?.nickname || ''}`, SCREEN_W / 2, 20);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`得分: ${gs.totalScores?.[1] || 0}`, SCREEN_W / 2, 38);

    // 对手手牌（牌背）
    const oppN = gs.hands?.[1]?.length || 0;
    const oppStart = (SCREEN_W - oppN * 20) / 2;
    for (let i = 0; i < oppN; i++) {
      this.drawCardBack(oppStart + i * 20, 42);
    }

    // --- 场牌区 ---
    // 场牌背景
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.roundRect(10, 105, SCREEN_W - 20, CARD_H + 30, 8);
    ctx.fill();

    const field = gs.field || [];
    const fStart = (SCREEN_W - field.length * (CARD_W + 6)) / 2;
    for (let i = 0; i < field.length; i++) {
      this.drawCard(fStart + i * (CARD_W + 6), 115, field[i]);
    }

    // 山札
    const deckCount = gs.deck?.length || 0;
    const deckX = SCREEN_W - 75;
    ctx.fillStyle = '#3E2723';
    ctx.beginPath();
    ctx.roundRect(deckX, 115, CARD_W, CARD_H * 0.5, 4);
    ctx.fill();
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(deckX, 115, CARD_W, CARD_H * 0.5, 4);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('山札', deckX + CARD_W / 2, 138);
    ctx.fillText(`${deckCount}`, deckX + CARD_W / 2, 155);

    // --- 回合指示器（左侧） ---
    this.renderTurnIndicator(myTurn);

    // --- 飞行动画卡牌（出牌动画） ---
    for (const fc of this.flyingCards) {
      const t = easeOutCubic(fc.progress);
      const cx = fc.startX + (fc.targetX - fc.startX) * t;
      const cy = fc.startY + (fc.targetY - fc.startY) * t;
      // 动画中略微放大并带弧度
      const arcOffset = Math.sin(t * Math.PI) * -30; // 抛物线
      const scale = 1 + Math.sin(t * Math.PI) * 0.08;
      const w = fc.startW * scale;
      const h = fc.startH * scale;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 8;
      this.drawCardRaw(cx - (w - CONFIG.CARD_W) / 2, cy + arcOffset - (h - CONFIG.CARD_H) / 2, fc.cardId, false, w, h);
      ctx.restore();
    }

    // --- 玩家手牌（底部） ---
    const hand = gs.hands?.[0] || [];
    const hStart = (SCREEN_W - hand.length * (CARD_W + 4)) / 2;
    const handBaseY = SCREEN_H - 120;
    this.handCards = [];

    for (let i = 0; i < hand.length; i++) {
      const id = hand[i];
      let x = hStart + i * (CARD_W + 4);
      let y = handBaseY;

      // 按下反馈动画（缩小）
      const isPressed = this.pressFeedbackId === id;
      let scaleX = 1;
      let scaleY = 1;
      if (isPressed) {
        const pressDur = Date.now() - this.pressFeedbackStart;
        const pressT = Math.min(pressDur / 100, 1);
        const s = easeOutBack(pressT);
        scaleX = 1 - 0.05 * s;
        scaleY = 1 - 0.05 * s;
        y -= 15 * s; // 微微上抬
      }

      // 拖拽中：跟随手指
      if (this.isDragging && this.dragCard?.id === id) {
        x += this.dragOffsetX;
        y += this.dragOffsetY;
        scaleX = 1.1;
        scaleY = 1.1;
      }

      this.drawCard(x, y, id, false, scaleX, scaleY);
      this.handCards.push(new CardV(x, y, CARD_W * scaleX, CARD_H * scaleY, id));
    }

    // --- 玩家区（底部栏） ---
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, SCREEN_H - 50, SCREEN_W, 50);

    // 我的回合时：发光边框
    if (myTurn) {
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#4CAF50';
      ctx.shadowBlur = 8;
      ctx.strokeRect(2, SCREEN_H - 48, SCREEN_W - 4, 46);
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${gs.players?.[0]?.nickname || '你'} · 得分: ${gs.totalScores?.[0] || 0}`, SCREEN_W / 2, SCREEN_H - 25);

    // Koi 次数
    if (gs.koiKoiCount > 0) {
      ctx.fillStyle = '#FF5722';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Koi ×${gs.koiKoiCount}`, SCREEN_W - 15, SCREEN_H - 25);
    }

    // 捕获区（小图标展示）
    this.renderCapturedArea();
  }

  // --- 回合指示器 ---
  private renderTurnIndicator(myTurn: boolean): void {
    const { ctx } = this;
    const { SCREEN_W } = CONFIG;

    const bx = 10;
    const by = 125;
    const bw = 100;
    const bh = 32;

    if (myTurn) {
      // 发光效果
      ctx.save();
      ctx.shadowColor = '#4CAF50';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 6);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,152,0,0.7)';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 6);
      ctx.fill();
    }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(myTurn ? '✋ 你的回合' : '⏳ 对手思考中', bx + bw / 2, by + 21);

    // 倒计时
    if (myTurn && this.turnTimer.started) {
      const sec = Math.ceil(this.turnTimer.remaining);
      ctx.fillStyle = sec <= 5 ? '#FF5722' : '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`${sec}s`, bx + bw / 2, by + bh + 24);

      // 倒计时条
      const ratio = this.turnTimer.remaining / this.turnTimer.totalDuration;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(bx, by + bh + 30, bw, 4);
      ctx.fillStyle = sec <= 5 ? '#FF5722' : '#4CAF50';
      ctx.fillRect(bx, by + bh + 30, bw * ratio, 4);
    }
  }

  // --- 捕获区 ---
  private renderCapturedArea(): void {
    if (!this.gameState) return;
    const { ctx } = this;
    const captured = this.gameState.captured?.[0] || [];
    if (captured.length === 0) return;

    const startX = 10;
    const startY = 175;
    const iconSize = 16;
    let x = startX;
    let y = startY;

    // 按月分组显示
    const months: { [key: number]: number } = {};
    for (const id of captured) {
      const m = Math.floor(id / 4) + 1;
      months[m] = (months[m] || 0) + 1;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(startX - 5, startY - 16, 200, 50, 6);
    ctx.fill();

    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText('已捕获:', startX, startY - 3);

    const monthEmojis = ['', '🌱', '🌸', '💧', '🌧️', '🎏', '🌺', '🦌', '🌾', '🌕', '🍂', '🎄', '🎎'];
    const monthColors = ['', '#4CAF50', '#FF80AB', '#64B5F6', '#90A4AE', '#FF7043', '#EC407A', '#8D6E63', '#FFB74D', '#FFD54F', '#A1887F', '#66BB6A', '#EF5350'];

    for (const m of Object.keys(months).map(Number).sort()) {
      const count = months[m];
      ctx.fillStyle = monthColors[m] || '#fff';
      ctx.beginPath();
      ctx.arc(x + 10, y + 12, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${m}`, x + 10, y + 15);
      ctx.font = '9px sans-serif';
      ctx.fillText(`×${count}`, x + 10, y + 26);
      x += 24;
    }
  }

  // ==================== 自定义弹窗渲染 ====================
  private renderModal(): void {
    const { ctx } = this;
    const { SCREEN_W, SCREEN_H } = CONFIG;

    const alpha = this.modal.animProgress;
    const scale = 0.8 + 0.2 * easeOutBack(Math.min(alpha, 1));

    // 遮罩
    ctx.fillStyle = `rgba(0,0,0,${0.6 * alpha})`;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    const mw = 300;
    const mh = this.modal.type === 'yaku' ? 220 : 180;
    const mx = (SCREEN_W - mw) / 2;
    const my = (SCREEN_H - mh) / 2;

    ctx.save();
    ctx.translate(SCREEN_W / 2, SCREEN_H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-SCREEN_W / 2, -SCREEN_H / 2);

    // 弹窗背景
    ctx.fillStyle = '#FFF8E1';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, 12);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';

    switch (this.modal.type) {
      case 'yaku':
        this.renderYakuModal(mx, my, mw, mh);
        break;
      case 'roundEnd':
        this.renderRoundEndModal(mx, my, mw, mh);
        break;
      case 'gameEnd':
        this.renderGameEndModal(mx, my, mw, mh);
        break;
    }

    ctx.restore();
  }

  private renderYakuModal(mx: number, my: number, mw: number, mh: number): void {
    const { ctx } = this;
    const yaku = this.modal.yakuList || [];

    // 标题
    ctx.fillStyle = '#FF5722';
    ctx.font = 'bold 20px serif';
    ctx.fillText('🎉 役达成！', mx + mw / 2, my + 35);

    // 分割线
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx + 20, my + 45);
    ctx.lineTo(mx + mw - 20, my + 45);
    ctx.stroke();

    // 役列表
    let y = my + 70;
    ctx.fillStyle = '#333';
    ctx.font = '15px sans-serif';
    for (const yk of yaku) {
      ctx.fillText(`${yk.label}`, mx + mw / 2, y);
      ctx.fillStyle = '#FF9800';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${yk.points}分`, mx + mw / 2, y + 18);
      ctx.fillStyle = '#333';
      ctx.font = '15px sans-serif';
      y += 38;
    }

    // 按钮
    const btnW = 110;
    const btnH = 36;
    const btnY = my + mh - 55;

    // 结束结算按钮
    this.buttons = [
      new BtnV2(this.modal.confirmText || '确定', mx + 25, btnY, btnW, btnH, '#4CAF50', () => {
        this.modal.onConfirm?.();
        this.closeModal();
      }),
    ];

    // 如果有 Koi 选项
    if (this.modal.cancelText) {
      this.buttons.push(
        new BtnV2(this.modal.cancelText, mx + mw - 135, btnY, btnW, btnH, '#FF9800', () => {
          this.modal.onCancel?.();
          this.closeModal();
        })
      );
    }

    for (const btn of this.buttons) btn.draw(ctx);
  }

  private renderRoundEndModal(mx: number, my: number, mw: number, mh: number): void {
    const { ctx } = this;

    ctx.fillStyle = this.modal.gameOver ? '#FF5722' : '#2196F3';
    ctx.font = 'bold 20px serif';
    ctx.fillText(this.modal.gameOver ? '🏁 游戏结束' : '本局结算', mx + mw / 2, my + 35);

    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx + 20, my + 45);
    ctx.lineTo(mx + mw - 20, my + 45);
    ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.font = '15px sans-serif';
    ctx.fillText(`本局: ${this.modal.roundScores}`, mx + mw / 2, my + 75);
    ctx.fillText(`累计: ${this.modal.totalScores}`, mx + mw / 2, my + 100);

    this.buttons = [
      new BtnV2(this.modal.confirmText || '确定', mx + (mw - 110) / 2, my + mh - 55, 110, 36, '#2196F3', () => {
        this.modal.onConfirm?.();
        this.closeModal();
      }),
    ];
    for (const btn of this.buttons) btn.draw(ctx);
  }

  private renderGameEndModal(mx: number, my: number, mw: number, mh: number): void {
    const { ctx } = this;

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 22px serif';
    ctx.fillText('🏆 游戏结束', mx + mw / 2, my + 35);

    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx + 20, my + 45);
    ctx.lineTo(mx + mw - 20, my + 45);
    ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.font = '16px sans-serif';
    ctx.fillText(`最终比分: ${this.modal.totalScores}`, mx + mw / 2, my + 80);

    this.buttons = [
      new BtnV2(this.modal.confirmText || '确定', mx + 25, my + mh - 55, 110, 36, '#4CAF50', () => {
        this.modal.onConfirm?.();
        this.closeModal();
      }),
      new BtnV2(this.modal.cancelText || '返回', mx + mw - 135, my + mh - 55, 110, 36, '#9E9E9E', () => {
        this.modal.onCancel?.();
        this.closeModal();
      }),
    ];
    for (const btn of this.buttons) btn.draw(ctx);
  }

  // ==================== 绘制辅助 ====================
  private drawCard(x: number, y: number, id: number, selected: boolean = false, scaleX: number = 1, scaleY: number = 1): void {
    const { ctx } = this;
    if (!ctx) return;
    const { CARD_W, CARD_H } = CONFIG;

    const w = CARD_W * scaleX;
    const h = CARD_H * scaleY;
    const offsetX = (CARD_W - w) / 2;
    const offsetY = (CARD_H - h) / 2;

    this.drawCardRaw(x + offsetX, y + offsetY, id, selected, w, h);
  }

  private drawCardRaw(x: number, y: number, id: number, selected: boolean = false, w?: number, h?: number): void {
    const { ctx } = this;
    if (!ctx) return;
    const CARD_W = w || CONFIG.CARD_W;
    const CARD_H = h || CONFIG.CARD_H;

    // 阴影
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = '#FFFDE7';
    ctx.beginPath();
    ctx.roundRect(x, y, CARD_W, CARD_H, 4);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    if (selected) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x - 1, y - 1, CARD_W + 2, CARD_H + 2, 5);
      ctx.stroke();
    }

    // 牌面
    const month = Math.floor(id / 4) + 1;
    const pos = id % 4;
    const cats = ['光', '短', '種', 'カ'];

    ctx.fillStyle = '#333';
    ctx.font = `bold ${Math.round(16 * CARD_W / CONFIG.CARD_W)}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(month + '月', x + CARD_W / 2, y + CARD_H / 2 - 5);
    ctx.font = `${Math.round(10 * CARD_W / CONFIG.CARD_W)}px sans-serif`;
    ctx.fillStyle = '#888';
    ctx.fillText(cats[pos], x + CARD_W / 2, y + CARD_H / 2 + 15);
  }

  private drawCardBack(x: number, y: number): void {
    const { ctx } = this;
    if (!ctx) return;
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.roundRect(x, y, 15, 24, 2);
    ctx.fill();
    ctx.strokeStyle = '#1B5E20';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.roundRect(x, y, 15, 24, 2);
    ctx.stroke();
  }
}

// ==================== 按钮（增强版） ====================
class BtnV2 {
  public pressed: boolean = false;

  constructor(
    public text: string,
    public x: number, public y: number,
    public w: number, public h: number,
    public color: string,
    public click: () => void
  ) {}

  setPressed(p: boolean): void { this.pressed = p; }

  hit(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  draw(ctx: WechatMinigame.CanvasRenderingContext): void {
    const scale = this.pressed ? 0.96 : 1;
    const offsetX = this.pressed ? this.w * 0.02 : 0;
    const offsetY = this.pressed ? this.h * 0.02 : 0;

    ctx.save();
    if (this.pressed) {
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.fillStyle = this.pressed ? this.darkenColor(this.color) : this.color;
    ctx.beginPath();
    ctx.roundRect(this.x + offsetX, this.y + offsetY, this.w * scale, this.h * scale, 8);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x + this.w / 2, this.y + this.h / 2 + 5);

    ctx.restore();
  }

  private darkenColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const darken = (c: number) => Math.max(0, Math.round(c * 0.85));
    return `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;
  }
}

// ==================== 牌视图 ====================
class CardV {
  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
    public id: number
  ) {}

  hit(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }
}

// ==================== 启动 ====================
new GameOptimized();
