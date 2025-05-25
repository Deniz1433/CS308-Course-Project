# Base stage: install dependencies and copy all source code
FROM node:20 AS base
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

# Production build stage: build the React app for production
FROM base AS build
RUN npm run build

# Production stage: serve the built app using Nginx with your custom configuration
FROM nginx:alpine AS prod

# 1) Copy in your built bundle
COPY --from=build /usr/src/app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 2) Copy & enable the startup script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

# 3) Use entrypoint to patch the JS and then launch nginx
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

# Development stage: run the React development server (hot reloading enabled)
FROM node:20 AS dev
WORKDIR /usr/src/app
# For development, we install dependencies and copy source code (alternatively, you can bind mount your source)
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
