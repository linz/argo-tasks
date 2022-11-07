FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV production

ADD package.json yarn.lock /app/
RUN yarn install --production
ADD build/src /app/

ENTRYPOINT ["node", "index.js"]
