# Stage 1: Build
FROM node:20-alpine3.20 as build

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy package.json and yarn.lock files
COPY package.json yarn.lock ./

# Install dependencies using Yarn
RUN yarn install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the application
RUN yarn build

# Run tsc-alias to resolve paths
RUN yarn tsc-alias

# Stage 2: Production
FROM node:20-alpine3.20

# Create and change to the app directory
WORKDIR /usr/src/app

# Install curl for health checks
RUN apk add --no-cache curl

# Install PM2 globally
RUN yarn global add pm2

# Copy the built application from the build stage
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/yarn.lock ./yarn.lock
COPY --from=build /usr/src/app/ecosystem.config.js ./ecosystem.config.js
COPY --from=build /usr/src/app/swagger.yml ./swagger.yml

# Install only production dependencies
RUN yarn install --production --frozen-lockfile && yarn cache clean

ENV PORT=80

# Expose the port the app will run on
EXPOSE 80

# Add a health check for the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost/health || exit 1

# Start the application using PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
