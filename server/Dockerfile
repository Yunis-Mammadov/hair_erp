FROM node:24-bookworm-slim AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
WORKDIR /app
COPY server ./server
COPY shared ./shared
RUN cd server && DATABASE_URL=postgresql://unused:unused@localhost/unused npx prisma generate

FROM dependencies AS migration
WORKDIR /app/server
CMD ["node","node_modules/prisma/build/index.js","migrate","deploy"]

FROM node:24-bookworm-slim AS web
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client ./
COPY shared /app/shared
ENV VITE_API_URL=/api
RUN npm run build

FROM node:24-bookworm-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=dependencies /app/server/node_modules/.prisma ./node_modules/.prisma
COPY --from=dependencies /app/server/src ./src
COPY --from=dependencies /app/server/scripts ./scripts
COPY --from=dependencies /app/server/assets ./assets
COPY --from=dependencies /app/shared /app/shared
COPY --from=web /app/client/dist /app/client/dist
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=7079 UPLOADS_DIR=/data/uploads
EXPOSE 7079
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:7079/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","src/index.js"]
