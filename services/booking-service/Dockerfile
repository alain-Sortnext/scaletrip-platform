# Multi-stage Dockerfile — production stage is MISSING (SCLT TODO)
# Only development stage is implemented

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS development
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

# TODO: Add production stage before go-live
# FROM base AS production
# RUN npm ci --only=production
# COPY --from=development /app/dist ./dist
# RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# USER appuser
# CMD ["node", "dist/index.js"]
