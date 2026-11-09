FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm audit --omit=dev --audit-level=high
COPY . .
ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm","start"]
