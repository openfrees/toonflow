'use strict';

/**
 * localhost 模式种子数据
 * 首次启动 SQLite 时自动写入，让开源用户开箱即用
 * 数据来源：线上 MySQL 的预设数据
 */

/* 题材类型 - 三大分类：时代背景 / 主题情节 / 角色设定 */
const genres = [
  /* ---- 时代背景 ---- */
  { name: '古代', category: '时代背景', sort_order: 10 },
  { name: '异界', category: '时代背景', sort_order: 20 },
  { name: '架空', category: '时代背景', sort_order: 30 },
  { name: '职场', category: '时代背景', sort_order: 40 },
  { name: '都市', category: '时代背景', sort_order: 50 },
  { name: '民国', category: '时代背景', sort_order: 60 },
  { name: '校园', category: '时代背景', sort_order: 70 },
  { name: '乡村', category: '时代背景', sort_order: 80 },
  { name: '年代', category: '时代背景', sort_order: 90 },

  /* ---- 主题情节 ---- */
  { name: '商战', category: '主题情节', sort_order: 10 },
  { name: '恐怖', category: '主题情节', sort_order: 20 },
  { name: '动作', category: '主题情节', sort_order: 30 },
  { name: '求生', category: '主题情节', sort_order: 40 },
  { name: '科幻', category: '主题情节', sort_order: 50 },
  { name: '武侠', category: '主题情节', sort_order: 60 },
  { name: '抗战', category: '主题情节', sort_order: 70 },
  { name: '刑侦', category: '主题情节', sort_order: 80 },
  { name: '民国传奇', category: '主题情节', sort_order: 90 },
  { name: '家国情怀', category: '主题情节', sort_order: 100 },
  { name: '法律', category: '主题情节', sort_order: 110 },
  { name: '灵异', category: '主题情节', sort_order: 120 },
  { name: '志怪', category: '主题情节', sort_order: 130 },
  { name: '青春', category: '主题情节', sort_order: 140 },
  { name: '喜剧', category: '主题情节', sort_order: 150 },
  { name: '民国爱情', category: '主题情节', sort_order: 160 },
  { name: '悬疑', category: '主题情节', sort_order: 170 },
  { name: '种田', category: '主题情节', sort_order: 180 },
  { name: '仙侠', category: '主题情节', sort_order: 190 },
  { name: '年代爱情', category: '主题情节', sort_order: 200 },
  { name: '权谋', category: '主题情节', sort_order: 210 },
  { name: '玄幻', category: '主题情节', sort_order: 220 },
  { name: '宫斗', category: '主题情节', sort_order: 230 },
  { name: '战神', category: '主题情节', sort_order: 240 },
  { name: '古言', category: '主题情节', sort_order: 250 },
  { name: '脑洞', category: '主题情节', sort_order: 260 },
  { name: '奇幻', category: '主题情节', sort_order: 270 },
  { name: '女性成长', category: '主题情节', sort_order: 280 },
  { name: '现言', category: '主题情节', sort_order: 290 },

  /* ---- 角色设定 ---- */
  { name: '丧尸', category: '角色设定', sort_order: 10 },
  { name: '特种兵', category: '角色设定', sort_order: 20 },
  { name: '黑道', category: '角色设定', sort_order: 30 },
  { name: '暴富', category: '角色设定', sort_order: 40 },
  { name: '方言', category: '角色设定', sort_order: 50 },
  { name: '病娇', category: '角色设定', sort_order: 60 },
  { name: '双向救赎', category: '角色设定', sort_order: 70 },
  { name: '灵魂互换', category: '角色设定', sort_order: 80 },
  { name: '捞偏门', category: '角色设定', sort_order: 90 },
  { name: '白月光', category: '角色设定', sort_order: 100 },
  { name: '玄学', category: '角色设定', sort_order: 110 },
  { name: '萌宠', category: '角色设定', sort_order: 120 },
  { name: '业界精英', category: '角色设定', sort_order: 130 },
  { name: '反派主角', category: '角色设定', sort_order: 140 },
  { name: '福宝', category: '角色设定', sort_order: 150 },
  { name: '一见钟情', category: '角色设定', sort_order: 160 },
  { name: '姐弟恋', category: '角色设定', sort_order: 170 },
  { name: '神医', category: '角色设定', sort_order: 180 },
  { name: '追妻火葬场', category: '角色设定', sort_order: 190 },
  { name: '青梅竹马', category: '角色设定', sort_order: 200 },
  { name: '娱乐圈', category: '角色设定', sort_order: 210 },
  { name: '医生', category: '角色设定', sort_order: 220 },
  { name: '甜宠', category: '角色设定', sort_order: 230 },
  { name: '强强联合', category: '角色设定', sort_order: 240 },
  { name: '赘婿逆袭', category: '角色设定', sort_order: 250 },
  { name: '异能', category: '角色设定', sort_order: 260 },
  { name: '传承觉醒', category: '角色设定', sort_order: 270 },
  { name: '虐恋', category: '角色设定', sort_order: 280 },
  { name: '家长里短', category: '角色设定', sort_order: 290 },
  { name: '破镜重圆', category: '角色设定', sort_order: 300 },
  { name: '强者回归', category: '角色设定', sort_order: 310 },
  { name: '豪门', category: '角色设定', sort_order: 320 },
  { name: '小人物', category: '角色设定', sort_order: 330 },
  { name: '神豪', category: '角色设定', sort_order: 340 },
  { name: '先婚后爱', category: '角色设定', sort_order: 350 },
  { name: '系统', category: '角色设定', sort_order: 360 },
  { name: '穿越', category: '角色设定', sort_order: 370 },
  { name: '重生', category: '角色设定', sort_order: 380 },
  { name: '马甲', category: '角色设定', sort_order: 390 },
  { name: '大女主', category: '角色设定', sort_order: 400 },
  { name: '大男主', category: '角色设定', sort_order: 410 },
  { name: '打脸虐渣', category: '角色设定', sort_order: 420 },
];

/* 系统配置 - localhost 模式适用的默认值 */
const systemConfigs = [
  { func_key: 'register_phone', func_value: '0', func_desc: '新用户手机注册赠送积分（0=不赠送）' },
  { func_key: 'register_phone_vip_days', func_value: '0', func_desc: '新用户手机注册赠送会员天数（0=不赠送）' },
];

module.exports = { genres, systemConfigs };
