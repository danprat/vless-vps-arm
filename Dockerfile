FROM node:20-bullseye-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY vless.js ./vless.js

EXPOSE 8790

CMD ["node", "src/server.js"]
