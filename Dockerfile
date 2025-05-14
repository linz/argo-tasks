FROM node:24-slim@sha256:f403f3b5054f8f35ebe8dd167e0c608945a8fd992f3d278d2a8652b58b80dc92

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
