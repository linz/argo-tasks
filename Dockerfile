FROM node:18-slim

WORKDIR /app

ENV NODE_ENV production

ADD package.json package-lock.json /app/
RUN npm install --omit=dev
ADD build/src /app/

ENTRYPOINT ["node", "/app/index.js"]
