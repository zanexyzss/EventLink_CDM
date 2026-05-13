---
name: backend
agent: BACKEND_AGENT
language: Python 3.11+
framework: FastAPI + uvicorn
role: Complete REST API — routes, business logic, middleware, services
runs: STEP 4 (parallel with EMAIL_AGENT, CERTIFICATE_AGENT, QR_AGENT)
depends_on: DATABASE_AGENT, AUTH_AGENT
---

# BACKEND AGENT — EVENTLINK CDM (Python / FastAPI)

You write the **complete Python FastAPI backend**. Every route must be fully implemented — no stubs, no `pass`, no `# TODO`. The frontend at `http://localhost:5173` talks to this server at `http://localhost:8000/api`.

---

## PYTHON PROJECT STRUCTURE

```
backend/
├── requirements.txt
├── .env                        ← copied from .env.example by user
├── app/
│   ├── __init__.py
│   ├── main.py                 ← FastAPI app entry, router mounts, CORS
│   ├── config.py               ← Settings via pydantic-settings
│   ├── database.py             ← SQLite async engine, session factory
│   ├── models.py               ← SQLAlchemy table definitions
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── events.py
│   │   ├── registrations.py
│   │   ├── attendance.py
│   │   ├── certificates.py
│   │   ├── users.py
│   │   └── reports.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── events.py
│   │   ├── registrations.py
│   │   ├── attendance.py
│   │   ├── certificates.py
│   │   ├── users.py
│   │   ├── reports.py
│   │   └── settings.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── email_service.py
│   │   ├── certificate_service.py
│   │   └── qr_service.py
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── auth.py             ← JWT dependency injection
│   └── utils/
│       ├── __init__.py
│       └── helpers.py
```

---

## `requirements.txt`

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
aiosqlite==0.20.0
SQLAlchemy==2.0.29
pydantic==2.7.0
pydantic-settings==2.2.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
python-dotenv==1.0.1
aiosmtplib==3.0.1
jinja2==3.1.3
qrcode[pil]==7.4.2
Pillow==10.3.0
weasyprint==61.2
reportlab==4.1.0
aiofiles==23.2.1
httpx==0.27.0
```

---

## `app/config.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # App
    APP_NAME: str = "EVENTLINK CDM"
    INSTITUTION_NAME: str = "CDM"
    NODE_ENV: str = "development"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./eventlink.db"

    # Auth
    JWT_SECRET: str = "change-this-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_DAYS: int = 7

    # Email
    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USER: str = ""
    EMAIL_PASS: str = ""
    EMAIL_FROM: str = "EVENTLINK CDM <no-reply@eventlink.cdm>"

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    ASSETS_DIR: Path = BASE_DIR / "assets"
    CERT_DIR: Path = ASSETS_DIR / "certificates"
    QR_DIR: Path = ASSETS_DIR / "qrcodes"
    UPLOADS_DIR: Path = ASSETS_DIR / "uploads"

    def model_post_init(self, __context):
        # Ensure asset directories exist
        for d in [self.CERT_DIR, self.QR_DIR, self.UPLOADS_DIR]:
            d.mkdir(parents=True, exist_ok=True)

settings = Settings()
```

---

## `app/database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.NODE_ENV == "development",
    connect_args={"check_same_thread": False}
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    """Create all tables and seed defaults."""
    from app.models import Base
    from app.services.auth_service import hash_password
    from sqlalchemy import select, insert
    from app.models import User, Setting

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("PRAGMA foreign_keys = ON"))

    # Seed default admin
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.email == "admin@gmail.com")
        )
        if not result.scalar_one_or_none():
            session.add(User(
                student_id="ADMIN-001",
                full_name="Admin",
                email="admin@gmail.com",
                password_hash=hash_password("Admin@1234"),
                role="admin"
            ))

        # Seed default settings
        defaults = {
            "app_name": "EVENTLINK CDM",
            "institution_name": "CDM",
            "email_configured": "0",
            "certificate_template": "default"
        }
        for key, value in defaults.items():
            exists = await session.execute(select(Setting).where(Setting.key == key))
            if not exists.scalar_one_or_none():
                session.add(Setting(key=key, value=value))

        await session.commit()
