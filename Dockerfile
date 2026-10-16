# One image serves the API and the built web app. Cloud Run sets PORT.
# docs/deploy-gcp.md shows how to build and run it on Google Cloud.

FROM node:26-slim AS build
WORKDIR /app
RUN npm install --global pnpm@12.3.4
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @monsport/web build \
 && pnpm --filter @monsport/api build

FROM node:26-slim
# The Prisma schema engine for `migrate deploy` needs OpenSSL.
RUN apt-get update \
 && apt-get install --yes --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production WEB_DIST=/app/apps/web/dist PORT=8080
COPY --from=build /app /app
WORKDIR /app/apps/api
USER node
EXPOSE 8080
# Migrations run before the server starts. Prisma takes an advisory lock. An instance that waits too long for it fails, and Cloud Run starts it again.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
