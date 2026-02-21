from app.projects.domain.models import Project
from app.projects.domain.repositories import ProjectRepository


class ProjectService:
    def __init__(self, repository: ProjectRepository) -> None:
        self._repository = repository

    def list_for_owner(self, owner_subject: str) -> list[Project]:
        return self._repository.list_by_owner(owner_subject)

    def create_for_owner(
        self,
        owner_subject: str,
        name: str,
        description: str | None,
    ) -> Project:
        cleaned_name = name.strip()
        cleaned_description = description.strip() if isinstance(description, str) else None
        if not cleaned_name:
            raise ValueError("Project name is required.")
        if cleaned_description == "":
            cleaned_description = None

        return self._repository.create(
            owner_subject=owner_subject,
            name=cleaned_name,
            description=cleaned_description,
        )

