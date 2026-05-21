from typing import Dict, Any
import httpx
from src.core.config import settings


class OAuthProvider:
    async def get_authorization_url(self) -> str:
        raise NotImplementedError
    
    async def get_user_info(self, code: str) -> Dict[str, Any]:
        raise NotImplementedError


class GitHubProvider(OAuthProvider):
    async def get_authorization_url(self) -> str:
        params = (
            f"client_id={settings.GITHUB_CLIENT_ID}"
            f"&redirect_uri={settings.GITHUB_REDIRECT_URI}"
            f"&scope=user:email"
        )
        return f"https://github.com/login/oauth/authorize?{params}"
    
    async def get_user_info(self, code: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code
                }
            )
            access_token = token_resp.json()["access_token"]
            
            headers = {"Authorization": f"Bearer {access_token}"}
            user_resp = await client.get("https://api.github.com/user", headers=headers)
            user_data = user_resp.json()
            
            emails_resp = await client.get("https://api.github.com/user/emails", headers=headers)
            emails = emails_resp.json()
            primary_email = next(e["email"] for e in emails if e["primary"])
            
            return {
                "email": primary_email,
                "username": user_data["login"],
                "full_name": user_data.get("name") or user_data["login"],
                "provider": "github",
                "provider_id": str(user_data["id"])
            }


class GoogleProvider(OAuthProvider):
    async def get_authorization_url(self) -> str:
        params = (
            f"client_id={settings.GOOGLE_CLIENT_ID}"
            f"&redirect_uri={settings.GOOGLE_REDIRECT_URI}"
            f"&response_type=code"
            f"&scope=openid%20email%20profile"
        )
        return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"
    
    async def get_user_info(self, code: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI
                }
            )
            tokens = token_resp.json()
            access_token = tokens["access_token"]
            
            headers = {"Authorization": f"Bearer {access_token}"}
            user_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers=headers
            )
            user_data = user_resp.json()
            
            return {
                "email": user_data["email"],
                "username": user_data.get("given_name", user_data["email"].split("@")[0]),
                "full_name": user_data.get("name"),
                "provider": "google",
                "provider_id": user_data["sub"]
            }


class YandexProvider(OAuthProvider):
    async def get_authorization_url(self) -> str:
        params = (
            f"client_id={settings.YANDEX_CLIENT_ID}"
            f"&redirect_uri={settings.YANDEX_REDIRECT_URI}"
            f"&response_type=code"
        )
        return f"https://oauth.yandex.ru/authorize?{params}"
    
    async def get_user_info(self, code: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://oauth.yandex.ru/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": settings.YANDEX_CLIENT_ID,
                    "client_secret": settings.YANDEX_CLIENT_SECRET
                }
            )
            access_token = token_resp.json()["access_token"]
            
            headers = {"Authorization": f"OAuth {access_token}"}
            user_resp = await client.get(
                "https://login.yandex.ru/info?format=json",
                headers=headers
            )
            user_data = user_resp.json()
            
            return {
                "email": user_data["default_email"],
                "username": user_data.get("login", user_data["default_email"].split("@")[0]),
                "full_name": f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip(),
                "provider": "yandex",
                "provider_id": str(user_data["id"])
            }
        