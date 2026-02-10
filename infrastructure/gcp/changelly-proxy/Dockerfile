FROM node:20-alpine

WORKDIR /app

# Initialize minimal package.json
RUN npm init -y && \
    npm install express cors node-fetch body-parser dotenv

# Create proxy server
COPY server.js .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
