const DEFAULT_MEMBERSHIP_RIGHTS = {
  free: {
    level: 'free',
    levelName: '免费会员',
    levelRank: 0,
    createLimit: 4,
    novelWordLimit: 500000,
    isVip: false,
  },
  basic: {
    level: 'basic',
    levelName: '基础会员',
    levelRank: 1,
    createLimit: 30,
    novelWordLimit: 1000000,
    isVip: true,
  },
  advanced: {
    level: 'advanced',
    levelName: '高级会员',
    levelRank: 2,
    createLimit: 100,
    novelWordLimit: 2000000,
    isVip: true,
  },
}

export const useMembershipRights = () => {
  const formatWordLimit = (limit) => {
    const value = Number(limit || 0)
    if (!value) return '不限字数'
    if (value % 10000 === 0) return `${value / 10000}万字`
    return `${value.toLocaleString()}字`
  }

  const resolveMembershipInfo = (userInfo = null) => {
    const level = userInfo?.membershipLevel || (userInfo?.isVip ? 'basic' : 'free')
    const fallback = DEFAULT_MEMBERSHIP_RIGHTS[level] || DEFAULT_MEMBERSHIP_RIGHTS.free
    return {
      ...fallback,
      level,
      levelName: userInfo?.membershipLevelName || fallback.levelName,
      levelRank: Number(userInfo?.membershipLevelRank ?? fallback.levelRank),
      createLimit: Number(userInfo?.membershipCreateLimit ?? fallback.createLimit),
      novelWordLimit: Number(userInfo?.membershipNovelWordLimit ?? fallback.novelWordLimit),
      isVip: level !== 'free',
    }
  }

  const buildCreationLimitDialog = (membership, nextCount) => {
    const createLimit = Number(membership?.createLimit || 0)
    if (membership.level === 'basic') {
      return {
        title: '需要升级会员',
        description: `基础会员最多创建${createLimit}个剧本，您当前将创建第${nextCount}个，请升级到高级会员后继续。`,
        confirmText: '去升级会员',
        shouldNavigate: true,
      }
    }
    if (membership.level === 'advanced') {
      return {
        title: '已达到创建上限',
        description: `高级会员最多创建${createLimit}个剧本，您当前将创建第${nextCount}个，请先整理或删除已有项目后再继续。`,
        confirmText: '我知道了',
        shouldNavigate: false,
      }
    }
    return {
      title: '需要购买会员',
      description: `免费会员最多创建4个剧本，您当前将创建第${nextCount}个，请购买会员后继续。`,
      confirmText: '去购买会员',
      shouldNavigate: true,
    }
  }

  const buildNovelWordLimitDialog = (membership, totalWords) => {
    const currentWordText = Number(totalWords || 0).toLocaleString()
    const novelWordLimitText = formatWordLimit(membership?.novelWordLimit)
    if (membership.level === 'basic') {
      return {
        title: '需要升级会员',
        description: `基础会员最多支持${novelWordLimitText}小说转剧本保存，当前内容约${currentWordText}字，请升级到高级会员后继续。`,
        confirmText: '去升级会员',
        shouldNavigate: true,
      }
    }
    if (membership.level === 'advanced') {
      return {
        title: '请减少章节',
        description: `高级会员最多支持${novelWordLimitText}小说转剧本保存，当前内容约${currentWordText}字，请减少章节后再保存。`,
        confirmText: '返回调整',
        shouldNavigate: false,
      }
    }
    return {
      title: '需要购买会员',
      description: `免费会员最多支持50万字小说转剧本保存，当前内容约${currentWordText}字，请购买基础会员后继续。`,
      confirmText: '去购买会员',
      shouldNavigate: true,
    }
  }

  return {
    DEFAULT_MEMBERSHIP_RIGHTS,
    formatWordLimit,
    resolveMembershipInfo,
    buildCreationLimitDialog,
    buildNovelWordLimitDialog,
  }
}
