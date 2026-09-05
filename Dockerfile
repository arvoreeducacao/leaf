ARG PREVIOUS_IMAGE=build

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

FROM ${PREVIOUS_IMAGE} AS previous

FROM node:22-alpine
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=build /app ./
COPY --from=previous /app/.next/static ./.next/static-previous
RUN find .next/static -type f -exec touch {} + \
  && cd .next/static-previous \
  && find . -type f | while read -r file; do \
       [ -e "../static/$file" ] || { mkdir -p "../static/${file%/*}"; cp -p "$file" "../static/$file"; }; \
     done \
  && cd /app \
  && rm -rf .next/static-previous \
  && find .next/static -type f -mtime +2 -exec rm -f {} +
EXPOSE 3000
CMD ["pnpm", "start"]
