FROM node:23-slim@sha256:b89d748ea010f4d276c9d45c750fa5f371cef3fcc7486f739f07e5aad1b998a8

RUN apt-get update && apt-get install openssh-client git -y

WORKDIR /app

ARG GIT_VERSION
ENV GIT_VERSION=${GIT_VERSION}

ARG GIT_HASH=unknown
ENV GIT_HASH=${GIT_HASH}

RUN echo "GitInfo version:'${GIT_VERSION}' hash:'${GIT_HASH}'"

ENV NODE_ENV=production

COPY package.json package-lock.json /app/
RUN npm install --omit=dev
COPY src /app/

# Cache of copy of the STAC JSON schemas by triggering a validation run
RUN node /app/index.ts stac-validate https://nz-imagery.s3-ap-southeast-2.amazonaws.com/new-zealand/new-zealand_2020-2021_10m/rgb/2193/collection.json

ENTRYPOINT ["node", "/app/index.ts"]
