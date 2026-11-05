# 저장소 루트를 컨텍스트로 빌드한다: docker build -f apps/api/Dockerfile .
FROM node:24-slim AS build
WORKDIR /repo
COPY . .
RUN node .yarn/releases/yarn-*.cjs install --immutable
RUN node .yarn/releases/yarn-*.cjs turbo run build --filter=@raon/api

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo /repo
USER node
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
