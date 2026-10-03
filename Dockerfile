# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
RUN npm install -g pnpm@10.34.6
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG LIKHO_ENV=production
RUN pnpm build --mode ${LIKHO_ENV}

FROM nginx:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/mfe/library
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD ["wget", "-qO-", "http://127.0.0.1/healthz"]
