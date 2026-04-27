/**
 * 花札在线对战 — 微信小游戏主入口
 * MVP 版本：Koi-Koi 两人对战
 */

// ==================== 配置 ====================
const CONFIG = {
  SERVER_URL: 'wss://your-server-url', // TODO: 替换为云托管地址
  CARD_W: 60,
  CARD_H: 96,
  SCREEN_W: 375,
  SCREEN_H: 667,
};

// ==================== 场景枚举 ====================
enum Scene { MENU = 'menu', LOADING = 'loading', ROOM = 'room', GAME = 'game' }

// ==================== 用户信息 ====================
interface Player {
  id: string;
  nickname: string;
  avatar: string;
}

// ==================== 主游戏类 ====================
class Game {
  private ctx: WechatMinigame.CanvasRenderingContext | null = null;
  private socket: WechatMinigame.SocketTask | null = null;
  private scene: Scene = Scene.LOADING;
  private gameState: any = null;
  private roomId: string = '';
  private selectedCard: number | null = null;
  private buttons: Btn[] = [];
  private handCards: CardV[] = [];
  private connected: boolean = false;
  private player: Player | null = null;

  constructor() {
    const canvas = wx.createCanvas();
    this.ctx = canvas.getContext('2d')!;
    this.setupEvents();
    this.boot();
  }

