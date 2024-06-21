# Use manifest digest for multi-platform support
FROM node:22-slim@sha256:54284c1aa369d17342e9b029339992695df9597829cc8313bd11008ec091699a

RUN apt-get update && apt-get install openssh-client git -y

WORKDIR /app

ARG GIT_VERSION
ENV GIT_VERSION ${GIT_VERSION}

ARG GIT_HASH=unknown
ENV GIT_HASH ${GIT_HASH}

RUN echo "GitInfo version:'${GIT_VERSION}' hash:'${GIT_HASH}'"

ENV NODE_ENV production

ADD package.json package-lock.json /app/
RUN npm install --omit=dev
ADD build/src /app/

ENTRYPOINT ["node", "/app/index.js"]
