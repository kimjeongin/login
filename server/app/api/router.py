from fastapi import APIRouter

from app.projects.presentation.router import router as projects_router

api_router = APIRouter()
api_router.include_router(projects_router)

