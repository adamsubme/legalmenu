# Mission Control - dla integracji z OpenClaw na serwerze
# Build: docker build -t mission-control:local .
# Run: docker run -p 3000:3000 -e OPENCLAW_GATEWAY_URL=... mission-control:local

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npm run db:seed 2>/dev/null || true && npm start"]
