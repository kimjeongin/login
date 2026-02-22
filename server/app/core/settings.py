from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Login API"
    api_prefix: str = "/api"
    debug: bool = False

    keycloak_base_url: str = Field(default="http://localhost:8080")
    keycloak_realm: str = Field(default="test")
    keycloak_expected_audience: str = Field(default="")
    keycloak_verify_ssl: bool = Field(default=False)
    keycloak_jwks_cache_ttl_seconds: int = Field(default=300, ge=30)
    auth_required_role: str = Field(default="active")
    cors_allow_origins: str = Field(default="*")
    chat_a2a_handler_name: str = Field(default="chatbot")
    chat_ollama_base_url: str = Field(default="http://localhost:11434")
    chat_ollama_model: str = Field(default="qwen3:8b")
    chat_ollama_temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    chat_response_timeout_seconds: float = Field(default=60.0, ge=5.0, le=300.0)
    chat_history_max_messages: int = Field(default=12, ge=2, le=50)
    chat_system_prompt: str = Field(
        default=(
            "You are a concise Korean assistant for a sidepanel chat. "
            "Provide practical, direct answers."
        )
    )

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

    @property
    def keycloak_audience(self) -> str | None:
        audience = self.keycloak_expected_audience.strip()
        if not audience:
            return None
        return audience

    @property
    def required_role(self) -> str:
        return self.auth_required_role.strip()

    @property
    def chat_handler_name(self) -> str:
        name = self.chat_a2a_handler_name.strip()
        if not name:
            return "chatbot"
        return name

    def cors_origins(self) -> list[str]:
        raw = self.cors_allow_origins.strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
