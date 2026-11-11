# Debian (glibc) base so the @node-rs/argon2 prebuilt binary loads.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# postinstall runs `prisma generate`; it needs a URL only to parse config.
ENV DATABASE_URL="postgresql://u:p@localhost:5432/db"
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV BUILD_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="postgresql://u:p@localhost:5432/db" AUTH_SECRET="build-time-placeholder-build-time-placeholder"
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 8080
CMD ["node", "server.js"]
