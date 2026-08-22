"""
FastAPI application entry point and static file serving.
"""

from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from deep_browser.config import settings
from deep_browser.server.routes import router
from deep_browser.server.ws import ws_manager

app = FastAPI(title="Deep-Browser Companion Server", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(router)


# WebSocket Hub for Extension and Workstation UI
@app.websocket("/ws")
@app.websocket("/ws/workstation")
@app.websocket("/ws/extension")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo or process incoming commands if necessary
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# Mount workspace screenshots for visual preview
screenshots_dir = settings.workspace_dir / "screenshots"
screenshots_dir.mkdir(parents=True, exist_ok=True)
app.mount("/screenshots", StaticFiles(directory=str(screenshots_dir)), name="screenshots")

# Mount Workstation Web UI static directory
web_dir = Path(__file__).parent.parent / "web"
web_dir.mkdir(parents=True, exist_ok=True)
app.mount("/", StaticFiles(directory=str(web_dir), html=True), name="web")
