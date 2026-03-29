'use strict';

const Service = require('egg').Service;
const dayjs = require('dayjs');

/**
 * 管理后台 - 仪表盘服务
 */
class DashboardService extends Service {

  /**
   * 获取仪表盘统计数据
   * @returns {Promise<object>}
   */
  async getStats() {
    const { ctx } = this;

    /* 并行查询各项统计 */
    const [
      totalDramas,
      onlineDramas,
      draftDramas,
      totalEpisodes,
      totalGenres,
      totalUsers,
      todayNewDramas,
    ] = await Promise.all([
      /* 短剧总数 */
      ctx.model.Drama.count().catch(() => 0),
      /* 上架短剧数 */
      ctx.model.Drama.count({ where: { status: 1 } }).catch(() => 0),
      /* 草稿短剧数 */
      ctx.model.Drama.count({ where: { status: 2 } }).catch(() => 0),
      /* 分集总数 */
      ctx.model.DramaEpisode.count().catch(() => 0),
      /* 分类总数 */
      ctx.model.Genre.count({ where: { status: 1 } }).catch(() => 0),
      /* 用户总数 */
      ctx.model.User.count().catch(() => 0),
      /* 今日新增短剧 */
      ctx.model.Drama.count({
        where: {
          created_at: {
            [ctx.model.Sequelize.Op.gte]: dayjs().startOf('day').toDate(),
          },
        },
      }).catch(() => 0),
    ]);

    /* 总浏览量 */
    const viewResult = await ctx.model.Drama.findOne({
      attributes: [
        [ctx.model.Sequelize.fn('SUM', ctx.model.Sequelize.col('view_count')), 'total_views'],
      ],
      raw: true,
    }).catch(() => null);

    return {
      totalDramas,
      onlineDramas,
      draftDramas,
      totalEpisodes,
      totalGenres,
      totalUsers,
      todayNewDramas,
      totalViews: Number(viewResult?.total_views) || 0,
    };
  }
}

module.exports = DashboardService;
