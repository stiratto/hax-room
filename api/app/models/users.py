from sqlmodel import Field, SQLModel
from typing import Optional


class User(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    name: str
    password: str
    auth: Optional[str]
    isVip: Optional[bool] = Field(default=False)
    isNormalAdmin: Optional[bool] = Field(default=False)
    isSuperAdmin: Optional[bool] = Field(default=False)
    goals: Optional[int] = Field(default=0)
    loses: Optional[int] = Field(default=0)
    cs: Optional[int] = Field(default=0)
    assists: Optional[int] = Field(default=0)
    own_goals: Optional[int] = Field(default=0)
    wins: Optional[int] = Field(default=0)
