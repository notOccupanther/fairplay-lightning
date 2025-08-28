#!/bin/bash

# FairPlay Platform - Full Stack Startup Script
# This script starts both the Next.js frontend and Express backend

echo "🚀 Starting FairPlay Platform - Full Stack Mode"
echo "================================================"

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found!"
    echo "Please create .env.local with your environment variables"
    exit 1
fi

# Load environment variables
echo "📋 Loading environment variables..."
export $(cat .env.local | xargs)

# Check if Stripe keys are set
if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo "⚠️  Warning: STRIPE_SECRET_KEY not set - Stripe donations will fail"
else
    echo "✅ Stripe integration enabled"
fi

# Check if Lightning keys are set
if [ -z "$MUTINY_API_KEY" ]; then
    echo "⚠️  Warning: Lightning Network keys not set - Lightning donations will fail"
else
    echo "⚡ Lightning Network integration enabled"
fi

echo ""

# Start Express backend server in background
echo "🔧 Starting Express backend server (port 3001)..."
nohup node server.js > server.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend is running
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend server started successfully (PID: $BACKEND_PID)"
else
    echo "❌ Backend server failed to start"
    echo "Check server.log for details"
    exit 1
fi

echo ""

# Start Next.js frontend
echo "🎨 Starting Next.js frontend (port 3006)..."
echo "🌐 Frontend will be available at: http://localhost:3006"
echo "💳 Backend API available at: http://localhost:3001"
echo ""

# Start frontend (this will block)
npm run dev -- --port 3006

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    
    # Kill backend server
    if [ ! -z "$BACKEND_PID" ]; then
        echo "🔧 Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null
    fi
    
    echo "✅ All servers stopped"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Keep script running
wait
