from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    db_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: str = "120"

    class Config:
        env_file = ".env"

