class TemplateNotFoundError(Exception):
    def __init__(self, template_id: int, message: str = "Шаблон не найден"):
        self.template_id = template_id
        self.message = f"{message}: {template_id}"
        super().__init__(self.message)

class TemplatePermissionError(Exception):
    pass

class ImageNotFoundError(Exception):
    pass