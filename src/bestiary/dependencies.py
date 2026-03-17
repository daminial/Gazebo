import json
from typing import Type, TypeVar
from fastapi import Form, HTTPException
from pydantic import BaseModel, ValidationError

ModelType = TypeVar("ModelType", bound=BaseModel)

def json_form(model: Type[ModelType]):
    async def parser(json_str: str = Form(...)):
        try:
            data = json.loads(json_str)
            return model.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as e:
            raise HTTPException(status_code=422, detail=str(e))
    return parser
