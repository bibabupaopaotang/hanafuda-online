"use strict";
// ============================================================
// 牌面数据系统 — 类型定义
// 来源：design/gdd/card-data.md (v1.0)
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.Month = exports.CardCategory = void 0;
/** 牌类别 */
var CardCategory;
(function (CardCategory) {
    CardCategory["Light"] = "hikari";
    CardCategory["Seed"] = "tane";
    CardCategory["Strip"] = "tanzaku";
    CardCategory["Waste"] = "kasu";
})(CardCategory || (exports.CardCategory = CardCategory = {}));
/** 月份/花名映射 */
var Month;
(function (Month) {
    Month[Month["January"] = 1] = "January";
    Month[Month["February"] = 2] = "February";
    Month[Month["March"] = 3] = "March";
    Month[Month["April"] = 4] = "April";
    Month[Month["May"] = 5] = "May";
    Month[Month["June"] = 6] = "June";
    Month[Month["July"] = 7] = "July";
    Month[Month["August"] = 8] = "August";
    Month[Month["September"] = 9] = "September";
    Month[Month["October"] = 10] = "October";
    Month[Month["November"] = 11] = "November";
    Month[Month["December"] = 12] = "December";
})(Month || (exports.Month = Month = {}));
