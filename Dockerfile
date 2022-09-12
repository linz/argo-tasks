FROM node:18-alpine

WORKDIR /app
ADD dist/index.cjs /app/index.cjs

ENTRYPOINT ["node", "index.cjs"]
