FROM node:18-slim

RUN apt-get update && apt-get install openssh-client git -y

WORKDIR /app

ENV NODE_ENV production

ADD package.json package-lock.json /app/
RUN npm install --omit=dev
ADD build/src /app/

ENTRYPOINT ["node", "/app/index.js"]
