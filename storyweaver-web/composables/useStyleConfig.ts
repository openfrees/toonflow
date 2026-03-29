/**
 * 画风风格 & 画面比例 统一配置
 * 抽离为独立 composable，方便小说转剧本、写剧本、分镜等多处复用
 */

export interface StyleOption {
  value: string
  label: string
}

export interface RatioOption {
  value: string
  label: string
}

/** 画风风格选项 */
export const ART_STYLE_OPTIONS: StyleOption[] = [
  { value: '日系动漫', label: '日系动漫' },
  { value: '国风水墨', label: '国风水墨' },
  { value: '赛博朋克', label: '赛博朋克' },
  { value: '电影写实', label: '电影写实' },
  { value: '3D渲染', label: '3D渲染' },
  { value: '仙侠古风', label: '仙侠古风' },
  { value: '欧美卡通', label: '欧美卡通' },
  { value: '韩漫风格', label: '韩漫风格' },
]

/** 画面比例选项 */
export const ASPECT_RATIO_OPTIONS: RatioOption[] = [
  { value: '16:9', label: '16:9 横屏' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '1:1', label: '1:1 方形' },
]

/** composable 封装，方便模板中直接使用 */
export const useStyleConfig = () => {
  return {
    artStyleOptions: ART_STYLE_OPTIONS,
    aspectRatioOptions: ASPECT_RATIO_OPTIONS,
  }
}
