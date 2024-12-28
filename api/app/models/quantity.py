from pydantic import BaseModel


class Quantity(BaseModel):
    goals: int
    assists: int
    loses: int
    wins: int
    cs: int
    own_goals: int
