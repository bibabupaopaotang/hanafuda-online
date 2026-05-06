/**
 * 横屏布局配置（麻将风格）
 * 1920×1080 基准（按比例适配实际屏幕）
 */

export interface LayoutConfig {
  screenWidth: number;
  screenHeight: number;
  scale: number;
  
  // 区域布局
  areas: {
    opponentHand: Area;      // 对手手牌区（顶部）
    opponentInfo: Area;      // 对手信息区
    field: Area;             // 场牌区（中央）
    mountain: Area;          // 山札
    leftCapture: Area;       // 左侧计分区（对手）
    rightCapture: Area;      // 右侧计分区（玩家）
    playerHand: Area;        // 玩家手牌区（底部）
    statusBar: Area;         // 状态栏
  };
  
  // 卡牌尺寸
  cardSizes: {
    handCard: { w: number; h: number };      // 手牌尺寸
    fieldCard: { w: number; h: number };     // 场牌尺寸
    opponentCard: { w: number; h: number };  // 对手手牌（缩小）
    captureCard: { w: number; h: number };   // 计分区牌（缩略图）
  };
}

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 计算横屏布局配置
 * @param canvasWidth 画布宽度
 * @param canvasHeight 画布高度
 */
export function calculateHorizontalLayout(canvasWidth: number, canvasHeight: number): LayoutConfig {
  const scale = Math.min(canvasWidth / 1920, canvasHeight / 1080);
  
  // 基准尺寸（1920×1080）
  const BASE = {
    W: 1920,
    H: 1080,
  };
  
  return {
    screenWidth: canvasWidth,
    screenHeight: canvasHeight,
    scale,
    
    areas: {
      // 对手手牌区（顶部中央，横向展开）
      opponentHand: {
        x: BASE.W * 0.15,
        y: BASE.H * 0.05,
        width: BASE.W * 0.7,
        height: BASE.H * 0.12,
      },
      
      // 对手信息区（顶部左侧）
      opponentInfo: {
        x: BASE.W * 0.05,
        y: BASE.H * 0.05,
        width: BASE.W * 0.25,
        height: BASE.H * 0.1,
      },
      
      // 场牌区（正中央，3×4 网格）
      field: {
        x: BASE.W * 0.5 - BASE.W * 0.2,
        y: BASE.H * 0.35,
        width: BASE.W * 0.4,
        height: BASE.H * 0.35,
      },
      
      // 山札（场牌区下方）
      mountain: {
        x: BASE.W * 0.5 - BASE.W * 0.05,
        y: BASE.H * 0.72,
        width: BASE.W * 0.1,
        height: BASE.H * 0.12,
      },
      
      // 左侧计分区（对手）
      leftCapture: {
        x: BASE.W * 0.02,
        y: BASE.H * 0.2,
        width: BASE.W * 0.23,
        height: BASE.H * 0.5,
      },
      
      // 右侧计分区（玩家）⭐ 显示得分明细
      rightCapture: {
        x: BASE.W * 0.75,
        y: BASE.H * 0.2,
        width: BASE.W * 0.23,
        height: BASE.H * 0.5,
      },
      
      // 玩家手牌区（底部中央，横向展开）
      playerHand: {
        x: BASE.W * 0.15,
        y: BASE.H * 0.82,
        width: BASE.W * 0.7,
        height: BASE.H * 0.15,
      },
      
      // 状态栏（底部）
      statusBar: {
        x: 0,
        y: BASE.H * 0.95,
        width: BASE.W,
        height: BASE.H * 0.05,
      },
    },
    
    cardSizes: {
      // 手牌：70×112px（基准）
      handCard: {
        w: BASE.W * 0.036,
        h: BASE.W * 0.036 * 1.6, // 1:1.6 比例
      },
      // 场牌：80×128px
      fieldCard: {
        w: BASE.W * 0.042,
        h: BASE.W * 0.042 * 1.6,
      },
      // 对手手牌（缩小）：50×80px
      opponentCard: {
        w: BASE.W * 0.026,
        h: BASE.W * 0.026 * 1.6,
      },
      // 计分区缩略图：40×64px
      captureCard: {
        w: BASE.W * 0.021,
        h: BASE.W * 0.021 * 1.6,
      },
    },
  };
}

/**
 * 麻将风格配色方案
 */
export const COLORS = {
  // 桌布背景（麻将绿渐变）
  tableBg: ['#2D5016', '#1a3d0f'],
  
  // 手牌区背景
  handAreaBg: 'rgba(0, 0, 0, 0.5)',
  
  // 场牌区背景
  fieldBg: 'rgba(8, 45, 21, 0.8)',
  fieldBorder: '#2e5c3e',
  
  // 计分区背景（浅米色）
  captureBg: 'rgba(245, 245, 220, 0.95)',
  captureBorder: '#3C2415',
  captureText: '#3C2415',
  
  // 文字颜色
  textWhite: '#FFFFFF',
  textGold: '#FFD700',
  textGray: '#AAAAAA',
  
  // 役达成（金色渐变）
  yakuGold: '#FFD700',
  yakuDarkRed: '#8B0000',
  
  // 按钮颜色
  btnGreen: '#4CAF50',
  btnBlue: '#2196F3',
  btnOrange: '#FF9800',
  btnPurple: '#9C27B0',
};

/**
 * 场牌区网格配置
 */
export const FIELD_GRID = {
  rows: 3,
  cols: 4,
  cardGap: 8, // 卡牌间距
};

/**
 * 手牌排列配置
 */
export const HAND_LAYOUT = {
  overlap: 0.4, // 重叠比例（40%）
  maxCards: 8,  // 标准手牌数
};
