# Build stage
FROM oven/bun:1.2-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL
RUN bun run build

# Runtime stage — serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -q --spider http://localhost:3000 || exit 1