```

---

## `app/models.py`

```python
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Text,
    CheckConstraint, UniqueConstraint, func
)
from sqlalchemy.orm import DeclarativeBase, relationship

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String, unique=True, nullable=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="student")
    department = Column(String, nullable=True)
    year_level = Column(Integer, nullable=True)
    profile_photo = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    __table_args__ = (
        CheckConstraint("role IN ('admin','organizer','student')", name="ck_user_role"),
    )

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String, nullable=True)
    venue = Column(String, nullable=True)
    event_date = Column(DateTime, nullable=False)
    registration_deadline = Column(DateTime, nullable=True)
    max_slots = Column(Integer, nullable=True)
    status = Column(String, default="draft")
    organizer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    event_code = Column(String, unique=True, nullable=True)
    banner_path = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    __table_args__ = (
        CheckConstraint("status IN ('draft','open','closed','completed')", name="ck_event_status"),
    )

class Registration(Base):
    __tablename__ = "registrations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    registered_at = Column(DateTime, server_default=func.now())
    status = Column(String, default="confirmed")
    qr_code_path = Column(String, nullable=True)
    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_registration"),
        CheckConstraint("status IN ('pending','confirmed','cancelled')", name="ck_reg_status"),
    )

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    checked_in_at = Column(DateTime, server_default=func.now())
    method = Column(String, default="manual")
    __table_args__ = (
        UniqueConstraint("event_id", "user_id", name="uq_attendance"),
        CheckConstraint("method IN ('qr','manual')", name="ck_att_method"),
    )

class Certificate(Base):
    __tablename__ = "certificates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    generated_at = Column(DateTime, server_default=func.now())
    file_path = Column(String, nullable=True)
    sent_via_email = Column(Integer, default=0)

class EmailLog(Base):
    __tablename__ = "email_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    recipient_email = Column(String)
    subject = Column(String)
    type = Column(String)
    sent_at = Column(DateTime, server_default=func.now())
    status = Column(String, default="sent")

class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(String)
```

---

## `app/schemas/` — PYDANTIC MODELS

### `app/schemas/auth.py`

```python
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    student_id: Optional[str] = None
    department: Optional[str] = None
    year_level: Optional[int] = None

class UserOut(BaseModel):
    id: int
    student_id: Optional[str]
    full_name: str
    email: str
    role: str
    department: Optional[str]
    year_level: Optional[int]
    created_at: Optional[datetime]
    model_config = {"from_attributes": True}

class TokenResponse(BaseModel):
    token: str
    user: UserOut
```

### `app/schemas/events.py`

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: Optional[str] = None
    venue: Optional[str] = None
    event_date: datetime
    registration_deadline: Optional[datetime] = None
    max_slots: Optional[int] = None
    publish: bool = False           # if True, set status to 'open' immediately

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    venue: Optional[str] = None
    event_date: Optional[datetime] = None
    registration_deadline: Optional[datetime] = None
    max_slots: Optional[int] = None

class EventOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    event_type: Optional[str]
    venue: Optional[str]
    event_date: datetime
    registration_deadline: Optional[datetime]
    max_slots: Optional[int]
    status: str
    organizer_id: Optional[int]
    event_code: Optional[str]
    banner_path: Optional[str]
    created_at: Optional[datetime]
    registration_count: Optional[int] = 0
    model_config = {"from_attributes": True}
```

### `app/schemas/registrations.py`

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class RegistrationOut(BaseModel):
    id: int
    event_id: int
    user_id: int
    registered_at: datetime
    status: str
    qr_code_path: Optional[str]
    model_config = {"from_attributes": True}
