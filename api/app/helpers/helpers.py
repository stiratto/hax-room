from sqlmodel import Session, SQLModel


class Helpers:
    # Crear una sesión de la base de datos
    def get_db(self, engine):
        with Session(engine) as session:
            yield session

    def create_db_and_tables(self, engine):
        SQLModel.metadata.drop_all(engine)
        SQLModel.metadata.create_all(engine)

    def verify_password(self, plain_password, hashed_password, pwd_context):
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password, pwd_context):
        return pwd_context.hash(password)
