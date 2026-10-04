export type ParkTextTrigger =
  | "node-entered"
  | "character-joined"
  | "activity-click"
  | "activity-completed"
  | "battle-intro"
  | "battle-intent"
  | "battle-ended"
  | "route-completed";

export interface ParkTextEntry {
  readonly nodeId: string;
  readonly trigger: ParkTextTrigger;
  readonly text: string;
  readonly referenceId?: string;
  readonly activityIndex?: number;
}

export const parkTextEntries: readonly ParkTextEntry[] = [
  { nodeId: "node-1", trigger: "node-entered", text: "西门临时执勤点。记录仪同步完成，目标是在中央舞台带头制造混乱的一伙学生。" },
  { nodeId: "node-1", trigger: "activity-click", text: "全员检查装备：备用护具与通讯状态确认完成。", activityIndex: 1 },
  { nodeId: "node-1", trigger: "activity-completed", text: "队伍沿林荫连廊出发。" },

  { nodeId: "node-2", trigger: "node-entered", text: "林荫连廊。地面留着新鲜车轮印，像是从游乐设施方向匆忙离开。" },
  { nodeId: "node-2", trigger: "activity-click", text: "全员沿廊巡查：个人代币与轮迹线索结果已写入日志。", activityIndex: 1 },
  { nodeId: "node-2", trigger: "activity-click", text: "继续搜寻：本轮各项检定结果已记入日志，碰碰车区仍有骚动。", activityIndex: 2 },
  { nodeId: "node-2", trigger: "activity-completed", text: "代币电玩馆的电源还亮着。队伍转向服务亭补水。" },

  { nodeId: "node-3", trigger: "node-entered", text: "游园服务亭。工作人员递来饮水，也报告了被丢在地上的巡查地图。" },
  { nodeId: "node-3", trigger: "activity-click", text: "短暂休息结束；每名成员的恢复结果已分别记入日志。", activityIndex: 1 },
  { nodeId: "node-3", trigger: "activity-completed", text: "地图上标出了代币电玩馆。" },

  { nodeId: "node-4", trigger: "node-entered", text: "代币电玩馆。几台机器被推到一旁，地上有烟花纸筒和匆忙离开的脚印。" },
  { nodeId: "node-4", trigger: "activity-click", text: "全员搜查现场：纸条发现情况只记入事件日志。", activityIndex: 1 },
  { nodeId: "node-4", trigger: "activity-completed", text: "碰碰车区传来连续的撞击声。" },

  { nodeId: "node-5", trigger: "node-entered", text: "失控碰碰车区。两名捣乱学生堵住出口，水枪射手正从后排瞄准。" },
  { nodeId: "node-5", trigger: "battle-intro", text: "小栞：前排我来挡。纺希：后排射手交给我。" },
  { nodeId: "node-5", trigger: "battle-intent", referenceId: "charger-charge", text: "冲撞者准备冲锋，目标：{target}。" },
  { nodeId: "node-5", trigger: "battle-intent", referenceId: "water-gunner-sniper", text: "水枪射手从后排狙击，目标：{target}。" },
  { nodeId: "node-5", trigger: "battle-ended", referenceId: "victory", text: "一轮交锋结束。碰碰车区已安全，可以前往急救补给站。" },
  { nodeId: "node-5", trigger: "battle-ended", referenceId: "defeat", text: "全队失能，碰碰车区仍未安全；巡查行动失败。" },
  { nodeId: "node-5", trigger: "battle-ended", referenceId: "draw", text: "双方同时失能，碰碰车区的交锋以平局收束。" },

  { nodeId: "node-6", trigger: "node-entered", text: "急救补给站。志愿急救员千世加入队伍：“我熟悉园区路线，也能处理擦伤。”" },
  { nodeId: "node-6", trigger: "character-joined", referenceId: "chise", text: "千世加入队伍。" },
  { nodeId: "node-6", trigger: "activity-click", text: "全员完成急救补给：固定恢复和敷料检定结果已逐人记录；下一战开场 sCost 加成已安排。", activityIndex: 1 },
  { nodeId: "node-6", trigger: "activity-completed", text: "通讯器传来消息：有人穿过镜面迷宫，正往摩天轮方向移动。" },

  { nodeId: "node-7", trigger: "node-entered", text: "镜面迷宫。镜面把出口标牌映得到处都是，地上却有一串清楚的鞋印。" },
  { nodeId: "node-7", trigger: "activity-click", text: "沿鞋印前进：正确转角与擦伤结果以个人检定记录为准。", activityIndex: 1 },
  { nodeId: "node-7", trigger: "activity-click", text: "继续沿着鞋印前进：没有分支路线，个人检定结果已记录。", activityIndex: 2 },
  { nodeId: "node-7", trigger: "activity-completed", text: "镜面尽头就是摩天轮检修廊。" },

  { nodeId: "node-8", trigger: "node-entered", text: "摩天轮检修廊。工作人员指向烟花排练广场：“他们把设备搬到那边了。”" },
  { nodeId: "node-8", trigger: "activity-click", text: "全员检查通道：备用烟花线索或安全入口只追加到事件日志。", activityIndex: 1 },
  { nodeId: "node-8", trigger: "activity-completed", text: "广场灯光亮起。前方有人守着排练入口。" },

  { nodeId: "node-9", trigger: "node-entered", text: "烟花排练广场。临时领头守在前排，烟花手已经点亮引线。" },
  { nodeId: "node-9", trigger: "battle-intro", text: "由理：别让他们把烟花放出去。" },
  { nodeId: "node-9", trigger: "battle-intent", referenceId: "temporary-leader-cover", text: "临时领头准备掩护，目标：{target}。" },
  { nodeId: "node-9", trigger: "battle-intent", referenceId: "temporary-leader-charge", text: "临时领头准备冲锋，目标：{target}。" },
  { nodeId: "node-9", trigger: "battle-intent", referenceId: "temporary-leader-reactive-charge", text: "临时领头上一轮实际受伤，优先冲锋一次，目标：{target}。" },
  { nodeId: "node-9", trigger: "battle-intent", referenceId: "charger-charge", text: "冲撞者准备冲锋，目标：{target}。" },
  { nodeId: "node-9", trigger: "battle-intent", referenceId: "fireworks-burst", text: "烟花手点燃爆破，锁定我方存活前排：{targets}，每名目标固定 1 点伤害。" },
  { nodeId: "node-9", trigger: "battle-intent", referenceId: "fireworks-reload", text: "烟花手正在装填，本轮没有攻击目标。" },
  { nodeId: "node-9", trigger: "battle-ended", referenceId: "victory", text: "火花熄灭，入口打开。前方后台休息室暂时安全。" },
  { nodeId: "node-9", trigger: "battle-ended", referenceId: "defeat", text: "全队失能，烟花排练广场的行动失败。" },
  { nodeId: "node-9", trigger: "battle-ended", referenceId: "draw", text: "双方同时失能，烟花排练广场的交锋以平局收束。" },

  { nodeId: "node-10", trigger: "node-entered", text: "后台休息室。破阵手玲奈从道具箱后现身：“我来开路，舞台设备井交给我。”" },
  { nodeId: "node-10", trigger: "character-joined", referenceId: "reina", text: "玲奈加入队伍。" },
  { nodeId: "node-10", trigger: "activity-click", text: "全员完成最后整备：每人恢复 2 点 HP，Boss 战第二轮起每轮额外回复 1 点 sCost。", activityIndex: 1 },
  { nodeId: "node-10", trigger: "activity-completed", text: "舞台下方传来指挥声。队伍进入设备井。" },

  { nodeId: "node-11", trigger: "node-entered", text: "中央舞台设备井。红面具领队挡在控制台前，最后一轮逮捕行动开始。" },
  { nodeId: "node-11", trigger: "battle-intro", text: "玲奈：设备井入口交给我。红面具，行动结束了。" },
  { nodeId: "node-11", trigger: "battle-intent", referenceId: "red-mask-charge-1", text: "红面具领队准备冲锋，目标：{target}。" },
  { nodeId: "node-11", trigger: "battle-intent", referenceId: "red-mask-charge-2", text: "红面具领队准备冲锋，目标：{target}。" },
  { nodeId: "node-11", trigger: "battle-intent", referenceId: "red-mask-fireworks", text: "红面具领队准备烟花齐放，锁定目标：{targets}（所有存活前排，并视存活情况选择一名最低 HP 后排）。" },
  { nodeId: "node-11", trigger: "battle-intent", referenceId: "armored-student-cover", text: "护具学生准备掩护，目标：{target}。" },
  { nodeId: "node-11", trigger: "battle-intent", referenceId: "water-gunner-sniper", text: "水枪射手从后排狙击，目标：{target}。" },
  { nodeId: "node-11", trigger: "battle-ended", referenceId: "victory", text: "红面具领队交出控制器。舞台恢复安全，逮捕目标已完成。" },
  { nodeId: "node-11", trigger: "battle-ended", referenceId: "defeat", text: "全队失能，设备井行动失败。" },
  { nodeId: "node-11", trigger: "battle-ended", referenceId: "draw", text: "双方同时失能，设备井交锋以平局收束。" },

  { nodeId: "node-12", trigger: "node-entered", text: "东出口交接处。支援人员接手现场，游乐园的广播恢复正常。" },
  { nodeId: "node-12", trigger: "activity-click", text: "全员完成交接：事件记录、受损设施和逮捕名单已确认。", activityIndex: 1 },
  { nodeId: "node-12", trigger: "route-completed", text: "巡查行动结束。捣乱学生已被带离，游园会可以继续。" },
];
