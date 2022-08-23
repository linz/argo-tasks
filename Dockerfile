FROM node:18-alpine

ADD dist/index.cjs /app/index.cjs

ENTRYPOINT ["node", "/app/index.cjs"]