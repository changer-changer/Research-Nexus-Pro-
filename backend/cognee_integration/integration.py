"""
Integration module for adding Cognee routes to main_local.py

Usage:
    from cognee_integration.integration import add_cognee_routes
    add_cognee_routes(app)
"""

import logging

logger = logging.getLogger(__name__)


def add_cognee_routes(app):
    """
    Add Cognee routes to the FastAPI application.
    
    Args:
        app: FastAPI application instance
    """
    try:
        from .routers import router as cognee_router
        
        app.include_router(
            cognee_router,
            prefix="/api",
            tags=["cognee"]
        )
        
        logger.info("✅ Cognee routes added successfully")
        
        # Add Cognee info to root endpoint
        @app.get("/cognee-info")
        async def cognee_info():
            """Get Cognee integration information."""
            return {
                "integration": "cognee",
                "version": "1.0.0",
                "endpoints": {
                    "process_paper": "/api/cognee/papers",
                    "batch_process": "/api/cognee/papers/batch",
                    "search": "/api/cognee/search",
                    "stats": "/api/cognee/stats",
                    "export": "/api/cognee/export/reactflow"
                }
            }
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to add Cognee routes: {e}")
        return False


def patch_main_local():
    """
    Create a patched version of main_local.py with Cognee integration.
    
    This creates a new file main_local_cognee.py with the integration.
    """
    import os
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    main_local_path = os.path.join(base_dir, "app", "api", "main_local.py")
    patched_path = os.path.join(base_dir, "app", "api", "main_local_cognee.py")
    
    if not os.path.exists(main_local_path):
        logger.error(f"main_local.py not found at {main_local_path}")
        return False
    
    with open(main_local_path, "r") as f:
        content = f.read()
    
    # Add import and route inclusion
    import_line = "\n# Cognee Integration\nfrom cognee_integration.integration import add_cognee_routes\n"
    
    # Find the line with "app.include_router(router, prefix="/api")"
    # and add our integration after it
    marker = 'app.include_router(router, prefix="/api")'
    if marker in content:
        content = content.replace(
            marker,
            f'''{marker}
    
    # Add Cognee integration routes
    add_cognee_routes(app)
'''
        )
        
        # Add import at the top
        import_section = content.find("from fastapi import")
        if import_section != -1:
            content = content[:import_section] + import_line + content[import_section:]
        
        with open(patched_path, "w") as f:
            f.write(content)
        
        logger.info(f"Patched main_local.py written to {patched_path}")
        return True
    else:
        logger.error("Could not find marker in main_local.py")
        return False


if __name__ == "__main__":
    # Test the patch
    patch_main_local()
