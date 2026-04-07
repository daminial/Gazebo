from fastapi import HTTPException, status


class AuthException(HTTPException):
    """Базовое исключение для аутентификации"""

    def __init__(
            self,
            status_code: int = status.HTTP_401_UNAUTHORIZED,
            detail: str = "Authentication failed",
            headers: dict = None
    ):
        if headers is None:
            headers = {"WWW-Authenticate": "Bearer"}
        super().__init__(status_code=status_code, detail=detail, headers=headers)


class InvalidCredentialsException(AuthException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль"
        )

class EmailAlreadyExistsException(AuthException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует"
        )


class UsernameAlreadyExistsException(AuthException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким именем уже существует"
        )


class TokenExpiredException(AuthException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Срок действия токена истёк"
        )


class InactiveUserException(AuthException):
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Учётная запись отключена"
        )
