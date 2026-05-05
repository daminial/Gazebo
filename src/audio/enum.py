from src.core.enum import GazeboEnum


class RepeatMode(GazeboEnum):
    NONE = "none"
    ONE = "one"
    ALL = "all"


class PlayerAction(GazeboEnum):
    PLAY = "play"
    PAUSE = "pause"
    STOP = "stop"
    NEXT = "next"
    PREV = "prev"
