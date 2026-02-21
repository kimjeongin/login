from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.projects.domain.models import Project


class ProjectCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value == "":
            return None
        return value


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None
    created_at: datetime

    @classmethod
    def from_domain(cls, project: Project) -> "ProjectResponse":
        return cls(
            id=project.id,
            name=project.name,
            description=project.description,
            created_at=project.created_at,
        )


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]

    @classmethod
    def from_domain(cls, projects: list[Project]) -> "ProjectListResponse":
        return cls(items=[ProjectResponse.from_domain(project) for project in projects])

