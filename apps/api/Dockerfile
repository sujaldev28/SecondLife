FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=packages/shared --workspace=apps/api
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm --workspace=packages/shared run build && npm --workspace=apps/api run build
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
