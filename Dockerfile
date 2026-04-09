# Use official Node.js LTS image
FROM node:20-slim

# Create working directory owned by the non-root node user
RUN mkdir -p /app && chown node:node /app

# Set working directory
WORKDIR /app

# Switch to non-root user before any file operations
USER node

# Copy package files and install dependencies
COPY --chown=node:node package*.json ./
RUN npm ci --ignore-scripts

# Copy the rest of the source code
COPY --chown=node:node . .

# Build the extension
RUN npm run compile

# Default command (can be overridden)
CMD ["npm", "run", "test"]
