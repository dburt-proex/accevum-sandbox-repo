FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/worker/package*.json ./apps/worker/
COPY packages/db/package*.json ./packages/db/

RUN npm install

COPY . .

EXPOSE 3000
