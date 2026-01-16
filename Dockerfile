# Use lightweight Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first (better caching)
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy application source
COPY . .

# Expose port used by On-Demand / serverless
EXPOSE 3000

# Start the service
CMD ["node", "index.js"]
