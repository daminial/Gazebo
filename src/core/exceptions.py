from fastapi import HTTPException

class BaseAppException(HTTPException):
    """Базовый класс для всех исключений приложения"""
    def __init__(self, detail: str, status_code: int = 400):
        super().__init__(status_code=status_code, detail=detail)
