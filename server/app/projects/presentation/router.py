from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.domain.principal import AuthenticatedPrincipal
from app.auth.presentation.dependencies import get_current_authorized_principal
from app.core.dependencies import get_project_service
from app.projects.presentation.schemas import (
    ProjectCreateRequest,
    ProjectListResponse,
    ProjectResponse,
)
from app.projects.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])

CurrentPrincipal = Annotated[
    AuthenticatedPrincipal,
    Depends(get_current_authorized_principal),
]
ProjectServiceDep = Annotated[ProjectService, Depends(get_project_service)]


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    current_principal: CurrentPrincipal,
    project_service: ProjectServiceDep,
) -> ProjectListResponse:
    projects = project_service.list_for_owner(current_principal.subject)
    return ProjectListResponse.from_domain(projects)


@router.post("", response_model=ProjectResponse)
async def create_project(
    payload: ProjectCreateRequest,
    current_principal: CurrentPrincipal,
    project_service: ProjectServiceDep,
) -> ProjectResponse:
    try:
        project = project_service.create_for_owner(
            owner_subject=current_principal.subject,
            name=payload.name,
            description=payload.description,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    return ProjectResponse.from_domain(project)
