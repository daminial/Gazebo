import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { roomsAPI } from '../api';
import { useLiveKit } from '../hooks/useLiveKit';

const RoomContext = createContext(null);

export function RoomProvider({ roomId, children }) {
  const [livekitToken, setLivekitToken] = useState(null);
  const [livekitUrl, setLivekitUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Состояние комнаты
  const [maps, setMaps] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [activeMapId, setActiveMapId] = useState(null);

  // Загрузка токена LiveKit
  useEffect(() => {
    async function fetchLiveKitToken() {
      try {
        const response = await roomsAPI.getLiveKitToken(roomId);
        setLivekitToken(response.data.token);
        setLivekitUrl(response.data.url);
      } catch (err) {
        setError(err);
        console.error('Failed to get LiveKit token:', err);
      }
    }

    fetchLiveKitToken();
  }, [roomId]);

  // Загрузка карт и токенов
  useEffect(() => {
    async function loadRoomData() {
      try {
        const [mapsRes, tokensRes] = await Promise.all([
          roomsAPI.getMaps(roomId),
          roomsAPI.getTokens(roomId),
        ]);

        setMaps(mapsRes.data);
        setTokens(tokensRes.data);

        // Выбираем первую карту активной
        if (mapsRes.data.length > 0) {
          setActiveMapId(mapsRes.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load room data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadRoomData();
  }, [roomId]);

  // Подключение к LiveKit
  const {
    room,
    isConnected,
    participants,
    localParticipant,
    sendData,
  } = useLiveKit(roomId, livekitToken, livekitUrl);

  // Обработчик данных из Data Channel
  const handleDataReceived = useCallback((payload, participant, kind, topic) => {
    try {
      const data = JSON.parse(payload);

      switch (topic) {
        case 'game:token':
          if (data.type === 'token:move') {
            setTokens((prev) =>
              prev.map((t) =>
                t.id === data.payload.token_id
                  ? { ...t, position_x: data.payload.x, position_y: data.payload.y }
                  : t
              )
            );
          }
          break;

        case 'game:chat':
          if (data.type === 'chat:message') {
            // Обработка сообщения чата
            console.log('Chat message:', data.payload);
          }
          break;

        case 'game:dice':
          if (data.type === 'dice:roll') {
            // Обработка броска куба
            console.log('Dice roll:', data.payload);
          }
          break;

        default:
          console.log('Unknown topic:', topic, data);
      }
    } catch (err) {
      console.error('Failed to parse data:', err);
    }
  }, []);

  // Подписка на данные
  useEffect(() => {
    if (!room) return;

    room.on('dataReceived', handleDataReceived);

    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, handleDataReceived]);

  // Методы для отправки игровых событий
  const sendTokenMove = useCallback(
    (token_id, x, y, rotation = null) => {
      sendData(
        {
          type: 'token:move',
          payload: { token_id, x, y, rotation },
        },
        'game:token'
      );
    },
    [sendData]
  );

  const sendChatMessage = useCallback(
    (content, message_type = 'text') => {
      sendData(
        {
          type: 'chat:message',
          payload: { content, message_type },
        },
        'game:chat'
      );
    },
    [sendData]
  );

  const sendDiceRoll = useCallback(
    (dice_type, result, modifiers = {}) => {
      sendData(
        {
          type: 'dice:roll',
          payload: { dice_type, result, modifiers },
        },
        'game:dice'
      );
    },
    [sendData]
  );

  const value = {
    // LiveKit
    livekitUrl,
    livekitToken,
    room,
    isConnected,
    participants,
    localParticipant,

    // Комната
    maps,
    tokens,
    activeMapId,
    setActiveMapId,

    // Состояние
    loading,
    error,

    // Методы
    sendTokenMove,
    sendChatMessage,
    sendDiceRoll,
    setTokens,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within RoomProvider');
  }
  return context;
}
