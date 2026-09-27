# Bygger appen som et lite produksjonsbilde (Next.js standalone).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ARG GIT_SHA=ukjent
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 APP_VERSION=$GIT_SHA
RUN addgroup -S faktura && adduser -S faktura -G faktura
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Migreringer og driftsskript kjøres med tsx fra samme bilde.
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=deps /app/node_modules ./node_modules
USER faktura
EXPOSE 3000
# Kjører migreringer (RUN_MIGRATIONS=true) og starter appen. Se scripts/start.sh.
CMD ["sh", "scripts/start.sh"]
