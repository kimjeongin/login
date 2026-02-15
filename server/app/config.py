from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Extension Login API"
    api_prefix: str = "/api"
    debug: bool = False

    keycloak_base_url: str = Field(default="http://localhost:8080")
    keycloak_realm: str = Field(default="test")
    keycloak_verify_ssl: bool = Field(default=False)

    cors_allow_origins: str = Field(default="*")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def issuer_url(self) -> str:
        base = self.keycloak_base_url.rstrip("/")
        return f"{base}/realms/{self.keycloak_realm}"

    @property
    def oidc_config_url(self) -> str:
        return f"{self.issuer_url}/.well-known/openid-configuration"

    def cors_origins(self) -> list[str]:
        raw = self.cors_allow_origins.strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
