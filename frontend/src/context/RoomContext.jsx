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
        const [roomRes, tokensRes, pagesRes] = await Promise.all([
          roomsAPI.getById(roomId),
          roomsAPI.getTokens(roomId),
          roomsAPI.getPages(roomId),
        ]);

        console.log('Room data from server:', roomRes.data);
        console.log('Pages from server:', pagesRes.data);

        // Загружаем все карты комнаты
        const mapsRes = await roomsAPI.getMaps(roomId);
        setMaps(mapsRes.data);

        // Привязываем карты к страницам
        const pagesData = pagesRes.data || [];
        const pagesWithMaps = pagesData.map((page) => ({
          ...page,
          map: page.map_id ? mapsRes.data.find(m => m.id === page.map_id) || null : null
        }));
        setPages(pagesWithMaps);

        // Устанавливаем активную страницу
        if (pagesWithMaps.length > 0) {
          const activePageIdFromServer = roomRes.data.current_page_id
            || pagesWithMaps[0]?.id;
          setActivePageId(activePageIdFromServer || null);

          const activePage = pagesWithMaps.find(p => p.id === activePageIdFromServer);
          if (activePage?.map) {
            setActiveMapId(activePage.map.id);
          }
        }

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
      const pageDataWithMap = {
        ...response.data,
        map: response.data.map_id ? maps.find(m => m.id === response.data.map_id) || null : null,
      };
      setPages(prev => [...prev, pageDataWithMap]);
      return pageDataWithMap;
    } catch (err) {
      console.error('Failed to create page:', err);
      throw err;
    }
  }, [roomId, maps]);

  const updatePage = useCallback(async (pageId, pageData) => {
    try {
      const response = await roomsAPI.updatePage(roomId, pageId, pageData);
      const updatedPage = {
        ...response.data,
        map: response.data.map_id ? maps.find(m => m.id === response.data.map_id) || null : null,
      };
      setPages(prev => prev.map(p => p.id === pageId ? updatedPage : p));
      return updatedPage;
    } catch (err) {
      console.error('Failed to update page:', err);
      throw err;
    }
  }, [roomId, maps]);

  const deletePage = useCallback(async (pageId) => {
    try {
      await roomsAPI.deletePage(roomId, pageId);
      setPages(prev => prev.filter(p => p.id !== pageId));
      // Если удалили активную страницу, переключаем на первую доступную
      setActivePageId(prev => {
        if (prev === pageId) {
          return pages.length > 1 ? pages.find(p => p.id !== pageId)?.id : null;
        }
        return prev;
      });
    } catch (err) {
      console.error('Failed to delete page:', err);
      throw err;
    }
  }, [roomId, pages]);

  const setPageBackground = useCallback(async (pageId, imageId) => {
    try {
      await roomsAPI.setPageBackground(roomId, pageId, imageId);
      // Перезагружаем страницы для получения актуальных данных
      const pagesRes = await roomsAPI.getPages(roomId);
      const mapsRes = await roomsAPI.getMaps(roomId);
      const pagesData = pagesRes.data || [];
      const pagesWithMaps = pagesData.map((page) => ({
        ...page,
        map: page.map_id ? mapsRes.data.find(m => m.id === page.map_id) || null : null
      }));
      setPages(pagesWithMaps);
    } catch (err) {
      console.error('Failed to set page background:', err);
      throw err;
    }
  }, [roomId]);

  const removePageBackground = useCallback(async (pageId) => {
    try {
      await roomsAPI.removePageBackground(roomId, pageId);
      // Перезагружаем страницы для получения актуальных данных
      const pagesRes = await roomsAPI.getPages(roomId);
      const mapsRes = await roomsAPI.getMaps(roomId);
      const pagesData = pagesRes.data || [];
      const pagesWithMaps = pagesData.map((page) => ({
        ...page,
        map: page.map_id ? mapsRes.data.find(m => m.id === page.map_id) || null : null
      }));
      setPages(pagesWithMaps);
    } catch (err) {
      console.error('Failed to remove page background:', err);
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
    deletePage,
    setPageBackground,
    removePageBackground,

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
