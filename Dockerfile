FROM node:18-slim@sha256:caea82ddba051b3f8157bf6d12c732d6f232b56af0dcefd4b51d8d9f5196e9dd

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