```

### `app/schemas/attendance.py`

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AttendanceMarkRequest(BaseModel):
    user_id: int
    method: str = "manual"   # 'qr' or 'manual'

class AttendanceOut(BaseModel):
    id: int
    event_id: int
    user_id: int
    checked_in_at: datetime
    method: str
    model_config = {"from_attributes": True}
```

---

## `app/middleware/auth.py` — JWT Dependency

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.config import settings
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User

bearer_scheme = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"}
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: int = payload.get("id")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

def require_roles(*roles: str):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {' or '.join(roles)}"
            )
        return current_user
    return role_checker

# Convenience dependencies
require_admin = require_roles("admin")
require_organizer = require_roles("admin", "organizer")
require_any = require_roles("admin", "organizer", "student")
```

---

## `app/services/auth_service.py`

```python
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta, timezone
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRES_DAYS)
    payload = {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "full_name": user.full_name,
        "exp": expire
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
```

---

## `app/routers/auth.py`

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services.auth_service import verify_password, hash_password, create_access_token
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(user)
    return TokenResponse(token=token, user=UserOut.model_validate(user))

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = User(
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.password),
        student_id=body.student_id,
        department=body.department,
        year_level=body.year_level,
        role="student"
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token(user)
    return TokenResponse(token=token, user=UserOut.model_validate(user))

@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
```

---

## `app/routers/events.py`

```python
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
import time

from app.database import get_db
from app.models import User, Event, Registration
from app.schemas.events import EventCreate, EventUpdate, EventOut
from app.middleware.auth import get_current_user, require_organizer, require_any
from app.services.email_service import bulk_send_announcement

router = APIRouter(prefix="/events", tags=["events"])

def generate_event_code() -> str:
    return f"EVT-{int(time.time())}"

@router.get("", response_model=dict)
async def list_events(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any)
):
    query = select(Event)

    # Students only see open events
    if current_user.role == "student":
        query = query.where(Event.status == "open")
    elif status:
        query = query.where(Event.status == status)

    if search:
        query = query.where(Event.title.ilike(f"%{search}%"))
    if event_type:
        query = query.where(Event.event_type == event_type)

    # Count registrations per event
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    result = await db.execute(query.order_by(Event.event_date.asc()).limit(limit).offset(offset))
    events = result.scalars().all()

    # Attach registration counts
    event_list = []
    for e in events:
        count_result = await db.execute(
            select(func.count()).select_from(Registration).where(
                and_(Registration.event_id == e.id, Registration.status == "confirmed")
            )
        )
        event_out = EventOut.model_validate(e)
        event_out.registration_count = count_result.scalar()
        event_list.append(event_out)

    return {"data": event_list, "total": total}

@router.post("", response_model=EventOut, status_code=201)
async def create_event(
    body: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_organizer)
):
    event = Event(
        title=body.title,
        description=body.description,
        event_type=body.event_type,
        venue=body.venue,
        event_date=body.event_date,
        registration_deadline=body.registration_deadline,
        max_slots=body.max_slots,
        organizer_id=current_user.id,
        event_code=generate_event_code(),
        status="open" if body.publish else "draft"
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return EventOut.model_validate(event)

@router.get("/{event_id}", response_model=EventOut)
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any)
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    count = await db.execute(
        select(func.count()).select_from(Registration).where(
            and_(Registration.event_id == event_id, Registration.status == "confirmed")
        )
    )
    out = EventOut.model_validate(event)
    out.registration_count = count.scalar()
    return out

@router.put("/{event_id}", response_model=EventOut)
async def update_event(
    event_id: int,
    body: EventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_organizer)
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if current_user.role != "admin" and event.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit another organizer's event")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    await db.commit()
    await db.refresh(event)
    return EventOut.model_validate(event)

@router.post("/{event_id}/open")
async def open_event(
    event_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_organizer)
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = "open"
    await db.commit()

    # Announce to all students in background
    students_result = await db.execute(select(User).where(User.role == "student"))
    students = students_result.scalars().all()
    background_tasks.add_task(bulk_send_announcement, students, event)

    return {"message": "Event opened and announcement sending in background"}

@router.post("/{event_id}/close")
async def close_event(event_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_organizer)):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = "closed"
    await db.commit()
    return {"message": "Event closed"}

@router.post("/{event_id}/complete")
async def complete_event(event_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_organizer)):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = "completed"
    await db.commit()
    return {"message": "Event marked as completed"}
```

---

## `app/routers/registrations.py`

```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timezone

from app.database import get_db
from app.models import User, Event, Registration
from app.schemas.registrations import RegistrationOut
from app.middleware.auth import get_current_user, require_organizer, require_any
from app.services.qr_service import generate_registration_qr
from app.services.email_service import send_registration_confirmation

router = APIRouter(tags=["registrations"])

@router.get("/events/{event_id}/registrations")
async def list_registrations(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_organizer)
):
    result = await db.execute(
        select(Registration, User)
        .join(User, Registration.user_id == User.id)
        .where(Registration.event_id == event_id)
        .order_by(Registration.registered_at.asc())
    )
    rows = result.all()
    data = []
    for reg, user in rows:
        data.append({
            "id": reg.id,
            "event_id": reg.event_id,
            "user_id": reg.user_id,
            "status": reg.status,
            "registered_at": reg.registered_at,
            "qr_code_path": reg.qr_code_path,
            "student_name": user.full_name,
            "student_id": user.student_id,
            "email": user.email,
            "department": user.department
        })
    return {"data": data, "total": len(data)}

@router.post("/events/{event_id}/register", status_code=201)
async def register_for_event(
    event_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any)
):
    # Get event
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check status
    if event.status != "open":
        raise HTTPException(status_code=400, detail="Event is not open for registration")

    # Check deadline
    now = datetime.now(timezone.utc)
    if event.registration_deadline:
        deadline = event.registration_deadline.replace(tzinfo=timezone.utc) if event.registration_deadline.tzinfo is None else event.registration_deadline
        if now > deadline:
            raise HTTPException(status_code=400, detail="Registration deadline has passed")

    # Check duplicate
    existing = await db.execute(
        select(Registration).where(
            and_(Registration.event_id == event_id, Registration.user_id == current_user.id)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already registered for this event")

    # Check slots
    if event.max_slots:
        count_result = await db.execute(
            select(func.count()).select_from(Registration).where(
                and_(Registration.event_id == event_id, Registration.status == "confirmed")
            )
        )
        if count_result.scalar() >= event.max_slots:
            raise HTTPException(status_code=400, detail="No slots available")

    # Create registration
    reg = Registration(event_id=event_id, user_id=current_user.id, status="confirmed")
    db.add(reg)
    await db.commit()
    await db.refresh(reg)

    # Generate QR and send email in background
    async def post_register_tasks(reg_id: int, user_id: int, ev_id: int):
        async with AsyncSessionLocal() as bg_db:
            qr_path = await generate_registration_qr(user_id, ev_id)
            reg_obj = await bg_db.get(Registration, reg_id)
            if reg_obj:
                reg_obj.qr_code_path = str(qr_path)
                await bg_db.commit()
            user = await bg_db.get(User, user_id)
            event_obj = await bg_db.get(Event, ev_id)
            await send_registration_confirmation(user, event_obj, qr_path)

    from app.database import AsyncSessionLocal
    background_tasks.add_task(post_register_tasks, reg.id, current_user.id, event_id)

    return {"message": "Registration successful", "data": RegistrationOut.model_validate(reg)}

@router.delete("/events/{event_id}/register")
async def cancel_registration(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any)
):
    result = await db.execute(
        select(Registration).where(
            and_(Registration.event_id == event_id, Registration.user_id == current_user.id)
        )
    )
    reg = result.scalar_one_or_none()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    reg.status = "cancelled"
    await db.commit()
    return {"message": "Registration cancelled"}

@router.get("/registrations/mine")
async def my_registrations(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_any)):
    result = await db.execute(
        select(Registration, Event)
        .join(Event, Registration.event_id == Event.id)
        .where(Registration.user_id == current_user.id)
        .order_by(Registration.registered_at.desc())
    )
    rows = result.all()
    data = []
    for reg, event in rows:
        data.append({
            **RegistrationOut.model_validate(reg).model_dump(),
            "event_title": event.title,
            "event_date": event.event_date,
            "venue": event.venue,
            "event_status": event.status
        })
    return {"data": data, "total": len(data)}
```

---

## `app/routers/attendance.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.database import get_db
from app.models import User, Event, Attendance, Registration
from app.schemas.attendance import AttendanceMarkRequest, AttendanceOut
from app.middleware.auth import require_organizer, require_any

router = APIRouter(tags=["attendance"])

@router.get("/events/{event_id}/attendance")
async def list_attendance(event_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_organizer)):
    result = await db.execute(
        select(Attendance, User)
        .join(User, Attendance.user_id == User.id)
        .where(Attendance.event_id == event_id)
        .order_by(Attendance.checked_in_at.asc())
    )
    rows = result.all()
    return {
        "data": [{
            "id": att.id, "event_id": att.event_id, "user_id": att.user_id,
            "checked_in_at": att.checked_in_at, "method": att.method,
            "student_name": user.full_name, "student_id": user.student_id
        } for att, user in rows],
        "total": len(rows)
    }

