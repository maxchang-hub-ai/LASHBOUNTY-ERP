FROM node:22-alpine
ENV NODE_ENV=production PORT=8080 DATA_DIR=/app/data APP_TZ=Asia/Jakarta
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY scripts ./scripts
COPY public ./public
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 8080
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "server/index.js"]
