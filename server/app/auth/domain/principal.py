from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True, frozen=True)
class AuthenticatedPrincipal:
    subject: str
    username: str | None
    groups: frozenset[str]
    roles: frozenset[str]
    active_claim: bool | None

    @staticmethod
    def _normalize(value: str) -> str:
        return value.strip().lower()

    def in_group(self, expected_group: str) -> bool:
        target = self._normalize(expected_group).lstrip("/")
        if not target:
            return False

        for group in self.groups:
            candidate = self._normalize(group).lstrip("/")
            if candidate == target or candidate.endswith(f"/{target}"):
                return True
        return False

    def has_role(self, expected_role: str) -> bool:
        target = self._normalize(expected_role)
        if not target:
            return False
        return any(self._normalize(role) == target for role in self.roles)

    def active_state_from_roles(
        self,
        active_role_true: str,
        active_role_false: str,
    ) -> bool | None:
        if self.has_role(active_role_true):
            return True
        if self.has_role(active_role_false):
            return False
        return self.active_claim

