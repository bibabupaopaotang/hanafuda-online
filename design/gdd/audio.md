# 音效系统 — 游戏设计文档

> 校验日期：2026-04-27

## 概述

- **系统名称**：音效系统 (Audio System)
- **所属层级**：Presentation
- **优先级**：P3
- **设计目标**：管理游戏中的音效和背景音乐，提供沉浸式的打牌体验。

## 音效列表

### 游戏音效

| 音效 ID | 名称 | 触发时机 | 时长 | 优先级 |
|---------|------|----------|------|--------|
| `card_play` | 出牌音 | 玩家打出一张牌 | ~0.1s | 中 |
| `card_match` | 配对音 | 出牌成功匹配 | ~0.2s | 高 |
| `card_draw` | 翻牌音 | 从山札翻牌 | ~0.15s | 中 |
| `card_collect` | 收集音 | 牌收入计分区 | ~0.3s | 中 |
| `no_match` | 未配对 | 出牌后未匹配 | ~0.1s | 低 |
| `yaku_achieve` | 役达成 | 凑出役时 | ~0.5s | 高 |
| `koi_call` | 喊Koi音 | 玩家喊こいこい | ~0.3s | 高 |
| `round_end` | 局结束 | 结算时 | ~0.5s | 高 |
| `game_end_win` | 胜利音 | 赢得游戏 | ~1s | 高 |
| `game_end_lose` | 失败音 | 输掉游戏 | ~1s | 中 |

### UI 音效

| 音效 ID | 名称 | 触发时机 | 时长 | 优先级 |
|---------|------|----------|------|--------|
| `button_click` | 按钮点击 | 点击任何按钮 | ~0.05s | 低 |
| `popup_open` | 弹窗打开 | 役弹窗/结算弹窗 | ~0.1s | 低 |
| `popup_close` | 弹窗关闭 | 关闭弹窗 | ~0.05s | 低 |
| `room_created` | 房间创建 | 创建房间成功 | ~0.2s | 低 |
| `player_joined` | 玩家加入 | 有人加入房间 | ~0.2s | 低 |

### 环境音效（可选）

| 音效 ID | 名称 | 说明 |
|---------|------|------|
| `bgm_main` | 大厅 BGM | 轻柔和风音乐，循环播放 |
| `bgm_game` | 对战 BGM | 稍带节奏感的音乐，可关闭 |

## 音量控制

```typescript
interface AudioSettings {
  masterVolume: number;    // 总音量 (0-1)，默认 1
  sfxVolume: number;       // 音效音量 (0-1)，默认 1
  bgmVolume: number;       // BGM 音量 (0-1)，默认 0.5
  muteAll: boolean;        // 一键静音
}
```

## 音效管理器

```typescript
class AudioManager {
  private settings: AudioSettings;
  private bgmInstance: InnerAudioContext | null = null;
  private sfxPool: Map<string, InnerAudioContext[]> = new Map();

  // 初始化
  init(): void {
    this.settings = this.loadSettings();
    this.preloadSFX();
  }

  // 播放音效
  playSFX(sfxId: string): void {
    if (this.settings.muteAll || this.settings.sfxVolume === 0) return;
    
    const audio = this.getSFXInstance(sfxId);
    if (!audio) return;
    
    audio.volume = this.settings.masterVolume * this.settings.sfxVolume;
    audio.seek(0);
    audio.play();
  }

  // 播放 BGM
  playBGM(bgmId: string): void {
    if (this.settings.muteAll || this.settings.bgmVolume === 0) return;
    
    if (this.bgmInstance) {
      this.bgmInstance.stop();
    }
    
    this.bgmInstance = wx.createInnerAudioContext();
    this.bgmInstance.src = `audio/${bgmId}.mp3`;
    this.bgmInstance.volume = this.settings.masterVolume * this.settings.bgmVolume;
    this.bgmInstance.loop = true;
    this.bgmInstance.play();
  }

  // 停止 BGM
  stopBGM(): void {
    if (this.bgmInstance) {
      this.bgmInstance.stop();
      this.bgmInstance = null;
    }
  }

  // 预加载音效
  private preloadSFX(): void {
    const sfxList = [
      'card_play', 'card_match', 'card_draw', 'card_collect',
      'no_match', 'yaku_achieve', 'koi_call',
      'round_end', 'game_end_win', 'game_end_lose',
      'button_click', 'popup_open',
    ];
    
    for (const id of sfxList) {
      const pool: InnerAudioContext[] = [];
      for (let i = 0; i < 3; i++) { // 每种音效 3 个实例（支持重叠播放）
        const audio = wx.createInnerAudioContext();
        audio.src = `audio/sfx/${id}.mp3`;
        pool.push(audio);
      }
      this.sfxPool.set(id, pool);
    }
  }

  // 获取音效实例（循环使用）
  private getSFXInstance(sfxId: string): InnerAudioContext | null {
    const pool = this.sfxPool.get(sfxId);
    if (!pool || pool.length === 0) return null;
    
    // 找到第一个未播放的实例
    for (const audio of pool) {
      if (audio.paused) return audio;
    }
    // 都忙 → 返回第一个
    return pool[0];
  }

  // 保存/加载设置
  private saveSettings(): void {
    wx.setStorageSync('audio_settings', this.settings);
  }

  private loadSettings(): AudioSettings {
    const saved = wx.getStorageSync('audio_settings');
    return saved || {
      masterVolume: 1,
      sfxVolume: 1,
      bgmVolume: 0.5,
      muteAll: false,
    };
  }
}
```

## 微信小游戏音频 API

```typescript
// 创建音频实例
const audio = wx.createInnerAudioContext();

// 基本操作
audio.src = 'path/to/audio.mp3';
audio.play();
audio.pause();
audio.stop();
audio.seek(0.5); // 跳转到 0.5 秒

// 属性
audio.volume = 0.8;     // 音量 0-1
audio.loop = true;      // 循环
audio.autoplay = false;

// 事件
audio.onPlay(() => {});
audio.onPause(() => {});
audio.onStop(() => {});
audio.onError((err) => {});
audio.onEnded(() => {});
```

## 资源需求

| 资源 | 格式 | 大小限制 | 数量 |
|------|------|----------|------|
| 音效 MP3 | MP3 | ≤ 50KB 每个 | 14 个 |
| BGM MP3 | MP3 | ≤ 500KB 每个 | 2 个 |
| 总音频大小 | — | ≤ 1MB | — |

## 触发映射表

| 游戏事件 | 音效 |
|----------|------|
| 玩家出牌 | `card_play` |
| 出牌匹配成功 | `card_match` + `card_collect` |
| 出牌未匹配 | `no_match` |
| 翻山札 | `card_draw` |
| 翻牌匹配 | `card_match` + `card_collect` |
| 役达成 | `yaku_achieve` |
| 喊 Koi | `koi_call` |
| 局结算 | `round_end` |
| 游戏胜利 | `game_end_win` |
| 游戏失败 | `game_end_lose` |
| 按钮点击 | `button_click` |
| 弹窗弹出 | `popup_open` |

## 测试要点

- [ ] 所有音效能正常播放
- [ ] 音量控制有效
- [ ] 一键静音有效
- [ ] 音效可以重叠播放
- [ ] BGM 循环播放正常
- [ ] 断线重连后音效状态恢复
- [ ] 后台切换时 BGM 暂停

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-04-27 | 初始版本 |
