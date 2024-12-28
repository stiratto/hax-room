from sqlmodel import Session, SQLModel


# Crear una sesión de la base de datos
def get_db(engine):
    with Session(engine) as session:
        yield session


def create_db_and_tables(engine):
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


def verify_password(plain_password, hashed_password, pwd_context):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password, pwd_context):
    return pwd_context.hash(password)
