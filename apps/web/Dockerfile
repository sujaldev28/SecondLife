FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=packages/shared --workspace=apps/web
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN npm --workspace=packages/shared run build && npm --workspace=apps/web run build
EXPOSE 3000
CMD ["npm", "--workspace=apps/web", "run", "start"]
