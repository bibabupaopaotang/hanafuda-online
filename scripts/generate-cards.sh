#!/bin/bash
# 生成 SVG 花札牌面素材
mkdir -p packages/client/assets/cards

CARD_W=120
CARD_H=192

# 月份名称和颜色
MONTHS=("松" "梅" "桜" "藤" "菖蒲" "牡丹" "萩" "芒" "菊" "紅葉" "柳" "桐")
MONTH_COLORS=("2E7D32" "E91E63" "F48FB1" "7B1FA2" "1565C0" "C62828" "6D4C41" "FFC107" "FF9800" "D84315" "37474F" "607D8B")

# 牌面数据 (ID, Month, Category, Name, Points)
# 格式: id|month(0-indexed)|category|name|points
CARDS=(
  "0|0|hikari|松に鶴|20"
  "1|0|tanzaku|赤短(松)|5"
  "2|0|tane|松に小鳥|10"
  "3|0|kasu|松のみ|1"
  "4|1|tane|梅に鴬|10"
  "5|1|tanzaku|赤短(梅)|5"
  "6|1|kasu|梅のみ|1"
  "7|1|kasu|梅のみ|1"
  "8|2|hikari|桜に幕|20"
  "9|2|tanzaku|赤短(桜)|5"
  "10|2|kasu|桜のみ|1"
  "11|2|kasu|桜のみ|1"
  "12|3|tanzaku|紫短(藤)|5"
  "13|3|tane|藤に燕|10"
  "14|3|kasu|藤のみ|1"
  "15|3|kasu|藤のみ|1"
  "16|4|tanzaku|青短(菖蒲)|5"
  "17|4|tane|菖蒲に八橋|10"
  "18|4|kasu|菖蒲のみ|1"
  "19|4|kasu|菖蒲のみ|1"
  "20|5|tanzaku|青短(牡丹)|5"
  "21|5|tane|牡丹に蝶|10"
  "22|5|kasu|牡丹のみ|1"
  "23|5|kasu|牡丹のみ|1"
  "24|6|tanzaku|青短(萩)|5"
  "25|6|tane|萩に猪|10"
  "26|6|kasu|萩のみ|1"
  "27|6|kasu|萩のみ|1"
  "28|7|hikari|芒に月|20"
  "29|7|tanzaku|青短(芒)|5"
  "30|7|tane|芒に雁|10"
  "31|7|kasu|芒のみ|1"
  "32|8|tanzaku|青短(菊)|5"
  "33|8|tane|菊に盃|10"
  "34|8|kasu|菊のみ|1"
  "35|8|kasu|菊のみ|1"
  "36|9|tanzaku|青短(楓)|5"
  "37|9|tane|紅葉に鹿|10"
  "38|9|kasu|紅葉のみ|1"
  "39|9|kasu|紅葉のみ|1"
  "40|10|hikari|柳に小野道風|20"
  "41|10|kasu|柳に雨|1"
  "42|10|kasu|柳のみ|1"
  "43|10|kasu|柳のみ|1"
  "44|11|hikari|桐に鳳凰|20"
  "45|11|kasu|桐のみ|1"
  "46|11|kasu|桐のみ|1"
  "47|11|kasu|桐のみ|1"
)

# 类别颜色映射
get_color() {
  case "$1" in
    hikari) echo "FFD700";;
    tane) echo "4CAF50";;
    tanzaku) echo "E91E63";;
    kasu) echo "9E9E9E";;
  esac
}

# 类别标签
get_label() {
  case "$1" in
    hikari) echo "光";;
    tane) echo "種";;
    tanzaku) echo "短";;
    kasu) echo "";
  esac
}

for card in "${CARDS[@]}"; do
  IFS='|' read -r id month category name points <<< "$card"
  color=$(get_color "$category")
  label=$(get_label "$category")
  mname="${MONTHS[$month]}"
  mcolor="${MONTH_COLORS[$month]}"
  fid=$(printf "%02d" "$id")

  cat > "packages/client/assets/cards/card_${fid}.svg" << SVGEOF
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
  <rect width="${CARD_W}" height="${CARD_H}" rx="8" fill="#FFFDE7" stroke="#8D6E63" stroke-width="2"/>
  <circle cx="60" cy="80" r="35" fill="#${mcolor}" opacity="0.15"/>
  <text x="60" y="75" text-anchor="middle" font-size="22" fill="#333" font-family="serif">${mname}</text>
  <text x="60" y="100" text-anchor="middle" font-size="12" fill="#666" font-family="sans-serif">${name}</text>
  ${label:+<rect x="8" y="8" width="22" height="18" rx="4" fill="#${color}"/>}
  ${label:+<text x="19" y="22" text-anchor="middle" font-size="11" fill="#fff">${label}</text>}
  <text x="108" y="188" text-anchor="end" font-size="10" fill="#999">${points}pt</text>
</svg>
SVGEOF
done

# 牌背
cat > "packages/client/assets/cards/card_back.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="192" viewBox="0 0 120 192">
  <rect width="120" height="192" rx="8" fill="#2E7D32" stroke="#1B5E20" stroke-width="2"/>
  <rect x="10" y="10" width="100" height="172" rx="6" fill="none" stroke="#4CAF50" stroke-width="1"/>
  <rect x="16" y="16" width="88" height="160" rx="4" fill="none" stroke="#66BB6A" stroke-width="0.5"/>
  <text x="60" y="106" text-anchor="middle" font-size="48" fill="#4CAF50" font-family="serif" opacity="0.6">花</text>
</svg>
SVGEOF

echo "✅ 已生成 ${#CARDS[@]} 张牌 + 牌背 SVG"