@router.post("/events/{event_id}/attendance", status_code=201)
async def mark_attendance(
    event_id: int,
    body: AttendanceMarkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_organizer)
):
    # Verify user is registered
    reg = await db.execute(
        select(Registration).where(
            and_(Registration.event_id == event_id, Registration.user_id == body.user_id,
                 Registration.status == "confirmed")
        )
    )
    if not reg.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is not registered for this event")

    # Check duplicate
    existing = await db.execute(
        select(Attendance).where(and_(Attendance.event_id == event_id, Attendance.user_id == body.user_id))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Attendance already marked")

    att = Attendance(event_id=event_id, user_id=body.user_id, method=body.method)
    db.add(att)
    await db.commit()
    await db.refresh(att)
    return {"message": "Attendance marked", "data": AttendanceOut.model_validate(att)}

@router.get("/events/{event_id}/attendance/{user_id}")
async def check_attendance(event_id: int, user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_any)):
    result = await db.execute(
        select(Attendance).where(and_(Attendance.event_id == event_id, Attendance.user_id == user_id))
    )
    att = result.scalar_one_or_none()
    return {"present": att is not None, "data": AttendanceOut.model_validate(att) if att else None}
```

---

## `app/routers/certificates.py`

```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.database import get_db
from app.models import User, Event, Attendance, Certificate
from app.middleware.auth import require_organizer
from app.services.certificate_service import bulk_generate_certificates
from app.services.email_service import bulk_send_certificates

