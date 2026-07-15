FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
COPY shared/package.json shared/

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
