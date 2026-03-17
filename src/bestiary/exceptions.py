class TemplateNotFoundError(Exception):
    """Выбрасывается, когда шаблон существа не найден."""
    pass


class TemplatePermissionError(Exception):
    """Выбрасывается при попытке доступа к чужому шаблону."""
    pass


class ImageNotFoundError(Exception):
    """Выбрасывается, если изображение не существует."""
    pass
