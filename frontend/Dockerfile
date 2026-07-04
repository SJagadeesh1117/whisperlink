# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies efficiently
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production Stage
FROM nginx:alpine

# Copy built artifacts from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy unified production Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Security/Optimization: Nginx alpine is already minimal.
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
