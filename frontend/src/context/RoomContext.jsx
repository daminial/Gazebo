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
  
  // Страницы и настройки
  const [pages, setPages] = useState([]);
  const [activePageId, setActivePageId] = useState(null);
  const [roomSettings, setRoomSettings] = useState(null);

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

  // Загрузка карт, токенов, страниц и настроек
  useEffect(() => {
    async function loadRoomData() {
      try {
        const [roomRes, tokensRes] = await Promise.all([
          roomsAPI.getById(roomId),
          roomsAPI.getTokens(roomId),
        ]);

        console.log('Room data from server:', roomRes.data);

        // Извлекаем карты из страниц
        const pagesData = roomRes.data.pages || [];
        setPages(pagesData);
        
        // Загружаем карты для каждой страницы
        const mapsPromises = pagesData.map(async (page) => {
          try {
            const mapsRes = await roomsAPI.getMaps(roomId);
            const pageMap = mapsRes.data.find(m => m.id === page.map_id);
            return {
              ...page,
              map: pageMap || null
            };
          } catch (err) {
            console.error('Failed to load map for page:', err);
            return { ...page, map: null };
          }
        });
        
        const pagesWithMaps = await Promise.all(mapsPromises);
        setPages(pagesWithMaps);
        
        // Устанавливаем активную страницу
        if (pagesData.length > 0) {
          const activePage = roomRes.data.active_page_id 
            ? pagesData.find(p => p.id === roomRes.data.active_page_id)
            : pagesData[0];
          setActivePageId(activePage?.id || null);
          
          // Если у активной страницы есть карта, устанавливаем её
          if (activePage?.map) {
            setActiveMapId(activePage.map.id);
          }
        }

        // Загружаем все карты комнаты для доступа к ним
        const allMapsRes = await roomsAPI.getMaps(roomId);
        setMaps(allMapsRes.data);

        setTokens(tokensRes.data);
        
        // Настройки комнаты
        if (roomRes.data.settings) {
          setRoomSettings(roomRes.data.settings);
        }
      } catch (err) {
        console.error('Failed to load room data:', err);
        setError(err);
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

  // Методы для работы со страницами
  const setActivePage = useCallback(async (pageId) => {
    try {
      await roomsAPI.setActivePage(roomId, pageId);
      setActivePageId(pageId);
      
      // Обновляем активную карту на основе новой страницы
      const page = pages.find(p => p.id === pageId);
      if (page?.map) {
        setActiveMapId(page.map.id);
      }
    } catch (err) {
      console.error('Failed to set active page:', err);
    }
  }, [roomId, pages]);

  const createPage = useCallback(async (pageData) => {
    try {
      const response = await roomsAPI.createPage(roomId, pageData);
      setPages(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      console.error('Failed to create page:', err);
      throw err;
    }
  }, [roomId]);

  const updatePage = useCallback(async (pageId, pageData) => {
    try {
      const response = await roomsAPI.updatePage(roomId, pageId, pageData);
      setPages(prev => prev.map(p => p.id === pageId ? response.data : p));
      return response.data;
    } catch (err) {
      console.error('Failed to update page:', err);
      throw err;
    }
  }, [roomId]);

  const updateRoomSettings = useCallback(async (settingsData) => {
    try {
      const response = await roomsAPI.updateSettings(roomId, settingsData);
      setRoomSettings(response.data);
      return response.data;
    } catch (err) {
      console.error('Failed to update room settings:', err);
      throw err;
    }
  }, [roomId]);

  const value = {
    // LiveKit
    livekitUrl,
    livekitToken,
    room,
    isConnected,
    participants,
    localParticipant,

    // Комната
    roomId,
    maps,
    tokens,
    activeMapId,
    setActiveMapId,
    
    // Страницы и настройки
    pages,
    activePageId,
    setActivePage,
    roomSettings,
    updateRoomSettings,
    createPage,
    updatePage,

    // Состояние
    loading,
    error,

    // Методы
    setMaps,
    setTokens,
    sendTokenMove,
    sendChatMessage,
    sendDiceRoll,
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
