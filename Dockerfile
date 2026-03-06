# -- Build stage --
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# -- Production stage --
FROM node:20-alpine AS production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# sharp requires native binaries; rebuild for the production image
RUN npm rebuild sharp

COPY --from=build /app/dist ./dist

# Create default volume mount point owned by appuser
RUN mkdir -p /data/images && chown appuser:appgroup /data/images

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER appuser
EXPOSE 3001

ENTRYPOINT ["docker-entrypoint.sh"]
