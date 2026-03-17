from src.core.enum import GazeboEnum

class RoomStatus(GazeboEnum):
    "Статусы игровой комнаты"
    IN_GAME = "in_game"
    PAUSED = "paused"

class RoomRole(GazeboEnum):
    "Роли внутри комнаты"
    DM = "dm"
    PLAYER = "player"
    SPECTATOR = "spectator"
