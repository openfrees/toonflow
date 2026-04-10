FROM node:20-bookworm-slim AS web-builder

WORKDIR /app/storyweaver-web

COPY storyweaver-web/package.json storyweaver-web/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY storyweaver-web/ ./

ARG NUXT_PUBLIC_API_BASE=
ARG NUXT_PUBLIC_SIDEBAR_API_BASE=https://api.zhijuu.com
ARG NUXT_PUBLIC_DEPLOY_MODE=localhost
ARG NUXT_PUBLIC_BAIDU_ANALYTICS_KEY=

ENV NUXT_PUBLIC_API_BASE=${NUXT_PUBLIC_API_BASE}
ENV NUXT_PUBLIC_SIDEBAR_API_BASE=${NUXT_PUBLIC_SIDEBAR_API_BASE}
ENV NUXT_PUBLIC_DEPLOY_MODE=${NUXT_PUBLIC_DEPLOY_MODE}
ENV NUXT_PUBLIC_BAIDU_ANALYTICS_KEY=${NUXT_PUBLIC_BAIDU_ANALYTICS_KEY}

RUN npm run generate


FROM node:20-bookworm-slim AS api-deps

WORKDIR /app/storyweaver-api

COPY storyweaver-api/package.json storyweaver-api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund


FROM node:20-bookworm-slim AS runtime

WORKDIR /app/storyweaver-api

ENV NODE_ENV=production
ENV EGG_SERVER_ENV=prod
ENV DEPLOY_MODE=localhost
ENV LISTEN_HOST=0.0.0.0
ENV PORT=7006
ENV ZHIJUAI_LOG_DIR=/app/storyweaver-api/logs

COPY --from=api-deps /app/storyweaver-api/node_modules ./node_modules
COPY storyweaver-api/ ./
COPY --from=web-builder /app/storyweaver-web/.output/public/ ./web/

RUN mkdir -p data logs run web

EXPOSE 7006

CMD ["npx", "egg-scripts", "start", "--env=prod", "--workers=1", "--title=storyweaver-api", "--port=7006"]
