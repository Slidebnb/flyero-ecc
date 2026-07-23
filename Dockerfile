FROM node:22-bookworm-slim AS app

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://flyero:flyero@localhost:5432/flyero?schema=public
ARG NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=""
RUN test -n "$NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY"
ENV NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=""
ENV NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=$NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
ARG NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED="false"
ENV NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED=$NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates clamav \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm@11.6.2

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

ARG DEPLOY_SHA=local
RUN test -n "$DEPLOY_SHA"
COPY . .
RUN npm run prisma:generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
