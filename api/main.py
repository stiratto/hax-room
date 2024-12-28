from app.helpers.helpers import (
    create_db_and_tables,
    get_password_hash,
    verify_password,
)
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from sqlmodel import Session, create_engine, select
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from app.models.users import User
from app.models.quantity import Quantity
from app.models.tops import Tops
from app.models.connection_manager import ConnectionManager
from passlib.context import CryptContext
from typing import List
import os
import json


db_url = os.getenv("HAXROOM_DB_URL")
SECRET_KEY = os.getenv("HAX_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

engine = create_engine(f"{db_url}", echo=True)

manager = ConnectionManager()


async def handleMessage(message: dict, websocket: WebSocket):
    if message["type"] == "register_user":
        user_data = User(**message["user"])
        register(user_data)

    if message["type"] == "update_player_data":
        user_data = User(**message["user"])
        quantity = Quantity(**message["quantity"])
        update_player_data(user_data, quantity)

    if message["type"] == "player_stats":
        try:
            user = User(**message["user"])
            results = get_user_stats(user)
            if isinstance(results, dict):
                await websocket.send_json(
                    {
                        "type": "player_stats",
                        "success": True,
                        "data": results,
                    },
                )
            elif isinstance(results, int):
                await websocket.send_json(
                    {
                        "type": "player_stats",
                        "success": False,
                        "detail": "La cuenta no esta registrada, utiliza !register (contrasena)",
                        "data": results,
                    },
                )

        except Exception as e:
            print(e)

    if message["type"] == "update_top":
        tops_to_update = message["tops"]
        results = await update_top(tops_to_update)
        if results:
            await websocket.send_json(
                {"type": "update_top", "success": True, "data": results},
            )
        else:
            await websocket.send_json(
                {
                    "type": "update_top",
                    "success": False,
                    "detail": "No se pudo obtener el top.",
                    "data": results,
                },
            )


def get_user_stats(user: User):
    with Session(engine) as session:
        try:
            statement = select(User).where(User.name == user.name)
            result = session.exec(statement).first()
            if result:
                data = result.model_dump()
                return data
            else:
                return user.id
        except Exception as e:
            print(e)


@app.get("/users/")
def getUsers():
    with Session(engine) as session:
        statement = select(User)
        results = session.exec(statement)
        return results.all()


@app.post("/register/")
def register(user: User):
    with Session(engine) as session:
        hashed_password = get_password_hash(user.password, pwd_context)
        user = User(name=user.name, password=hashed_password, auth=user.auth)
        session.add(user)
        session.commit()
        session.refresh(user)
        return {"id": user.id, "username": user.name}


def update_player_data(user: User, quantity: Quantity):
    with Session(engine) as session:
        print(User.name, user.name)
        statement = select(User).where(User.auth == user.auth)

        results = session.exec(statement)
        player = results.first()

        if player:
            for field, value in quantity.model_dump().items():
                setattr(player, field, (getattr(player, field, 0) or 0) + value)
            session.add(player)
            session.commit()
            session.refresh(player)
        else:
            raise HTTPException(status_code=404, detail="Player not found")


async def update_top(tops_to_update: List[str]):
    results = []
    with Session(engine) as session:
        for top in tops_to_update:
            column = getattr(User, top, None)
            if not column:
                raise HTTPException(status_code=400, detail=f"Invalid top: {top}")

            statement = select(column, User.name).order_by(column.desc()).limit(10)
            query_results = session.exec(statement).all()

            formatted_results = [
                {"name": result[1], "value": getattr(result, top)}
                for result in query_results
            ]

            results.append({top: formatted_results})

    if results:
        return results
    else:
        return None


def login(user: User):
    with Session(engine) as session:
        # Verify the passwords
        statement = select(User).where(User.name == user.name)
        userExists = session.exec(statement).first()
        if userExists:
            password = verify_password(user.password, userExists.password, engine)
            return password


def main():
    create_db_and_tables(engine)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            print(message)
            await handleMessage(message, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(e)


if __name__ == "__main__":
    main()
