from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.dependencies import get_project_store
from app.keycloak import AuthenticatedUser
from app.schemas import ProjectCreateRequest, ProjectListResponse, ProjectResponse
from app.storage import InMemoryProjectStore

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: InMemoryProjectStore = Depends(get_project_store),
) -> ProjectListResponse:
    records = store.list_by_owner(current_user.sub)
    return ProjectListResponse(
        items=[
            ProjectResponse(
                id=record.id,
                name=record.name,
                description=record.description,
                created_at=record.created_at,
            )
            for record in records
        ]
    )


@router.post("", response_model=ProjectResponse)
async def create_project(
    payload: ProjectCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: InMemoryProjectStore = Depends(get_project_store),
) -> ProjectResponse:
    record = store.create(
        owner_sub=current_user.sub,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
    )
    return ProjectResponse(
        id=record.id,
        name=record.name,
        description=record.description,
        created_at=record.created_at,
    )
