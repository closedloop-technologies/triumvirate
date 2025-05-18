# Use official Node.js 20 image
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install dependencies first for caching
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy the rest of the source
COPY . .

# Build TypeScript for production use
RUN npm run build

# Default to an interactive shell for development
CMD ["bash"]
