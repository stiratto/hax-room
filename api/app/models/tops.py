from pydantic import BaseModel


class Tops(BaseModel):
    goals: str
    assists: str
    own_goals: str
