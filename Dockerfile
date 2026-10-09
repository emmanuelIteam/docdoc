# Runtime for the personal projects outliner (Node + Express + htmx).
# No build step: the app renders HTML server-side and serves vendored static assets.

FROM node:22-alpine

# Application working directory.
WORKDIR /app

# Install only production dependencies from the lockfile for a clean layer.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Application code and static assets.
COPY server.js storage.js env.js accounts.js otp.js mailer.js passkeys.js authpages.js authroutes.js migration.js ./
COPY public ./public
COPY scripts ./scripts

# Persistent data directory, writable by the non-root node user so the
# mounted volume at /app/data stays writable at runtime.
RUN mkdir -p /app/data && chown node:node /app/data

ENV NODE_ENV=production
EXPOSE 3000

# Run as the non-root node user.
USER node

CMD ["node", "server.js"]
