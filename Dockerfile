# Use official Node.js LTS image
FROM node:22-slim

# Create working directory owned by the non-root node user
RUN mkdir -p /app && chown node:node /app

# Install the minimal runtime libraries needed by VS Code/Electron in tests
RUN apt-get update && apt-get install -y \
	libasound2 \
	libgbm1 \
	libglib2.0-0 \
	libgtk-3-0 \
	libnspr4 \
	libnss3 \
	libx11-xcb1 \
	libxcomposite1 \
	libxdamage1 \
	libxrandr2 \
	xdg-utils \
	--no-install-recommends \
	&& rm -rf /var/lib/apt/lists/*

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
