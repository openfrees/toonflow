<p>
  <a href="https://github.com/openfrees/toonflow.git">
    <img src="https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub" />
  </a>
  &nbsp;|&nbsp;
  <a href="https://gitee.com/open_free/toonflow.git">
    <img src="https://img.shields.io/badge/Gitee-C71D23?style=flat-square&logo=gitee&logoColor=white" alt="Gitee" />
  </a>
  &nbsp;|&nbsp;
  <a href="https://www.zhijuu.com">
    <img src="https://img.shields.io/badge/官网-www.zhijuu.com-blue?style=flat-square&logo=googlechrome&logoColor=white" alt="官网" />
  </a>
</p>

<p align="center">
  <strong>中文</strong> | 
  <a href="./docs/README.en.md">English</a>
</p>

<div align="center">
<a href="https://www.zhijuu.com">
  <img src="https://www.zhijuu.com/brand-mark-main.svg" alt="知剧AI Logo" height="120"/>
</a>

# 知剧AI

  <p align="center">
    <b>
      AI 短剧创作平台
      <br />
      小说秒转剧本，剧本延展分镜
      <br />
      前后端与桌面端一体化交付 🔥
    </b>
  </p>
  🚀 **一站式短剧工程**：AI 剧本生成 × 小说转剧本 × 分镜辅助 × 管理后台 × 桌面端封装，全流程覆盖！

  <br />
  <a href="https://www.zhijuu.com">
    <img src="https://img.shields.io/badge/官网-www.zhijuu.com-blue?style=for-the-badge&logo=googlechrome&logoColor=white" alt="访问官网" />
  </a>
</div>

---

# 🌟 主要功能

知剧AI 是一个面向短剧创作与管理的源码开放项目，提供完整的前端站点、后端 API、管理后台和 Electron 桌面端封装，适合个人学习、研究、非商业本地部署和功能体验。

- ✅ **AI 剧本生成**  
   支持从创意到结构化剧本的生成与编辑，帮助快速搭建短剧内容骨架。
- ✅ **小说转剧本**  
   支持小说项目、章节、剧情线到剧本的转换流程，适合影视改编类创作场景。
- ✅ **分镜辅助**  
   围绕剧本场景生成分镜、封面和画面素材，提升后续视频制作效率。
- ✅ **桌面端封装**  
   支持 Electron 联调与安装包构建，可输出 Windows / macOS 桌面客户端。

---

# 📦 应用场景

- AI 短剧创作平台
- 小说影视化改编工具
- 私有化内容生产系统
- 桌面端短剧创作工作台
- 面向运营团队的后台管理系统
- 学习和研究型项目参考

---

# 🔰 使用指南

## 📺 视频教程

<!-- 待补充：视频教程链接、封面图、二维码 -->
<!-- 例如 B 站、抖音、公众号教程，有了之后按下面格式补上 -->

