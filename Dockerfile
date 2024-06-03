FROM node:22-slim@sha256:3a17df2ede55682bccb79e45d71b5213295ce5eae25a0816877b0e548595de1b

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

# Cache of copy of the STAC JSON schemas by triggering a validation run
RUN node /app/index.js stac-validate https://nz-imagery.s3-ap-southeast-2.amazonaws.com/new-zealand/new-zealand_2020-2021_10m/rgb/2193/collection.json

ENTRYPOINT ["node", "/app/index.js"]
