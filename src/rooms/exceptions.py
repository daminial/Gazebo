from src.core.exceptions import BaseAppException

class RoomNotFoundError(BaseAppException):
    def __init__(self, detail: str = "Комната не найдена"):
        super().__init__(detail=detail, status_code=404)

class RoomPermissionError(BaseAppException):
    def __init__(self, detail: str = "Недостаточно прав"):
        super().__init__(detail=detail, status_code=403)

class RoomAccessError(BaseAppException):
    def __init__(self, detail: str = "Вы не в этой комнате"):
        super().__init__(detail=detail, status_code=403)
