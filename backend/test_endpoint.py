import asyncio
from app.database.local_graph import LocalGraphDB
from app.api.v3_graph_routes import generate_node_description

async def main():
    db = LocalGraphDB()
    try:
        res = await generate_node_description("prob_5ca3a538", db)
        print(res)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())