  // ==================== 启动流程 ====================
  private async boot(): void {
    this.scene = Scene.LOADING;
    this.render();

    try {
      // 1. 微信登录
      this.player = await this.wxLogin();
      console.log('[Auth] 登录成功:', this.player.nickname);

      // 2. 连接服务端
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

  private async wxLogin(): Promise<Player> {
    // wx.login 获取 code
    const loginRes = await new Promise<WechatMinigame.LoginSuccessCallbackResult>(
      (resolve, reject) => wx.login({ success: resolve, fail: reject })
    );

    // MVP: 用 code 后 8 位当临时 ID（后续替换为云函数换 openid）
    const id = 'u_' + loginRes.code.slice(-8);

    // wx.getUserProfile（可选，用户可拒绝）
    let nickname = `玩家${id.slice(2, 6)}`;
    let avatar = '';
    try {
      const p: any = await new Promise((resolve, reject) =>
        wx.getUserProfile({ desc: '用于显示昵称和头像', success: resolve, fail: reject })
      );
      nickname = p.userInfo?.nickName || nickname;
      avatar = p.userInfo?.avatarUrl || '';
    } catch { /* 用户拒绝，用默认值 */ }

    return { id, nickname, avatar };
  }

  // ==================== 网络 ====================
  private connect(): void {
    if (!this.player) return;
    this.socket = wx.connectSocket({
      url: CONFIG.SERVER_URL,
      success: () => {},
      fail: (e) => console.error('[Socket] 连接失败:', e),
    });

    this.socket.onOpen(() => {
      this.connected = true;
      console.log('[Socket] 已连接');
    });

    this.socket.onMessage((res) => {
      const msg = JSON.parse(res.data as string);
      this.handleMsg(msg);
    });

    this.socket.onClose(() => {
      this.connected = false;
      // 3s 后自动重连
      setTimeout(() => { if (!this.connected) this.connect(); }, 3000);
    });

    this.socket.onError((e) => console.error('[Socket] 错误:', e));
  }

  private handleMsg(msg: any): void {
    switch (msg.type) {
      case 'room_created':
        this.roomId = msg.room.id;
        this.scene = Scene.ROOM;
        this.render();
        break;
      case 'room_joined':
      case 'player_joined':
        this.roomId = msg.room.id;
        this.scene = Scene.ROOM;
        this.render();
        break;
      case 'game_start':
        this.gameState = msg.state;
        this.scene = Scene.GAME;
        this.selectedCard = null;
        this.render();
        break;
      case 'state_update':
        this.gameState = msg.state;
        this.selectedCard = null;
        this.render();
        break;
      case 'yaku_found':
        this.showYakuModal(msg.yaku || []);
        break;
      case 'round_end':
        this.showRoundResult(msg);
        break;
      case 'game_end':
        this.showGameResult(msg);
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

  // ==================== 弹窗 ====================
  private showYakuModal(yaku: any[]): void {
    const text = yaku.map((y: any) => `${y.label} (${y.points}分)`).join('\n');
    wx.showModal({
      title: '🎉 役达成！',
      content: text,
      confirmText: '结束结算',
      cancelText: 'こいこい',
      success: (res) => {
        if (res.confirm) this.endRound();
        else this.callKoi();
      },
    });
  }

  private showRoundResult(msg: any): void {
    const scores = msg.roundScores?.join(' : ') || '0 : 0';
    const total = msg.totalScores?.join(' : ') || '0 : 0';
    const gameOver = msg.gameOver;
    wx.showModal({
      title: gameOver ? '🏁 游戏结束' : '本局结算',
      content: `本局: ${scores}\n累计: ${total}${gameOver ? '\n\n点击确定返回大厅' : ''}`,
      showCancel: false,
      confirmText: gameOver ? '返回大厅' : '确定',
      success: () => {
        if (gameOver) {
          this.scene = Scene.MENU;
          this.gameState = null;
          this.render();
        }
      },
    });
  }

  private showGameResult(msg: any): void {
    const total = msg.totalScores?.join(' : ') || '';
    wx.showModal({
      title: '🏆 游戏结束',
      content: `最终比分: ${total}`,
      confirmText: '再来一局',
      cancelText: '返回大厅',
      success: (res) => {
        if (res.confirm) this.createRoom();
        else { this.scene = Scene.MENU; this.gameState = null; this.render(); }
      },
    });
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

  // ==================== 事件 ====================
  private setupEvents(): void {
    wx.onTouchStart((e) => {
      for (const touch of e.touches) {
        this.handleClick(touch.clientX, touch.clientY);
      }
    });
  }

  private handleClick(x: number, y: number): void {
    // 按钮优先
    for (const btn of this.buttons) {
      if (btn.hit(x, y)) { btn.click(); return; }
    }
    // 手牌
    if (this.scene === Scene.GAME) {
      for (const card of this.handCards) {
        if (card.hit(x, y)) {
          if (this.selectedCard === card.id) {
            this.playCard(card.id);
            this.selectedCard = null;
          } else {
            this.selectedCard = card.id;
          }
          this.render();
          return;
        }
      }
    }
  }

  // ==================== 渲染 ====================
  private render(): void {
    if (!this.ctx) return;
    const { ctx } = this;
    const { SCREEN_W, SCREEN_H } = CONFIG;

    // 桌布
    ctx.fillStyle = '#1a472a';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    switch (this.scene) {
      case Scene.MENU: this.renderMenu(); break;
      case Scene.ROOM: this.renderRoom(); break;
      case Scene.GAME: this.renderGame(); break;
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
      new Btn('创建房间', SCREEN_W / 2 - 100, 300, 200, 50, '#4CAF50', () => this.createRoom()),
      new Btn('加入房间', SCREEN_W / 2 - 100, 370, 200, 50, '#2196F3', () => this.promptRoomId()),
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
      new Btn('📤 分享', SCREEN_W / 2 - 100, 240, 200, 50, '#FF9800', () => this.share()),
      new Btn('开始游戏', SCREEN_W / 2 - 100, 310, 200, 50, '#4CAF50', () => this.startGame()),
    ];
    for (const b of this.buttons) b.draw(ctx);
  }

  private share(): void {
    wx.shareAppMessage({ title: `来一局花札！房间号：${this.roomId}`, imageUrl: '', query: `roomId=${this.roomId}` });
  }

  private renderGame(): void {
    const { ctx } = this;
    const { SCREEN_W, SCREEN_H, CARD_W, CARD_H } = CONFIG;
    if (!this.gameState) return;

    const gs = this.gameState;

    // --- 对手区 ---
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, SCREEN_W, 55);
    ctx.fillStyle = '#fff';
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.fillText(`对手 · ${gs.players?.[1]?.nickname || ''}`, SCREEN_W / 2, 22);
    ctx.fillText(`得分: ${gs.totalScores?.[1] || 0}`, SCREEN_W / 2, 42);

    // 对手手牌（牌背）
    const oppN = gs.hands?.[1]?.length || 0;
    const oppStart = (SCREEN_W - oppN * 20) / 2;
    for (let i = 0; i < oppN; i++) this.drawCardBack(oppStart + i * 20, 60);

    // --- 场牌 ---
    const field = gs.field || [];
    const fStart = (SCREEN_W - field.length * (CARD_W + 6)) / 2;
    for (let i = 0; i < field.length; i++) {
      this.drawCard(fStart + i * (CARD_W + 6), 130, field[i]);
    }

    // 山札
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(SCREEN_W - 70, 130, 50, CARD_H * 0.6);
    ctx.fillStyle = '#fff';
    ctx.font = '12px serif';
    ctx.fillText(`山札`, SCREEN_W - 45, 155);
    ctx.fillText(`${gs.deck?.length || 0}`, SCREEN_W - 45, 175);

    // 回合提示
    const myTurn = gs.currentPlayerIndex === 0;
    ctx.fillStyle = myTurn ? '#4CAF50' : '#666';
    ctx.fillRect(10, 125, 90, 28);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(myTurn ? '你的回合' : '对手回合', 55, 144);

    // --- 手牌 ---
    const hand = gs.hands?.[0] || [];
    const hStart = (SCREEN_W - hand.length * (CARD_W + 4)) / 2;
    this.handCards = [];
    for (let i = 0; i < hand.length; i++) {
      const id = hand[i];
      const y = this.selectedCard === id ? 380 : 400;
      this.drawCard(hStart + i * (CARD_W + 4), y, id, this.selectedCard === id);
      this.handCards.push(new CardV(hStart + i * (CARD_W + 4), y, CARD_W, CARD_H, id));
    }

    // --- 玩家区 ---
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, SCREEN_H - 55, SCREEN_W, 55);
    ctx.fillStyle = '#fff';
    ctx.font = '14px serif';
    ctx.fillText(`${gs.players?.[0]?.nickname || '你'} · 得分: ${gs.totalScores?.[0] || 0}`, SCREEN_W / 2, SCREEN_H - 20);

    // Koi 次数显示
    if (gs.koiKoiCount > 0) {
      ctx.fillStyle = '#FF5722';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Koi ×${gs.koiKoiCount}`, SCREEN_W - 15, SCREEN_H - 20);
    }
  }

  // --- 绘制辅助 ---
  private drawCard(x: number, y: number, id: number, selected: boolean = false): void {
    const { ctx } = this;
    if (!ctx) return;
    const { CARD_W, CARD_H } = CONFIG;

    // 阴影
    ctx.shadowColor = selected ? '#FFD700' : 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = selected ? 12 : 4;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = '#FFFDE7';
    ctx.fillRect(x, y, CARD_W, CARD_H);
    ctx.shadowColor = 'transparent';

    if (selected) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 1, y - 1, CARD_W + 2, CARD_H + 2);
    }

    // 简易牌面文字
    const month = Math.floor(id / 4) + 1;
    const pos = id % 4;
    const cats = ['光', '短', '種', 'カ'];
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px serif';
    ctx.textAlign = 'center';
    ctx.fillText(month + '月', x + CARD_W / 2, y + CARD_H / 2 - 5);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText(cats[pos], x + CARD_W / 2, y + CARD_H / 2 + 15);
  }

  private drawCardBack(x: number, y: number): void {
    const { ctx } = this;
    if (!ctx) return;
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(x, y, 15, 24);
    ctx.strokeStyle = '#1B5E20';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, 15, 24);
  }
}

// ==================== 按钮 ====================
class Btn {
  constructor(
    public text: string, public x: number, public y: number,
    public w: number, public h: number, public color: string, public click: () => void
  ) {}
  hit(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }
  draw(ctx: WechatMinigame.CanvasRenderingContext): void {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x + this.w / 2, this.y + this.h / 2 + 6);
  }
}

// ==================== 牌视图 ====================
class CardV {
  constructor(public x: number, public y: number, public w: number, public h: number, public id: number) {}
  hit(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }
}

// ==================== 启动 ====================
new Game();
