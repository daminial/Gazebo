from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.auth.router import router as auth_router
from src.rooms.router import router as rooms_router
from src.bestiary.router import router as bestiary_router
from src.map.router import router as map_router
from src.core.storage.router import router as media_router
from src.audio.router import router as audio_router
from src.map_editor.router import router as map_editor_router
from src.core.config import settings

app = FastAPI(title="Gazebo API", redirect_slashes=False)

# CORS для фронтенда
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(rooms_router, prefix="/api")
app.include_router(bestiary_router, prefix="/api")
app.include_router(map_router, prefix="/api")
app.include_router(map_editor_router, prefix="/api")
app.include_router(media_router, prefix="/api")
app.include_router(audio_router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Gazebo API"}


@app.get("/health")
async def health():
    return {"status": "ok"}
