FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY model-service/package.json model-service/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY model-service model-service
RUN npm run build -w model-service
ENV NODE_ENV=production
ENV REMOTE_MODEL_RUNTIME=true
ENV PORT=4100
EXPOSE 4100
CMD ["node", "model-service/dist/index.js"]
