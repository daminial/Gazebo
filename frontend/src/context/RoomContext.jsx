import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { roomsAPI } from '../api';
import { useLiveKit } from '../hooks/useLiveKit';
import { useAuth } from './AuthContext';

const RoomContext = createContext(null);

export function RoomProvider({ roomId, children }) {
  const { user } = useAuth();
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

  // Загрузка истории чата при подключении
  const [chatMessages, setChatMessages] = useState([]);
  
  useEffect(() => {
    async function loadChatHistory() {
      try {
        const response = await roomsAPI.getChatMessages(roomId, 100);
        const messages = response.data.messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender: msg.username || 'Неизвестный',
          timestamp: new Date(msg.created_at),
          isOwn: msg.user_id === null, // Будет обновлено после подключения
          userId: msg.user_id,
          messageType: msg.message_type,
        }));
        setChatMessages(messages);
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    }

    loadChatHistory();
  }, [roomId]);

  // Подключение к LiveKit
  const {
    room,
    isConnected,
    participants,
    localParticipant,
    sendData,
    setOnData,
  } = useLiveKit(roomId, livekitToken, livekitUrl);

  // Обработчик данных из Data Channel
  const handleDataReceived = useCallback((payload, participant, kind, topic) => {
    try {
      // Декодируем payload (может быть Uint8Array)
      const decoded = typeof payload === 'string'
        ? payload
        : new TextDecoder().decode(payload);
      const data = JSON.parse(decoded);

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
            // Пропускаем собственные сообщения
            if (participant === room?.localParticipant) {
              break;
            }

            // Получаем имя пользователя из metadata токена
            let senderName = 'Неизвестный';
            try {
              console.log('[DEBUG] Participant metadata:', participant?.metadata);
              console.log('[DEBUG] Participant identity:', participant?.identity);
              if (participant?.metadata) {
                const metadata = typeof participant.metadata === 'string'
                  ? JSON.parse(participant.metadata)
                  : participant.metadata;
                senderName = metadata.username || 'Неизвестный';
              }
            } catch (e) {
              console.warn('Failed to parse participant metadata:', e);
            }

            console.log('Chat message from:', senderName, data.payload);
            setChatMessages((prev) => [
              ...prev,
              {
                id: Date.now(),
                content: data.payload.content,
                sender: senderName,
                timestamp: new Date(),
                isOwn: false,
                messageType: data.payload.message_type || 'text',
              },
            ]);
          }
          break;

        case 'game:dice':
          if (data.type === 'dice:roll') {
            console.log('Dice roll:', data.payload);
          }
          break;

        case 'game:page':
          if (data.type === 'page:changed') {
            console.log('Page changed:', data.payload);
            setActivePageId(data.payload.page_id);
            if (data.payload.map_id) {
              setActiveMapId(data.payload.map_id);
            }
          }
          if (data.type === 'page:background_changed') {
            console.log('Page background changed:', data.payload);
            setPages(prev => prev.map(p => {
              if (p.id === data.payload.page_id) {
                return { ...p, map_id: data.payload.map_id };
              }
              return p;
            }));
          }
          if (data.type === 'page:background_removed') {
            console.log('Page background removed:', data.payload);
            setPages(prev => prev.map(p => {
              if (p.id === data.payload.page_id) {
                return { ...p, map_id: null };
              }
              return p;
            }));
          }
          if (data.type === 'page:created') {
            console.log('Page created:', data.payload);
            setPages(prev => [...prev, data.payload]);
          }
          if (data.type === 'page:updated') {
            console.log('Page updated:', data.payload);
            setPages(prev => prev.map(p =>
              p.id === data.payload.id ? data.payload : p
            ));
          }
          if (data.type === 'page:deleted') {
            console.log('Page deleted:', data.payload);
            setPages(prev => prev.filter(p => p.id !== data.payload.page_id));
          }
          break;

        case 'game:map':
          if (data.type === 'map:added') {
            console.log('Map added:', data.payload);
            setMaps(prev => [...prev, data.payload]);
          }
          if (data.type === 'map:deleted') {
            console.log('Map deleted:', data.payload);
            setMaps(prev => prev.filter(m => m.id !== data.payload.map_id));
          }
          break;

        default:
          console.log('Unknown topic:', topic, data);
      }
    } catch (err) {
      console.error('Failed to parse data:', err);
    }
  }, [room, setActivePageId, setActiveMapId]);

  // Устанавливаем обработчик данных
  useEffect(() => {
    setOnData(handleDataReceived);
  }, [setOnData, handleDataReceived]);

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
    async (content, message_type = 'text') => {
      // Сразу добавляем в локальный state (чтобы видеть мгновенно)
      const tempId = Date.now();
      setChatMessages((prev) => [
        ...prev,
        {
          id: tempId,
          content,
          sender: user?.username || 'Вы',
          timestamp: new Date(),
          isOwn: true,
          messageType: message_type,
        },
      ]);

      // Отправляем через LiveKit (для других участников)
      sendData(
        {
          type: 'chat:message',
          payload: { content, message_type },
        },
        'game:chat'
      );

      // Сохраняем в БД
      try {
        const response = await roomsAPI.sendChatMessage(roomId, {
          content,
          message_type
        });
        
        // Заменяем временный ID на реальный из БД
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, id: response.data.id } : msg
          )
        );
      } catch (err) {
        console.error('Failed to save chat message:', err);
      }
    },
    [sendData, roomId, user]
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

  // Синхронизация карт
  const syncMapAdded = useCallback(
    (mapData) => {
      sendData(
        {
          type: 'map:added',
          payload: mapData,
        },
        'game:map'
      );
    },
    [sendData]
  );

  const syncMapDeleted = useCallback(
    (mapId) => {
      sendData(
        {
          type: 'map:deleted',
          payload: { map_id: mapId },
        },
        'game:map'
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

      // Синхронизируем с другими участниками через LiveKit
      sendData(
        {
          type: 'page:changed',
          payload: { page_id: pageId, map_id: page?.map?.id || null },
        },
        'game:page'
      );
    } catch (err) {
      console.error('Failed to set active page:', err);
    }
  }, [roomId, pages, sendData]);

  const createPage = useCallback(async (pageData) => {
    try {
      const response = await roomsAPI.createPage(roomId, pageData);
      const pageDataWithMap = {
        ...response.data,
        map: response.data.map_id ? maps.find(m => m.id === response.data.map_id) || null : null,
      };
      setPages(prev => [...prev, pageDataWithMap]);

      // Синхронизируем
      sendData(
        {
          type: 'page:created',
          payload: pageDataWithMap,
        },
        'game:page'
      );
      return pageDataWithMap;
    } catch (err) {
      console.error('Failed to create page:', err);
      throw err;
    }
  }, [roomId, maps, sendData]);

  const updatePage = useCallback(async (pageId, pageData) => {
    try {
      const response = await roomsAPI.updatePage(roomId, pageId, pageData);
      const updatedPage = {
        ...response.data,
        map: response.data.map_id ? maps.find(m => m.id === response.data.map_id) || null : null,
      };
      setPages(prev => prev.map(p => p.id === pageId ? updatedPage : p));

      // Синхронизируем
      sendData(
        {
          type: 'page:updated',
          payload: updatedPage,
        },
        'game:page'
      );
      return updatedPage;
    } catch (err) {
      console.error('Failed to update page:', err);
      throw err;
    }
  }, [roomId, maps, sendData]);

  const deletePage = useCallback(async (pageId) => {
    try {
      await roomsAPI.deletePage(roomId, pageId);
      setPages(prev => prev.filter(p => p.id !== pageId));

      // Синхронизируем
      sendData(
        {
          type: 'page:deleted',
          payload: { page_id: pageId },
        },
        'game:page'
      );

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
  }, [roomId, pages, sendData]);

  const setPageBackground = useCallback(async (pageId, imageId) => {
    try {
      await roomsAPI.setPageBackground(roomId, pageId, imageId);

      // Синхронизируем с другими участниками через LiveKit
      sendData(
        {
          type: 'page:background_changed',
          payload: { page_id: pageId, map_id: imageId || null },
        },
        'game:page'
      );

      // Обновляем локально
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
  }, [roomId, sendData]);

  const removePageBackground = useCallback(async (pageId) => {
    try {
      await roomsAPI.removePageBackground(roomId, pageId);

      // Синхронизируем с другими участниками через LiveKit
      sendData(
        {
          type: 'page:background_removed',
          payload: { page_id: pageId },
        },
        'game:page'
      );

      // Обновляем локально
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
  }, [roomId, sendData]);

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

    // Чат
    chatMessages,
    setChatMessages,

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
    syncMapAdded,
    syncMapDeleted,
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
