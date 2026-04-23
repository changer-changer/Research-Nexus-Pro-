#!/bin/bash
# Start Research-Nexus Pro API with Cognee Integration

cd "$(dirname "$0")"

export PYTHONPATH="$(pwd):$PYTHONPATH"
export ENABLE_BACKEND_ACCESS_CONTROL="false"
export COGNEE_SKIP_CONNECTION_TEST="true"

echo "=========================================="
echo "Research-Nexus Pro + Cognee"
echo "=========================================="
echo ""
echo "Environment:"
echo "  PYTHONPATH: $PYTHONPATH"
echo "  Backend: $(pwd)"
echo ""

if [ "$1" == "--with-cognee" ]; then
    echo "Starting with Cognee integration..."
    python3 << 'EOF'
import sys
sys.path.insert(0, '.')
from app.api.main_local import create_app
from cognee_integration.integration import add_cognee_routes

app = create_app()
add_cognee_routes(app)

import uvicorn
uvicorn.run(app, host='0.0.0.0', port=8000, log_level='info')
EOF
else
    echo "Starting standard API (use --with-cognee for Cognee integration)..."
    python3 -m uvicorn app.api.main_local:app --host 0.0.0.0 --port 8000 --reload
fi
