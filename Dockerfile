FROM node:18-slim

WORKDIR /app

ENV NODE_ENV production

ADD package.json yarn.lock /app/
RUN yarn install --production

# Git Hash/Version have no impact on Yarn install
ARG GIT_VERSION
ARG GIT_HASH

ENV GIT_VERSION ${GIT_VERSION}
ENV GIT_HASH ${GIT_HASH}

ADD build/src /app/

ENTRYPOINT ["node", "/app/index.js"]
