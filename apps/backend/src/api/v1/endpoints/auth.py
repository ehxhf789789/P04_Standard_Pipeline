"""
Authentication endpoints.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr

from src.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token,
    Token,
    TokenData,
)

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")


# ============================================================================
# Schemas
# ============================================================================

class UserCreate(BaseModel):
    """User registration schema."""
    email: EmailStr
    password: str
    name: str


class UserResponse(BaseModel):
    """User response schema."""
    id: UUID
    email: str
    name: str
    created_at: datetime


class UserLogin(BaseModel):
    """User login schema."""
    email: EmailStr
    password: str


class TokenRefresh(BaseModel):
    """Token refresh schema."""
    refresh_token: str


# ============================================================================
# Mock User Storage (Replace with database)
# ============================================================================

class MockUser:
    def __init__(self, id: UUID, email: str, name: str, hashed_password: str):
        self.id = id
        self.email = email
        self.name = name
        self.hashed_password = hashed_password
        self.created_at = datetime.now(timezone.utc)


# In-memory user storage (replace with database)
_users: dict[str, MockUser] = {}


def get_user_by_email(email: str) -> Optional[MockUser]:
    """Get user by email."""
    return _users.get(email)


def get_user_by_id(user_id: str) -> Optional[MockUser]:
    """Get user by ID."""
    for user in _users.values():
        if str(user.id) == user_id:
            return user
    return None


def create_user(email: str, name: str, password: str) -> MockUser:
    """Create a new user."""
    user = MockUser(
        id=uuid4(),
        email=email,
        name=name,
        hashed_password=get_password_hash(password),
    )
    _users[email] = user
    return user


# ============================================================================
# Dependencies
# ============================================================================

async def get_current_user(token: str = Depends(oauth2_scheme)) -> MockUser:
    """Get the current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data = verify_token(token, "access")
    if token_data is None:
        raise credentials_exception

    user = get_user_by_id(token_data.user_id)
    if user is None:
        raise credentials_exception

    return user


async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme)
) -> Optional[MockUser]:
    """Get the current user if authenticated, None otherwise."""
    if not token:
        return None

    try:
        return await get_current_user(token)
    except HTTPException:
        return None


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/register", response_model=UserResponse, status_code=201)
async def register(user_data: UserCreate):
    """Register a new user."""
    # Check if user exists
    if get_user_by_email(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user
    user = create_user(
        email=user_data.email,
        name=user_data.name,
        password=user_data.password,
    )

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        created_at=user.created_at,
    )


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login and get access token."""
    user = get_user_by_email(form_data.username)

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(str(user.id), user.email)
    refresh_token = create_refresh_token(str(user.id), user.email)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/login/json", response_model=Token)
async def login_json(credentials: UserLogin):
    """Login with JSON body (alternative to form)."""
    user = get_user_by_email(credentials.email)

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token = create_access_token(str(user.id), user.email)
    refresh_token = create_refresh_token(str(user.id), user.email)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(token_data: TokenRefresh):
    """Refresh access token using refresh token."""
    token_info = verify_token(token_data.refresh_token, "refresh")

    if token_info is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = get_user_by_id(token_info.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    access_token = create_access_token(str(user.id), user.email)
    refresh_token = create_refresh_token(str(user.id), user.email)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: MockUser = Depends(get_current_user)):
    """Get current user info."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        created_at=current_user.created_at,
    )


@router.post("/logout")
async def logout(current_user: MockUser = Depends(get_current_user)):
    """Logout (invalidate token - client should discard token)."""
    # In a production system, you would:
    # 1. Add the token to a blacklist
    # 2. Or use short-lived tokens with refresh token rotation
    return {"message": "Successfully logged out"}
