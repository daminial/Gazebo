"""Файл отвечает за генерацию .env файла с необходимыми данными"""
import secrets
import argparse

def generate_env(env_name=".env"):
    """Генерирует безопасный .env файл"""

    env_content = f"""# JWT Secrets (CRYPTOGRAPHICALLY SECURE)
AUTH_JWT_SECRET_KEY={secrets.token_urlsafe(64)}
AUTH_JWT_REFRESH_SECRET_KEY={secrets.token_urlsafe(64)}

# Token expiration
AUTH_ACCESS_TOKEN_EXPIRE_MINUTES=30
AUTH_REFRESH_TOKEN_EXPIRE_DAYS=7

# Password hashing
AUTH_PASSWORD_HASH_ALGORITHM=argon2
AUTH_JWT_ALGORITHM=HS256
"""

    with open(env_name, "w") as f:
        f.write(env_content)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--env", default=".env", help="Имя .env файла")
    args = parser.parse_args()

    generate_env(args.env)