<!-- https://www.bilibili.com/video/待补充 -->
<!-- [![知剧AI 快速上手教程](./docs/videoCover.png)](https://www.bilibili.com/video/待补充) -->

**知剧AI 快速上手教程**
👉 [点击观看（待补充）](#)

<!-- 📱 手机微信扫码观看 -->
<!-- <img src="./docs/videoQR.png" alt="微信扫码观看" width="150"/> -->

---

# 🚀 安装

## 前置条件

在安装和使用本软件之前，请准备以下内容：

- ✅ Node.js `>= 18`
- ✅ npm `>= 9`

## 本机安装

### 1. 下载与安装

| 操作系统 | GitHub 下载                                                  | 网盘下载                                    | 说明           |
| :------: | :----------------------------------------------------------- | :---------------------------------------------- | :------------- |
| Windows  | [Release](https://github.com/openfrees/toonflow/releases) | [网盘下载（待补充）](#) | 官方发布安装包 |
|  macOS   | [Release](https://github.com/openfrees/toonflow/releases) | [网盘下载（待补充）](#) | 官方发布安装包 |
|  Linux   | [Release](https://github.com/openfrees/toonflow/releases) | [网盘下载（待补充）](#) | 待提供         |

> 当前仓库已支持 Windows 和 macOS 打包。Release 页地址、网盘地址请后续补上。

### 2. 启动服务

安装完成后，启动程序即可开始使用本服务。

> ⚠️ **首次登录**  
> 账号：`手机号`　｜　密码：`随便设置`  
> 没有任何验证本地登录，所以手机密码随便设置

## Docker 部署

### 前置条件

- 已安装 [Docker](https://docs.docker.com/get-docker/)（版本 20.10+）
- 已安装 [Docker Compose](https://docs.docker.com/compose/install/)（版本 2.0+）

### 方式一：在线部署（推荐）

<!-- 待补充：当前仓库尚未内置 docker-compose.yml，以下为推荐的部署结构 -->
<!-- 如果你后续补了正式 docker-compose.yml，直接把这段替换成实际命令即可 -->

```shell
# 仓库地址待补充
git clone https://github.com/openfrees/toonflow.git
```

推荐容器拆分方式：

- 前端容器：基于 `storyweaver-web` 执行 `npm install` 和 `npm run generate:local`，将生成后的静态资源交给 Nginx
- 后端容器：基于 `storyweaver-api` 执行 `npm install` 并启动服务
- 数据卷：将 SQLite 数据、日志目录单独做 volume 挂载，避免容器删除后数据丢失

### 方式二：本地构建

使用本地已有的源码直接构建，适合开发者或已克隆仓库的用户：

```shell
# 先克隆项目（如已有则跳过）
git clone https://github.com/openfrees/toonflow.git

# 前端生成本地静态资源
cd storyweaver-web
npm install
npm run generate:local

# 后端安装依赖
cd ../storyweaver-api
npm install
```

### 服务端口说明

| 端口    | 用途           | 说明                    |
| ------- | -------------- | ----------------------- |
| `7006`  | 后端 API 服务  | Egg.js 默认开发端口     |
| `7005`  | 前端开发服务   | Nuxt 3 默认开发端口     |

### 数据持久化

默认日志目录会挂载到宿主机。如需持久化上传文件或数据库，可在 Docker Compose 中添加 volumes：

```yaml
volumes:
  - ./storyweaver-api/data:/app/data
  - ./storyweaver-api/logs:/app/logs
  - ./storyweaver-api/run:/app/run
```

### 常用操作命令

```shell
# 查看容器状态
docker-compose ps

# 查看实时日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重新构建并启动（更新版本时使用）
docker-compose up -d --build

# 进入容器调试
docker exec -it 容器名 sh
```

> ⚠️ 首次登录信息见 [本机安装 - 启动服务](#2-启动服务)

---

# 🔧 开发流程指南

> [!CAUTION]
> 🚧 **PR 提交规范** 🚧
> 
> <!-- 待补充：PR 分支规范、提交信息规范 -->
> 请将 PR 提交到指定开发分支（待补充具体分支名）

## 开发环境准备

- **Node.js**：版本要求 18 及以上
- **npm**：推荐最新版

## 快速启动项目

1. **克隆项目**

   **从 GitHub 克隆：**

   ```bash
   git clone https://github.com/openfrees/toonflow.git
   ```

   **从 Gitee 克隆（国内推荐）：**

   ```bash
   git clone https://gitee.com/open_free/toonflow.git
   ```

2. **安装依赖**

   请先在项目根目录下执行以下命令以安装依赖项：

   ```bash
   cd storyweaver-api && npm install
   cd ../storyweaver-web && npm install
   cd ../electron && npm install
   ```

3. **启动开发环境**

   本项目包含 **后端 API 服务** 和 **前端页面** 两部分，请根据需要选择启动方式：

   - **方式一：仅启动后端服务（开发调试用）**

     ```bash
     cd storyweaver-api
     npm run dev
     ```

     > ⚠️ 此命令仅启动后端 API 服务，**不包含前端页面**。如需同时使用前端页面，请配合前端项目单独启动，或使用 Electron 桌面模式。

   - **方式二：启动前端页面**

     ```bash
     cd storyweaver-web
     npm run dev
     ```

   - **方式三：启动 Electron 桌面客户端（推荐完整体验）**

     ```bash
     cd electron
     npm run dev
     ```

     > 此命令会启动 Electron 桌面窗口，配合后端服务使用，开箱即用。适合想要完整体验所有功能的开发者。

   **三种模式对比：**

   | 命令           | 启动内容                 | 前端页面 | 适用场景                         |
   | -------------- | ------------------------ | -------- | -------------------------------- |
   | `npm run dev`（api） | 仅后端 API | ❌ 无    | 后端开发调试、配合前端项目联调   |
   | `npm run dev`（web） | 仅前端页面 | ✅ 有    | 前端开发调试   |
   | `npm run dev`（electron） | Electron 桌面端   | ✅ 内置  | 完整功能体验、桌面客户端开发调试 |

4. **项目打包**

   - 前端本地静态生成：

     ```bash
     cd storyweaver-web
     npm run generate:local
     ```

   - 前端生产环境构建：

     ```bash
     npm run build:prod
     ```

   - 打包为 Windows 平台可执行程序：

     ```bash
     cd electron
     npm run build:win
     ```

   - 打包为 Mac 平台可执行程序：

     ```bash
     cd electron
     npm run build:mac
     ```

   - 全部平台打包：

     ```bash
     cd electron
     npm run build:all
     ```

5. **代码质量检查**

   ```bash
   cd storyweaver-api
   npm run test
   ```

## 前端开发

前端代码位于 `storyweaver-web`，基于 Nuxt 3 + Vue 3 + Pinia + TypeScript 构建。

常用命令：

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 本地开发（加载 `.env.localhost`） |
| `npm run generate:local` | 本地模式静态生成 |
| `npm run generate:prod` | 生产环境静态生成 |
| `npm run build:prod` | 生产环境 SSR 构建 |

## 项目结构

```
📂 storyweaver-web/              # Nuxt 3 前端
📂 storyweaver-api/              # Egg.js 后端与管理后台
│  ├─ 📂 app/
│  │  ├─ 📂 controller/          # 控制器
│  │  ├─ 📂 service/             # 业务逻辑
│  │  ├─ 📂 model/               # 数据模型
│  │  ├─ 📂 middleware/          # 中间件
│  │  ├─ 📂 view/                # Nunjucks 模板（管理后台）
│  │  └─ 📂 public/              # 静态资源
│  ├─ 📂 config/                 # 配置文件
│  └─ 📂 database/               # 数据库迁移
📂 electron/                     # Electron 桌面端封装
│  ├─ 📄 main.js                 # Electron 入口
│  ├─ 📂 scripts/                # 构建脚本
│  └─ 📂 icons/                  # 应用图标
📄 brand-mark-main.svg           # 品牌图标源文件
📄 LICENSE                       # 许可协议
📄 README.md                     # 项目说明
```

---

# 🔗 相关仓库

| 仓库             | 说明                               | GitHub                                             | Gitee                                            |
| ---------------- | ---------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| **知剧AI** | 完整项目（本仓库，推荐） | [GitHub](https://github.com/openfrees/toonflow.git) | [Gitee](https://gitee.com/open_free/toonflow.git) |
| **storyweaver-web** | 前端源代码（当前仓库子目录）       | 同上 | 同上 |
| **storyweaver-api** | 后端源代码（当前仓库子目录）       | 同上 | 同上 |
| **electron** | 桌面端源代码（当前仓库子目录）       | 同上 | 同上 |

> 💡 **提示**：如果您只是想使用知剧AI，直接下载本仓库的客户端即可。如需二次开发或定制，请克隆完整仓库。

---

# 📝 开发计划

我们正持续优化产品，以下为近期开发重点：

1. 核心功能升级

- `🧩 AI 剧本生成增强` 支持更多 AI 模型接入，优化剧本结构与对白质量
- `📄 小说转剧本优化` 支持多格式文本导入，强化章节解析与剧情线梳理

2. 生产流程优化

- `👗 分镜管理增强` 强化分镜与剧本场景的关联，支持批量生成与调整
- `📦 批量处理/任务队列` 支持多章节同时处理，后台任务管理，进度实时监控

3. 部署与体验增强

- `🐳 Docker 部署模板` 提供开箱即用的 docker-compose.yml
- `📱 多端适配` 优化移动端体验，完善桌面端功能

---

# 👨‍👩‍👧‍👦 微信交流群

<!-- 待补充：微信群二维码、拉群助手 -->

<!-- 交流群 1 -->

<!-- 交流群 2 -->

拉群小助手:

<!-- <img src="./docs/QR.png" alt="知剧AI Logo" height="400"/> -->

> 微信群二维码待补充，有了之后把上面注释取消即可。

---

# 💌 联系我们

<!-- 联系邮箱 -->
📧 邮箱：[toms6688@foxmail.com](mailto:toms6688@foxmail.com?subject=知剧AI咨询)

---

# 📜 许可证

知剧AI 采用**个人学习与非商业研究许可协议**发布，许可证详情见 [`LICENSE`](./LICENSE)。

你可以在遵守许可协议全部条款的前提下：

- 获取、阅读、下载和保存本项目源码
- 为个人学习、技术研究、功能验证和非商业本地部署目的使用
- 在非商业前提下修改源码，并保留原始版权和许可声明

明确禁止：

- 将本项目或其衍生版本用于任何商业目的
- 将本项目用于收费服务、SaaS、云托管、代部署、代运营或技术外包交付
- 销售、转售、出租、授权、分发源码、安装包、镜像或二次开发版本

如需获得商业授权许可，请通过邮箱与我们联系。


---

# 🙏 致谢

感谢以下开源项目为知剧AI提供强大支持：

- [Nuxt](https://nuxt.com/) - 基于 Vue 的全栈框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Egg.js](https://www.eggjs.org/) - 企业级 Node.js 框架
- [Sequelize](https://sequelize.org/) - Node.js ORM 框架
- [Electron](https://www.electronjs.org/) - 跨平台桌面应用开发框架
- [Pinia](https://pinia.vuejs.org/) - Vue 状态管理库
- [SQLite](https://www.sqlite.org/) - 轻量级嵌入式数据库
- [Sharp](https://sharp.pixelplumbing.com/) - 高性能 Node.js 图像处理库
- [AI SDK](https://ai-sdk.dev/) - 面向 TypeScript 的 AI 工具包
- [Zod](https://zod.dev/) - TypeScript 优先的模式验证库

<!-- 待补充：如果有赞助商或支持单位，可以按下面格式添加 -->
<!--
<table>
  <tr>
    <td>
      <img src="./docs/sponsored/xxx.png" alt="赞助商 Logo" width="48">
    </td>
    <td>
      <b>赞助商名称</b> 提供 XXX 赞助
      <a href="https://xxx.com/">[官网]</a>
    </td>
  </tr>
</table>
-->

##### copyright © 知剧AI
