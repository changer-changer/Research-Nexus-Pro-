#!/bin/bash
# Start Research-Nexus Pro API with Cognee Integration

cd "$(dirname "$0")"

export PYTHONPATH="$(pwd):$PYTHONPATH"
export ENABLE_BACKEND_ACCESS_CONTROL="false"
export COGNEE_SKIP_CONNECTION_TEST="true"

# Optional: Set these in your environment or .env file
# export COGNEE_LLM_API_KEY="your-api-key"
# export COGNEE_LLM_ENDPOINT="https://api.kimi.com/coding"
# export COGNEE_LLM_MODEL="anthropic/k2p5"

echo "=========================================="
echo "Research-Nexus Pro + Cognee"
echo "=========================================="
echo ""
echo "Environment:"
echo "  PYTHONPATH: $PYTHONPATH"
echo "  Backend: $(pwd)"
echo ""

# Check if using integrated version
if [ "$1" == "--with-cognee" ]; then
    echo "Starting with Cognee integration..."
    python3 -c "
import sys
sys.path.insert(0, '.')
from app.api.main_local import create_app
from cognee_integration.integration import add_cognee_routes

app = create_app()
add_cognee_routes(app)

import uvicorn
uvicorn.run(app, host='0.0.0.0', port=8000, log_level='info')
"
else
    echo "Starting standard API (use --with-cognee for Cognee integration)..."
    python3 -m uvicorn app.api.main_local:app --host 0.0.0.0 --port 8000 --reload
fi
