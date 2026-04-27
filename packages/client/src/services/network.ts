/**
 * 网络通信层 — 微信小游戏 Socket.io 封装
 * 来源：design/gdd/network.md
 */

type MessageHandler = (data: any) => void;

export class NetworkService {
  private socket: WechatMinigame.SocketTask | null = null;
  private url: string;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private pendingMessages: any[] = [];
  private isConnected: boolean = false;
  private reconnectCount: number = 0;
  private maxReconnect: number = 3;
  private reconnectDelay: number = 1000;

  constructor(url: string) {
    this.url = url;
  }

  connect(auth: { token: string; nickname: string; avatar: string }): void {
    this.socket = wx.connectSocket({
      url: this.url,
      header: { 'Authorization': `Bearer ${auth.token}` },
    });

    this.socket.onOpen(() => {
      console.log('[Network] 已连接');
      this.isConnected = true;
      this.reconnectCount = 0;
      this.emit('connect', {});

      // 发送缓存消息
      for (const msg of this.pendingMessages) {
        this.sendRaw(msg);
      }
      this.pendingMessages = [];
    });

    this.socket.onMessage((res) => {
      try {
        const msg = JSON.parse(res.data as string);
        this.emit(msg.type, msg);
      } catch (e) {
        console.error('[Network] 解析消息失败:', e);
      }
    });

    this.socket.onClose(() => {
      console.log('[Network] 已断开');
      this.isConnected = false;
      this.emit('disconnect', {});
      this.tryReconnect(auth);
    });

    this.socket.onError((err) => {
      console.error('[Network] 连接错误:', err);
      this.isConnected = false;
    });
  }

  private tryReconnect(auth: any): void {
    if (this.reconnectCount >= this.maxReconnect) {
      console.log('[Network] 重连次数已达上限');
      this.emit('reconnect_failed', {});
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectCount);
    console.log(`[Network] ${delay / 1000}s 后尝试重连 (${this.reconnectCount + 1}/${this.maxReconnect})`);

    setTimeout(() => {
      this.reconnectCount++;
      this.connect(auth);
    }, delay);
  }

  emit(type: string, data: any): void {
    const handlers = this.handlers.get(type) || [];
    for (const handler of handlers) {
      handler(data);
    }
  }

  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type) || [];
    const idx = handlers.indexOf(handler);
    if (idx >= 0) handlers.splice(idx, 1);
  }

  send(type: string, payload: any = {}): void {
    const msg = { type, seq: Date.now(), timestamp: Date.now(), payload };
    if (this.isConnected && this.socket) {
      this.sendRaw(msg);
    } else {
      this.pendingMessages.push(msg);
    }
  }

  private sendRaw(msg: any): void {
    if (this.socket) {
      this.socket.send({ data: JSON.stringify(msg) });
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  getConnected(): boolean {
    return this.isConnected;
  }
}
