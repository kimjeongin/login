from fastapi import APIRouter

from app.browser_control.presentation.router import router as browser_control_router
from app.projects.presentation.router import router as projects_router

api_router = APIRouter()
api_router.include_router(projects_router)
api_router.include_router(browser_control_router)
