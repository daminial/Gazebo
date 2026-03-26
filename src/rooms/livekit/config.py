from livekit.api import AccessToken, VideoGrants
from src.core.config import settings


class LiveKitConfig:
    def __init__(self):
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET
        self.url = settings.LIVEKIT_URL
    
    def create_token(self, room_name: str, participant_name: str, **permissions):
        """
        Создать JWT токен для подключения к комнате LiveKit
        
        :param room_name: Имя комнаты (обычно room_id)
        :param participant_name: Имя участника (user_id или username)
        :param permissions: Права доступа (can_publish, can_subscribe, etc.)
        :return: JWT токен
        """
        token = AccessToken(self.api_key, self.api_secret)
        token.with_identity(participant_name)
        token.with_name(participant_name)
        grants = VideoGrants(
            room=room_name,
            room_join=True,
            can_publish=permissions.get("can_publish", True),
            can_subscribe=permissions.get("can_subscribe", True),
            can_publish_data=permissions.get("can_publish_data", True),
        )
        token.with_grants(grants)
        return token.to_jwt()

livekit_config = LiveKitConfig()