router = APIRouter(tags=["certificates"])

@router.post("/events/{event_id}/certificates/generate")
async def generate_certificates(
    event_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_organizer)
):
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    att_result = await db.execute(
        select(User).join(Attendance, User.id == Attendance.user_id)
        .where(Attendance.event_id == event_id)
    )
    attendees = att_result.scalars().all()
    if not attendees:
        raise HTTPException(status_code=400, detail="No attendance records found")

    background_tasks.add_task(bulk_generate_certificates, attendees, event)
    return {"message": f"Generating {len(attendees)} certificates in background"}

@router.post("/events/{event_id}/certificates/send")
async def send_certificates(
    event_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_organizer)
):
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    cert_result = await db.execute(
        select(Certificate, User)
        .join(User, Certificate.user_id == User.id)
        .where(and_(Certificate.event_id == event_id, Certificate.sent_via_email == 0))
    )
    rows = cert_result.all()
    if not rows:
        raise HTTPException(status_code=400, detail="No unsent certificates found")

    packages = [{"user": user, "event": event, "certificate_path": cert.file_path} for cert, user in rows]
    cert_ids = [cert.id for cert, _ in rows]
    background_tasks.add_task(bulk_send_certificates, packages, cert_ids)
    return {"message": f"Sending {len(packages)} certificates in background"}

