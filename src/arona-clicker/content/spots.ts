import { and, cond, or } from '../../engine/types';
import { spot } from './def-factory/spot';
import type { SpotDef } from '../../data-services/contracts/world';
import { tagPath } from '../../engine/core/tag';

export const baseSpots: SpotDef[] = [
  spot('base:spot:credit_printer', 'base:area:schale_main').name('信用点制造机').desc('一台老旧但可靠的信用点制造设备，每个 Tick 都会产出信用点。').cost(0).yield(5).capacity(500).tags(tagPath('credit'), tagPath('office')).linearYield('base:funclet:credit_printer_linear', Resource.Credit, 2).gacha('base:funclet:credit_printer_gacha').genericUpgrade(50, 2, 2).build(),
  spot('base:spot:comms_terminal', 'base:area:schale_main').name('通讯终端').desc('连接联邦网络的终端设备。可以安全结束当前世界线的经营活动，回到世界线选择。').cost(0).yield(3).capacity(200).tags(tagPath('office'), tagPath('tech')).restartInit('base:funclet:comms_restart').genericUpgrade(30, 2, 1).build(),
  spot('base:spot:data_wiper', 'base:area:schale_main').name('数据清除装置').desc('一台带有⚡警示标志的重置设备。可以彻底抹除当前世界线的运营记录，下次进入时为崭新状态。注意：这会删除快照，但会保留所有统计数据。').cost(0).yield(2).capacity(100).tags(tagPath('tech'), tagPath('defense')).hardResetInit('base:funclet:data_wiper_hard_reset').genericUpgrade(25, 2, 1).build(),
  spot('base:spot:field_work', 'base:area:schale_main').name('野外调查站').desc('阿比多斯风格的小型户外作业点，适合野外探索型学生。').cost(20).yield(8).capacity(300).tags(tagPath('field'), tagPath('combat')).revealResource('name', Resource.Credit, 10).revealResource('utility', Resource.Credit, 40).linearYieldWhen('base:funclet:field_work_conditioned', Resource.Credit, 1, and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>', 100))).levelUpTo(3).genericUpgrade(80, 1.8, 1).build(),
  spot('base:spot:tactical_desk', 'base:area:schale_main').name('战术指挥台').desc('配备通讯设备和地图的指挥站，适合战术型学生。').cost(30).yield(10).capacity(200).tags(tagPath('tactical'), tagPath('intel'), tagPath('office')).revealResource('name', Resource.Credit, 20).revealResource('utility', Resource.Credit, 60).levelUpTo(3).genericUpgrade(120, 1.8, 1).build(),
  spot('base:spot:abydos_rehab', 'base:area:abydos_campus').name('对策委员会室').desc('堆满资料与装备的对策室。委员会的日常从这里开始。').cost(0).yield(4).capacity(400).tags(tagPath('office'), tagPath('defense')).restartInit('base:funclet:abydos_restart').levelUpTo(3).genericUpgrade(45, 1.8, 1).build(),
  spot('base:spot:abydos_cafe', 'base:area:abydos_campus').name('阿比多斯咖啡角').desc('临时搭起的咖啡角。午后的阳光里，少女们的谈笑声此起彼伏。').cost(15).yield(6).capacity(300).tags(tagPath('shop'), tagPath('rest')).shop('base:funclet:abydos_cafe_shop', 'base:shop:abydos-cafe').revealResource('name', Resource.Credit, 8).revealResource('utility', Resource.Credit, 30).levelUpTo(3).genericUpgrade(70, 1.8, 1).build(),
  spot('base:spot:millennium_lab', 'base:area:millennium_lab').name('千禧年数据分析站').desc('全天候运转的数据分析站。信用点从海量数据流中沉淀出来。').cost(0).yield(7).capacity(350).tags(tagPath('tech'), tagPath('intel')).restartInit('base:funclet:millennium_restart').levelUpTo(3).genericUpgrade(60, 1.8, 1).build(),
  spot('base:spot:millennium_game', 'base:area:millennium_lab').name('游戏开发部终端').desc('散发奶茶味与代码香的开发终端。正在开发一部惊天巨作。').cost(20).yield(9).capacity(250).tags(tagPath('game'), tagPath('tech')).revealResource('name', Resource.Credit, 12).revealResource('utility', Resource.Credit, 40).levelUpTo(3).genericUpgrade(90, 1.8, 1).build(),
  spot('base:spot:archive', 'base:area:schale_library').name('卷宗整理台').desc('分类整理联邦委托卷宗的工作台。每份归档都是一笔稳定的信用点收入。').cost(25).yield(6).capacity(280).tags(tagPath('archive'), tagPath('office')).levelUpTo(3).genericUpgrade(100, 1.8, 1).build(),
  spot('base:spot:hangar_supply', 'base:area:schale_hangar').name('机库补给车').desc('为出勤车辆补充物资的小型补给车。运转起来，信用点也随之流动。').cost(35).yield(9).capacity(220).tags(tagPath('logistics'), tagPath('vehicle')).revealResource('name', Resource.Credit, 30).revealResource('utility', Resource.Credit, 80).levelUpTo(3).genericUpgrade(140, 1.8, 1).build(),
  spot('base:spot:hangar_dispatch_deck', 'base:area:schale_hangar')
    .name('出勤调度台')
    .desc('统筹车辆、补给与出勤路线的调度台。只有机库形成稳定周转后，调度系统才会开放。')
    .cost(90).yield(14).capacity(360)
    .tags(tagPath('logistics'), tagPath('vehicle'), tagPath('tactical'))
    .reveal('existence', or(
      and(
        cond('spotLevel', 'base:spot:hangar_supply', '>=', 2),
        cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 1000),
      ),
      and(
        cond('hasEnh', 'base:enhancement:supply_chain', '==', 1),
        cond('hasReadStory', 'base:story:schale_flow_show', '==', 1),
      ),
    ))
    .reveal('name', and(
      cond('hasReadStory', 'base:story:schale_flow_show', '==', 1),
      cond('countTags', 'vehicle', '>=', 1),
    ))
    .reveal('utility', or(
      cond('spotLevel', 'base:spot:hangar_supply', '>=', 3),
      cond('hasEnh', 'base:enhancement:tactical_command', '==', 1),
    ))
    .levelUpTo(3).genericUpgrade(220, 1.85, 2).build(),
  spot('base:spot:hangar_maintenance_bay', 'base:area:schale_hangar')
    .name('车辆维护坞')
    .desc('检修夏莱专用车辆的维护坞。后勤规模与技术储备同时达标后，才能承担高强度出勤。')
    .cost(120).yield(12).capacity(420)
    .tags(tagPath('vehicle'), tagPath('tech'), tagPath('maintenance'))
    .reveal('existence', and(
      cond('countTags', 'vehicle', '>=', 2),
      or(
        cond('spotLevel', 'base:spot:data_wiper', '>=', 2),
        cond('hasEnh', 'base:enhancement:field_logistics', '==', 1),
      ),
    ))
    .reveal('condition', or(
      and(
        cond('resource', Resource.Credit, '>=', 600),
        cond('stat', '$CurrentRunProducedAmount base:resource:credit', '>=', 1500),
      ),
      and(
        cond('hasEnh', 'base:enhancement:combat_drone', '==', 1),
        cond('hasEnh', 'base:enhancement:intel_network', '==', 1),
      ),
    ))
    .reveal('utility', and(
      cond('spotLevel', 'base:spot:hangar_dispatch_deck', '>=', 1),
      cond('countTags', 'tech', '>=', 2),
    ))
    .levelUpTo(3).genericUpgrade(260, 1.9, 2).build(),
  spot('base:spot:hangar_command_link', 'base:area:schale_hangar')
    .name('联邦出勤联络台')
    .desc('连接各学院出勤网络的联络台。它要求稳定的机库产能，也要求老师真正理解夏莱的日常调度。')
    .cost(180).yield(18).capacity(500)
    .tags(tagPath('tactical'), tagPath('intel'), tagPath('office'))
    .reveal('existence', or(
      and(
        cond('hasReadStory', 'base:story:schale_welcome', '==', 1),
        cond('spotLevel', 'base:spot:hangar_dispatch_deck', '>=', 2),
        cond('resource', Resource.Credit, '>=', 1000),
      ),
      and(
        cond('countTags', 'logistics', '>=', 2),
        cond('hasEnh', 'base:enhancement:area_hub', '==', 1),
      ),
    ))
    .reveal('name', and(
      cond('hasReadStory', 'base:story:schale_flow_show', '==', 1),
      or(
        cond('hasEnh', 'base:enhancement:tactical_command', '==', 1),
        cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 2500),
      ),
    ))
    .reveal('utility', and(
      cond('spotLevel', 'base:spot:hangar_maintenance_bay', '>=', 2),
      cond('countTags', 'tactical', '>=', 2),
    ))
    .levelUpTo(3).genericUpgrade(360, 2, 3).build(),
  spot('base:spot:pool_train', 'base:area:abydos_pool').name('泳池训练棚').desc('在干涸的池底架起的简易训练棚。挥洒汗水，也沉淀信用点。').cost(18).yield(5).capacity(260).tags(tagPath('training'), tagPath('defense')).levelUpTo(3).genericUpgrade(85, 1.8, 1).build(),
  spot('base:spot:canteen_vendor', 'base:area:millennium_canteen').name('食堂自动售货机').desc('千禧年食堂的自动化售货机。投币、出货、信用点到账，一气呵成。').cost(28).yield(8).capacity(240).tags(tagPath('shop'), tagPath('tech')).gacha('base:funclet:canteen_gacha').gachaPools('base:gachapool:canteen_exclusive').revealResource('name', Resource.Credit, 20).revealResource('utility', Resource.Credit, 60).levelUpTo(3).genericUpgrade(110, 1.8, 1).build(),
  spot('base:spot:millennium_ai_cluster', 'base:area:millennium_server').name('AI 训练集群').desc('搭载专用 GPU 的分布式训练集群。海量数据从这里流经，信用点与算力等比产出。').cost(50).yield(12).capacity(400).tags(tagPath('tech'), tagPath('link'), tagPath('math')).restartInit('base:funclet:ai_restart').levelUpTo(3).genericUpgrade(200, 1.8, 1).build(),
  spot('base:spot:trinity_donation', 'base:area:trinity_cathedral').name('圣所捐赠箱').desc('信徒们虔诚的捐赠汇集于此。每一笔捐赠都化为重建学园的基石。').cost(0).yield(6).capacity(500).tags(tagPath('faith'), tagPath('courtesy'), tagPath('credit')).restartInit('base:funclet:trinity_restart').levelUpTo(3).genericUpgrade(55, 1.8, 1).build(),
  spot('base:spot:trinity_repair', 'base:area:trinity_cathedral').name('古文书修复台').desc('满是古籍与羊皮纸的修复工坊。每修复一页，信用点便伴随历史苏醒。').cost(30).yield(9).capacity(300).tags(tagPath('archive'), tagPath('book')).revealResource('name', Resource.Credit, 15).revealResource('utility', Resource.Credit, 50).levelUpTo(3).genericUpgrade(130, 1.8, 1).build(),
  spot('base:spot:trinity_tea_prep', 'base:area:trinity_tea_room').name('茶会准备台').desc('精致的茶具与点心摆满桌面。淑女们在优雅的茶香中讨论着学园的未来。').cost(25).yield(10).capacity(280).tags(tagPath('tea'), tagPath('rest'), tagPath('politics')).revealResource('name', Resource.Credit, 18).revealResource('utility', Resource.Credit, 55).levelUpTo(3).genericUpgrade(110, 1.8, 1).build(),
  spot('base:spot:gehenna_hall', 'base:area:gehenna_council').name('万魔殿会议厅').desc('桌椅歪斜、文件散落的会议厅。看似杂乱无章，却总能高效地完成行政工作。').cost(0).yield(7).capacity(350).tags(tagPath('admin'), tagPath('discipline'), tagPath('office')).restartInit('base:funclet:gehenna_restart').levelUpTo(3).genericUpgrade(65, 1.8, 1).build(),
  spot('base:spot:gehenna_bureau', 'base:area:gehenna_district').name('便利屋68据点').desc('挂着"业务中"牌子的小事务所。社长亚瑠的"法外"业务为学园带来意想不到的收益。').cost(35).yield(11).capacity(260).tags(tagPath('business'), tagPath('outlaw'), tagPath('shop')).revealResource('name', Resource.Credit, 25).revealResource('utility', Resource.Credit, 70).levelUpTo(3).genericUpgrade(150, 1.8, 1).build(),
];
import { Resource } from '../types/ids';
