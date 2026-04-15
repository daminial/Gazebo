from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.auth.router import router as auth_router
from src.rooms.router import router as rooms_router
from src.bestiary.router import router as bestiary_router
from src.map.router import router as map_router
from src.core.storage.test import router as media_router

app = FastAPI(title="Gazebo API", redirect_slashes=False)

# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.109:3000",
        "http://10.185.129.181:3000",       
        "https://localhost:3000",
        "https://127.0.0.1:3000",
        "https://192.168.0.109:3000",
        "https://10.185.129.181:3000",         
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(rooms_router)
app.include_router(bestiary_router)
app.include_router(map_router)
app.include_router(media_router)


@app.get("/")
async def root():
    return {"message": "Gazebo API"}


@app.get("/health")
async def health():
    return {"status": "ok"}
