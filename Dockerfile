FROM node:18-slim

RUN apt-get update && apt-get install openssh-client git -y

WORKDIR /app

ENV NODE_ENV production

ADD package.json yarn.lock /app/
RUN yarn install --production
ADD build/src /app/

ENTRYPOINT ["node", "/app/index.js"]
