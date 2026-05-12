import random
import string
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiosmtplib
from src.core.config import settings


class EmailService:
    @staticmethod
    def generate_verification_code() -> str:
        return ''.join(random.choices(string.digits, k=6))
    
    @staticmethod
    def get_code_expiry() -> datetime:
        return datetime.now(timezone.utc) + timedelta(
            minutes=settings.VERIFICATION_CODE_EXPIRE_MINUTES
        )
    
    async def send_verification_email(self, email: str, code: str) -> bool:
        if settings.DEBUG:
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[DEV] Verification code for {email}: {code}")
            return True
        
        message = MIMEMultipart()
        message["From"] = settings.SMTP_SENDER_EMAIL
        message["To"] = email
        message["Subject"] = "Подтверждение email"
        
        html = f"""
        <html>
            <body>
                <h1>Подтверждение регистрации</h1>
                <p>Ваш код подтверждения: <strong>{code}</strong></p>
                <p>Код действителен 15 минут.</p>
            </body>
        </html>
        """
        
        message.attach(MIMEText(html, "html"))
        
        try:
            await aiosmtplib.send(
                message,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USERNAME,
                password=settings.SMTP_PASSWORD,
                use_tls=settings.SMTP_USE_TLS,
            )
            return True
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send email: {e}")
            return False
        