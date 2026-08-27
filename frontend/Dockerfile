FROM node:22-alpine AS build

WORKDIR /app

# Declare build-time arguments for NEXT_PUBLIC_ variables
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Make them available to `npm run build` (Next.js inlines them at build time)
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy standalone server output
COPY --from=build /app/.next/standalone ./
# Copy static assets
COPY --from=build /app/.next/static ./.next/static
# Copy public assets
COPY --from=build /app/public ./public

# Cloud Run injects PORT at runtime
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]