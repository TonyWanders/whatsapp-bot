FROM node:20
RUN apt-get update && apt-get install -y chromium libnss3 libxss1 libasound2 libatk-bridge2.0-0 libgtk-3-0
WORKDIR /app
COPY WhatsAppBot-UploadReady/backend/package*.json ./WhatsAppBot-UploadReady/backend/
RUN cd WhatsAppBot-UploadReady/backend && npm install
COPY . .
WORKDIR /app/WhatsAppBot-UploadReady/backend
CMD ["node", "server.js"]
