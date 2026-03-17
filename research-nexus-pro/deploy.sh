#!/bin/bash
set -e

echo "=== Research-Nexus Pro Deployment ==="

# Option 1: Local deployment
deploy_local() {
    echo "Installing dependencies..."
    npm install
    
    echo "Building production bundle..."
    npm run build
    
    echo "Starting preview server..."
    npm run preview -- --port 3000
}

# Option 2: Docker deployment
deploy_docker() {
    echo "Building Docker image..."
    docker build -t research-nexus-pro:latest .
    
    echo "Running container on port 3000..."
    docker run -d -p 3000:80 --name nexus-pro research-nexus-pro:latest
    
    echo "Container started! Open http://localhost:3000"
}

case "${1:-local}" in
    local) deploy_local ;;
    docker) deploy_docker ;;
    *) echo "Usage: $0 [local|docker]"; exit 1 ;;
esac