@router.get("/certificates/mine")
async def my_certificates(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_organizer)):
    result = await db.execute(
        select(Certificate, Event)
        .join(Event, Certificate.event_id == Event.id)
        .where(Certificate.user_id == current_user.id)
    )
    rows = result.all()
    return {"data": [{"id": c.id, "event_title": e.title, "generated_at": c.generated_at,
                      "file_path": c.file_path, "sent_via_email": bool(c.sent_via_email)} for c, e in rows]}
```

---

## `app/routers/users.py`

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from app.database import get_db
from app.models import User
from app.schemas.auth import UserOut
from app.middleware.auth import get_current_user, require_admin

router = APIRouter(prefix="/users", tags=["users"])

@router.get("", response_model=dict)
async def list_users(
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if search:
        query = query.where(
            User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%") | User.student_id.ilike(f"%{search}%")
        )
    total = await db.execute(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.limit(limit).offset(offset))
    users = result.scalars().all()
    return {"data": [UserOut.model_validate(u) for u in users], "total": total.scalar()}

@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)

@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int, body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    allowed = {"role", "department", "year_level", "full_name"}
    for key, val in body.items():
        if key in allowed:
            setattr(user, key, val)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)

@router.delete("/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return {"message": "User deleted"}
```

---

## `app/routers/reports.py`

```python
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
import csv, io
from app.database import get_db
from app.models import User, Event, Registration, Attendance, Certificate
from app.middleware.auth import require_organizer, require_admin

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/events/{event_id}")
async def event_report(event_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_organizer)):
    event = await db.get(Event, event_id)
    reg_count = (await db.execute(select(func.count()).select_from(Registration).where(
        and_(Registration.event_id == event_id, Registration.status == "confirmed")))).scalar()
    att_count = (await db.execute(select(func.count()).select_from(Attendance).where(Attendance.event_id == event_id))).scalar()
    cert_sent = (await db.execute(select(func.count()).select_from(Certificate).where(
        and_(Certificate.event_id == event_id, Certificate.sent_via_email == 1)))).scalar()
    return {
        "event": {"id": event.id, "title": event.title, "event_date": event.event_date, "venue": event.venue, "status": event.status},
        "registrations_count": reg_count,
        "attendance_count": att_count,
        "attendance_rate": round((att_count / reg_count * 100) if reg_count > 0 else 0, 1),
        "certificates_sent": cert_sent
    }

@router.get("/overall")
async def overall_report(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    total_events = (await db.execute(select(func.count()).select_from(Event))).scalar()
    total_registrations = (await db.execute(select(func.count()).select_from(Registration))).scalar()
    total_students = (await db.execute(select(func.count()).select_from(User).where(User.role == "student"))).scalar()
    return {"total_events": total_events, "total_registrations": total_registrations, "total_students": total_students}

@router.get("/export/{event_id}")
async def export_csv(event_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_organizer)):
    result = await db.execute(
        select(Registration, User, Attendance)
        .join(User, Registration.user_id == User.id)
        .outerjoin(Attendance, and_(Attendance.event_id == event_id, Attendance.user_id == User.id))
        .where(Registration.event_id == event_id)
    )
    rows = result.all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Student ID", "Full Name", "Email", "Department", "Year Level", "Registered At", "Status", "Attended", "Check-in Time"])
    for reg, user, att in rows:
        writer.writerow([user.student_id, user.full_name, user.email, user.department, user.year_level,
                         reg.registered_at, reg.status, "Yes" if att else "No", att.checked_in_at if att else ""])
    return Response(content=output.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=event_{event_id}_report.csv"})
```

