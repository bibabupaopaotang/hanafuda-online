"use strict";
/**
 * 规则引擎 — 类型定义
 * 来源：design/gdd/rule-engine.md (v1.0)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.YakuType = void 0;
/** 役类型 */
var YakuType;
(function (YakuType) {
    // 光牌役
    YakuType["FiveLights"] = "five_lights";
    YakuType["FourLights"] = "four_lights";
    YakuType["RainFourLights"] = "rain_four";
    YakuType["ThreeLights"] = "three_lights";
    // 短册役
    YakuType["RedStrips"] = "red_strips";
    YakuType["BlueStrips"] = "blue_strips";
    YakuType["Strips5"] = "strips_5";
    YakuType["Strips6"] = "strips_6";
    YakuType["Strips7"] = "strips_7";
    YakuType["Strips8"] = "strips_8";
    YakuType["Strips9"] = "strips_9";
    YakuType["Strips10"] = "strips_10";
    // 种牌役
    YakuType["BoarDeerButterfly"] = "inoshikacho";
    YakuType["Seeds5"] = "seeds_5";
    YakuType["Seeds6"] = "seeds_6";
    YakuType["Seeds7"] = "seeds_7";
    YakuType["Seeds8"] = "seeds_8";
    YakuType["Seeds9"] = "seeds_9";
    // カス役
    YakuType["Waste10"] = "waste_10";
    YakuType["Waste11"] = "waste_11";
    YakuType["Waste12"] = "waste_12";
    YakuType["Waste13"] = "waste_13";
    YakuType["Waste14"] = "waste_14";
    YakuType["Waste15"] = "waste_15";
    YakuType["Waste16"] = "waste_16";
    YakuType["Waste17"] = "waste_17";
    YakuType["Waste18"] = "waste_18";
    YakuType["Waste19"] = "waste_19";
    YakuType["Waste20"] = "waste_20";
    // 特殊役
    YakuType["FlowerSake"] = "flower_sake";
    YakuType["MoonSake"] = "moon_sake";
    YakuType["Nomu"] = "nomu";
    YakuType["TeShi"] = "te_shi";
})(YakuType || (exports.YakuType = YakuType = {}));
