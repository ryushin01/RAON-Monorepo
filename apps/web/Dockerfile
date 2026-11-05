# 저장소 루트를 컨텍스트로 빌드한다: docker build -f apps/web/Dockerfile .
FROM node:24-slim AS build
WORKDIR /repo
COPY . .
RUN node .yarn/releases/yarn-*.cjs install --immutable
ENV NEXT_OUTPUT=standalone
RUN node .yarn/releases/yarn-*.cjs turbo run build --filter=@raon/web
RUN cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static

FROM node:24-slim
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
USER node
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "server.js"]
