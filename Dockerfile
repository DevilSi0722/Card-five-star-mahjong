FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM build AS web
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]

FROM dependencies AS realtime
WORKDIR /app
COPY . .
ENV NODE_ENV=production
ENV REALTIME_PORT=3101
EXPOSE 3101
CMD ["npm", "run", "realtime"]
