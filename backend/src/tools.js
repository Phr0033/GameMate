// src/tools.js

const players = {
  u001: {
    id: "u001",
    nickname: "Peter",
    level: 35,
    weapon: "太刀",
    progress: "已经击败森林守卫",
    currentArea: "迷雾森林",
  },

  u002: {
    id: "u002",
    nickname: "Alice",
    level: 52,
    weapon: "大剑",
    progress: "已经击败熔岩巨兽",
    currentArea: "火山区域",
  },
};

const bosses = {
  森林守卫: {
    name: "森林守卫",
    area: "迷雾森林",
    recommendedLevel: 25,
    weakness: "火",
    description: "游戏前期 Boss，攻击速度较慢。",
  },

  熔岩巨兽: {
    name: "熔岩巨兽",
    area: "火山区域",
    recommendedLevel: 40,
    weakness: "冰",
    description: "具有较高火属性伤害，近战玩家需要注意范围攻击。",
  },

  冰霜女王: {
    name: "冰霜女王",
    area: "极寒之地",
    recommendedLevel: 55,
    weakness: "火",
    description: "擅长远程冰属性攻击，并能够降低玩家移动速度。",
  },
};


// 获取当前玩家的信息
export function getCurrentPlayerProfile(userId) {
  console.log("\n[Tool] get_current_player_profile 被调用");

  const player = players[userId];

  if (!player) {
    return {
      success: false,
      message: "没有找到这个玩家",
    };
  }

  return {
    success: true,
    player,
  };
}


// 查询 Boss 信息
export function getBossInfo(bossName) {
  console.log(`\n[Tool] get_boss_info 被调用: ${bossName}`);

  const boss = bosses[bossName];

  if (!boss) {
    return {
      success: false,
      message: `没有找到 Boss：${bossName}`,
    };
  }

  return {
    success: true,
    boss,
  };
}