# 设置系统 — 游戏设计文档

> 校验日期：2026-04-27

## 概述

- **系统名称**：设置系统 (Settings System)
- **所属层级**：Presentation
- **优先级**：P3
- **设计目标**：管理游戏的各项设置，包括音量、显示、网络等，设置持久化到本地存储。

## 设置项列表

### 音频设置

| 设置项 | 类型 | 默认值 | 范围 | 存储键 |
|--------|------|--------|------|--------|
| 总音量 | 滑块 | 100% | 0-100% | `masterVolume` |
| 音效音量 | 滑块 | 100% | 0-100% | `sfxVolume` |
| BGM 音量 | 滑块 | 50% | 0-100% | `bgmVolume` |
| 一键静音 | 开关 | 关 | 开/关 | `muteAll` |

### 显示设置

| 设置项 | 类型 | 默认值 | 范围 | 存储键 |
|--------|------|--------|------|--------|
| 屏幕方向 | 选项 | 竖屏 | 竖屏/横屏 | `screenOrientation` |
| 牌面大小 | 选项 | 标准 | 小/标准/大 | `cardSize` |
| 动画效果 | 开关 | 开 | 开/关 | `enableAnimations` |
| 震动反馈 | 开关 | 开 | 开/关 | `enableVibration` |

### 游戏设置

| 设置项 | 类型 | 默认值 | 范围 | 存储键 |
|--------|------|--------|------|--------|
| 目标分数 | 选项 | 7 | 5/7/10 | `targetScore` |
| 回合提示 | 开关 | 开 | 开/关 | `showTurnHint` |
| 可出牌高亮 | 开关 | 开 | 开/关 | `highlightPlayable` |
| 自动收集 | 开关 | 开 | 开/关 | `autoCollect` |

### 网络设置

| 设置项 | 类型 | 默认值 | 范围 | 存储键 |
|--------|------|--------|------|--------|
| 断线自动重连 | 开关 | 开 | 开/关 | `autoReconnect` |
| 重连超时 | 选项 | 120s | 60s/120s/300s | `reconnectTimeout` |

## 设置界面

```
┌─────────────────────────────┐
│         ⚙️ 设置             │
├─────────────────────────────┤
│  ── 音频 ──                 │
│                             │
│  总音量      [━━━━━━━○━━]   │
│  音效音量    [━━━━━━━━━○]   │
│  BGM 音量    [━━━━━○━━━]   │
│  一键静音    [  ○ 关闭 ]     │
│                             │
│  ── 显示 ──                 │
│                             │
│  屏幕方向    [ 竖屏 ▼ ]     │
│  牌面大小    [ 标准 ▼ ]     │
│  动画效果    [  ● 开启  ]    │
│  震动反馈    [  ● 开启  ]    │
│                             │
│  ── 游戏 ──                 │
│                             │
│  目标分数    [  7分 ▼  ]    │
│  回合提示    [  ● 开启  ]    │
│  可出牌高亮  [  ● 开启  ]    │
│  自动收集    [  ● 开启  ]    │
│                             │
│  ── 网络 ──                 │
│                             │
│  断线自动重连 [  ● 开启  ]   │
│  重连超时     [ 120s ▼  ]   │
│                             │
│  [ 恢复默认 ]    [ 保存 ]    │
└─────────────────────────────┘
```

## 设置管理器

```typescript
interface GameSettings {
  // 音频
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  muteAll: boolean;
  
  // 显示
  screenOrientation: 'portrait' | 'landscape';
  cardSize: 'small' | 'medium' | 'large';
  enableAnimations: boolean;
  enableVibration: boolean;
  
  // 游戏
  targetScore: 5 | 7 | 10;
  showTurnHint: boolean;
  highlightPlayable: boolean;
  autoCollect: boolean;
  
  // 网络
  autoReconnect: boolean;
  reconnectTimeout: 60 | 120 | 300;
}

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 1,
  sfxVolume: 1,
  bgmVolume: 0.5,
  muteAll: false,
  screenOrientation: 'portrait',
  cardSize: 'medium',
  enableAnimations: true,
  enableVibration: true,
  targetScore: 7,
  showTurnHint: true,
  highlightPlayable: true,
  autoCollect: true,
  autoReconnect: true,
  reconnectTimeout: 120,
};

class SettingsManager {
  private settings: GameSettings;
  private readonly STORAGE_KEY = 'game_settings';

  constructor() {
    this.settings = this.load();
  }

  // 加载设置
  load(): GameSettings {
    try {
      const saved = wx.getStorageSync(this.STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...saved };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  // 保存设置
  save(): void {
    try {
      wx.setStorageSync(this.STORAGE_KEY, this.settings);
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  // 获取设置
  get<K extends keyof GameSettings>(key: K): GameSettings[K] {
    return this.settings[key];
  }

  // 更新设置
  set<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    this.settings[key] = value;
    this.save();
    this.notifyChange(key, value);
  }

  // 恢复默认
  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
  }

  // 通知设置变更
  private notifyChange<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    // 音量变更 → 通知音频管理器
    if (key.includes('Volume') || key === 'muteAll') {
      AudioManager.updateVolume(key, value);
    }
    // 屏幕方向 → 通知显示管理器
    if (key === 'screenOrientation') {
      DisplayManager.setOrientation(value as 'portrait' | 'landscape');
    }
  }

  // 获取全部设置
  getAll(): GameSettings {
    return { ...this.settings };
  }
}
```

## 微信存储 API

```typescript
// 保存
wx.setStorageSync('key', value);

// 读取
const value = wx.getStorageSync('key');

// 删除
wx.removeStorageSync('key');

// 清除所有
wx.clearStorageSync();
```

## 设置与游戏逻辑的关联

| 设置 | 影响的系统 | 说明 |
|------|-----------|------|
| `targetScore` | 规则引擎 | 决定 Koi-Koi 模式的胜利分数 |
| `autoCollect` | 游戏状态管理 | 是否自动收集配对的牌 |
| `highlightPlayable` | UI 渲染 | 是否高亮可出牌 |
| `enableAnimations` | UI 渲染 | 是否播放出牌/翻牌动画 |
| `autoReconnect` | 对战管理 | 断线后是否自动重连 |
| `reconnectTimeout` | 对战管理 | 重连超时时间 |

## 测试要点

- [ ] 所有设置项可正常修改
- [ ] 设置变更后立即生效
- [ ] 设置变更后保存成功
- [ ] 重启游戏后设置恢复
- [ ] 恢复默认按钮正常
- [ ] 音量滑块拖动时实时生效
- [ ] 屏幕方向切换正常

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-04-27 | 初始版本 |
