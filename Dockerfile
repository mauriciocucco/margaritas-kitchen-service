FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

ENV PORT=3006

EXPOSE ${PORT}

CMD ["node", "dist/main"]