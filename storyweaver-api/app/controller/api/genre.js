'use strict';

const Controller = require('egg').Controller;

/**
 * C端 - 题材类型控制器
 */
class GenreController extends Controller {

  /**
   * GET /api/genre/list - 获取启用的题材列表（按分类分组）
   */
  async list() {
    const { ctx } = this;

    try {
      const genres = await ctx.model.Genre.findAll({
        where: { is_enabled: 1 },
        order: [['sort_order', 'DESC'], ['id', 'ASC']],
        raw: true,
      });

      /* 按 category 分组返回 */
      const grouped = {};
      for (const g of genres) {
        if (!grouped[g.category]) grouped[g.category] = [];
        grouped[g.category].push({
          id: String(g.id),
          name: g.name,
        });
      }

      ctx.body = ctx.helper.success(grouped);
    } catch (err) {
      ctx.body = ctx.helper.fail(err.message);
    }
  }
}

module.exports = GenreController;
