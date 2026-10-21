# Build from the repo root: docker build -f api/Dockerfile .
# The API imports the shared engine, so the build needs the whole repo as context.
FROM node:22-slim
WORKDIR /srv
COPY engine engine
COPY config config
COPY evidence evidence
COPY data data
COPY api/package.json api/package-lock.json api/
RUN cd api && npm ci --omit=dev
COPY api/src api/src
WORKDIR /srv/api
ENV NODE_ENV=production
CMD ["node", "src/server.ts"]
