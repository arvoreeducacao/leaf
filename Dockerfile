FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG LEAF_BUILD_ID
COPY . .
ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"
ENV LEAF_BUILD_ID=$LEAF_BUILD_ID
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["pnpm", "start"]
