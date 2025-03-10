# Use Node.js 20 for ARM64 (aarch64)
FROM node:20

# Create and switch to the app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Install nodemon globally
RUN npm install -g nodemon

# Rebuild bcrypt for ARM64
RUN npm rebuild bcrypt --build-from-source

# Copy the rest of your backend code
COPY . .

# Expose port 5000 (Express default in your setup)
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