---

## `app/routers/settings.py`

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Setting
from app.middleware.auth import require_admin

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("")
async def get_settings(db: AsyncSession = Depends(get_db), current_user = Depends(require_admin)):
    result = await db.execute(select(Setting))
    settings = result.scalars().all()
    return {s.key: s.value for s in settings}

@router.put("")
async def update_settings(body: dict, db: AsyncSession = Depends(get_db), current_user = Depends(require_admin)):
    for key, value in body.items():
        setting = await db.get(Setting, key)
        if setting:
            setting.value = str(value)
        else:
            db.add(Setting(key=key, value=str(value)))
    await db.commit()
    return {"message": "Settings updated"}
```

---

## `app/main.py` — FastAPI Entry Point

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from app.database import init_db
from app.config import settings
from app.routers import auth, events, registrations, attendance, certificates, users, reports, settings as settings_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title="EVENTLINK CDM API",
    version="1.0.0",
    docs_url="/api/docs",           # Swagger UI at /api/docs
    redoc_url="/api/redoc",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Mount static asset directory
app.mount("/assets", StaticFiles(directory=str(settings.ASSETS_DIR)), name="assets")

# Mount all routers under /api prefix
for router_module in [auth, events, registrations, attendance, certificates, users, reports, settings_router]:
    app.include_router(router_module.router, prefix="/api")

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
```

---

## ELECTRON INTEGRATION — how main.js spawns Python

Update `electron/main.js` to spawn Python instead of requiring Express:

```javascript
const { spawn } = require("child_process");
const path = require("path");
let pythonProcess = null;

function startPythonServer() {
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const backendPath = path.join(__dirname, "../backend");

  pythonProcess = spawn(
    pythonCmd,
    [
      "-m",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      "8000",
      "--reload", // remove in production build
    ],
    {
      cwd: backendPath,
      stdio: "pipe",
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    },
  );

  pythonProcess.stdout.on("data", (d) => console.log("[Python]", d.toString()));
  pythonProcess.stderr.on("data", (d) =>
    console.error("[Python ERR]", d.toString()),
  );

  return new Promise((resolve) => {
    // Wait for uvicorn to be ready
    pythonProcess.stderr.on("data", (d) => {
      if (d.toString().includes("Application startup complete")) resolve();
    });
    setTimeout(resolve, 4000); // fallback after 4s
  });
}

app.whenReady().then(async () => {
  await startPythonServer();
  createWindow();
});

app.on("before-quit", () => {
  if (pythonProcess) pythonProcess.kill();
});
```

Update `src/lib/api.js` base URL:

```javascript
baseURL: "http://127.0.0.1:8000/api"; // Python FastAPI port
```

---

## HOW TO RUN THE BACKEND STANDALONE (for development/testing)

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env        # edit .env with your email creds
uvicorn app.main:app --reload --port 8000
```

Swagger UI available at: `http://localhost:8000/api/docs`

---

## VALIDATION CHECKLIST

- [ ] All 8 router files created and mounted in `main.py`
- [ ] SQLAlchemy models match canonical schema in `00_MASTER_OVERVIEW.md`
- [ ] JWT dependency works — missing token → 401, wrong role → 403
- [ ] `POST /api/events/{id}/register` validates slots, deadline, duplicate
- [ ] Background tasks used for email + QR (no blocking main thread)
- [ ] CSV export returns correct `Content-Disposition` header
- [ ] `/api/health` returns 200
- [ ] `/api/docs` renders Swagger UI with all endpoints
- [ ] Electron spawns Python process and waits for startup before opening window
- [ ] `api.js` in React points to port 8000 (not 3001)
