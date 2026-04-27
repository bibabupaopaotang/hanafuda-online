/**
 * 规则引擎 — 类型定义
 * 来源：design/gdd/rule-engine.md (v1.0)
 */

import { HanafudaCard } from '../cards/types.js';

/** 役类型 */
export enum YakuType {
  // 光牌役
  FiveLights = 'five_lights',
  FourLights = 'four_lights',
  RainFourLights = 'rain_four',
  ThreeLights = 'three_lights',

  // 短册役
  RedStrips = 'red_strips',
  BlueStrips = 'blue_strips',
  Strips5 = 'strips_5',
  Strips6 = 'strips_6',
  Strips7 = 'strips_7',
  Strips8 = 'strips_8',
  Strips9 = 'strips_9',
  Strips10 = 'strips_10',

  // 种牌役
  BoarDeerButterfly = 'inoshikacho',
  Seeds5 = 'seeds_5',
  Seeds6 = 'seeds_6',
  Seeds7 = 'seeds_7',
  Seeds8 = 'seeds_8',
  Seeds9 = 'seeds_9',

  // カス役
  Waste10 = 'waste_10',
  Waste11 = 'waste_11',
  Waste12 = 'waste_12',
  Waste13 = 'waste_13',
  Waste14 = 'waste_14',
  Waste15 = 'waste_15',
  Waste16 = 'waste_16',
  Waste17 = 'waste_17',
  Waste18 = 'waste_18',
  Waste19 = 'waste_19',
  Waste20 = 'waste_20',

  // 特殊役
  FlowerSake = 'flower_sake',
  MoonSake = 'moon_sake',
  Nomu = 'nomu',
  TeShi = 'te_shi',
}

/** 役结果 */
export interface YakuResult {
  type: YakuType;
  points: number;
  cards: HanafudaCard[];
  label: string;  // 显示名称
}

/** 计分结果 */
export interface ScoreResult {
  baseScore: number;
  yakuList: YakuResult[];
  koiCount: number;
  koiMultiplier: number;
  finalScore: number;
  isKoiCallerWinner: boolean;
}
