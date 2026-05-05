import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { roomsAPI, bestiaryAPI } from '../api';
import { useLiveKit } from '../hooks/useLiveKit';
import { useAuth } from './AuthContext';

const RoomContext = createContext(null);

export function RoomProvider({ roomId, children }) {
  const { user } = useAuth();
  const [livekitToken, setLivekitToken] = useState(null);
  const [livekitUrl, setLivekitUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [maps, setMaps] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [activeMapId, setActiveMapId] = useState(null);
  
  const [pages, setPages] = useState([]);
  const [activePageId, setActivePageId] = useState(null);
  const [roomSettings, setRoomSettings] = useState(null);
  const [isDm, setIsDm] = useState(false);
  const [audioPlayerState, setAudioPlayerState] = useState(null);
  const [currentPlaylist, setCurrentPlaylist] = useState(null);

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

  useEffect(() => {
    async function loadRoomData() {
      try {
        const [roomRes, tokensRes, pagesRes] = await Promise.all([
          roomsAPI.getById(roomId),
          roomsAPI.getTokens(roomId),
          roomsAPI.getPages(roomId),
        ]);

        const mapsRes = await roomsAPI.getMaps(roomId);
        setMaps(mapsRes.data);

        const pagesData = pagesRes.data || [];
        const pagesWithMaps = pagesData.map((page) => ({
          ...page,
          map: page.map_id ? mapsRes.data.find(m => m.id === page.map_id) || null : null
        }));
        setPages(pagesWithMaps);

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

  useEffect(() => {
    async function loadUserRole() {
      try {
        const usersRes = await roomsAPI.getUsers(roomId);
        const users = usersRes.data || [];
        console.debug('[RoomContext] room users:', users)
        const me = users.find(u => String(u.user_id) === String(user?.id));
        console.debug('[RoomContext] current user:', user?.id, 'matched user entry:', me)
        if (me) {
          const role = (me.room_role || '').toString().toUpperCase()
          const isDmFlag = role === 'DM' || role === 'OWNER'
          setIsDm(isDmFlag)
          console.debug('[RoomContext] isDm set to', isDmFlag, 'from role', role)
        } else {
          setIsDm(false)
        }
      } catch (err) {
        console.warn('Failed to load room users to determine DM role:', err);
      }
    }
    if (user) loadUserRole();
  }, [roomId, user]);

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
          isOwn: msg.user_id === null,
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

  const {
    room,
    isConnected,
    participants,
    localParticipant,
    sendData,
    setOnData,
  } = useLiveKit(roomId, livekitToken, livekitUrl);

  const handleDataReceived = useCallback((payload, participant, kind, topic) => {
    try {
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
          if (data.type === 'token:created') {
            setTokens((prev) => {
              if (prev.find(t => t.id === data.payload.id)) {
                return prev;
              }
              return [...prev, data.payload];
            });
          }
          if (data.type === 'token:deleted') {
            setTokens((prev) => prev.filter(t => t.id !== data.payload.token_id));
          }
          break;

        case 'game:chat':
          if (data.type === 'chat:message') {
            if (participant === room?.localParticipant) {
              break;
            }

            let senderName = 'Неизвестный';
            try {
              if (participant?.metadata) {
                const metadata = typeof participant.metadata === 'string'
                  ? JSON.parse(participant.metadata)
                  : participant.metadata;
                senderName = metadata.username || 'Неизвестный';
              }
            } catch (e) {
              console.warn('Failed to parse participant metadata:', e);
            }

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
            
            let senderName = data.payload.senderName || 'Игрок';
            try {
              if (participant?.metadata) {
                const metadata = typeof participant.metadata === 'string'
                  ? JSON.parse(participant.metadata)
                  : participant.metadata;
                senderName = metadata.username || senderName;
              }
            } catch (e) {
              console.warn('Failed to parse participant metadata:', e);
            }
            
            setChatMessages((prev) => [
              ...prev,
              {
                id: Date.now(),
                content: `${data.payload.notation} = ${data.payload.total}`,
                sender: senderName,
                timestamp: new Date(),
                isOwn: false,
                messageType: 'dice_roll',
                diceData: {
                  notation: data.payload.notation,
                  total: data.payload.total,
                  rolls: data.payload.rolls,
                  modifier: data.payload.modifier,
                  detailedString: data.payload.detailedString
                }
              },
            ]);
          }
          break;

        case 'game:page':
          if (data.type === 'page:changed') {
            setActivePageId(data.payload.page_id);
            if (data.payload.map_id) {
              setActiveMapId(data.payload.map_id);
            }
          }
          if (data.type === 'page:background_changed') {
            setPages(prev => prev.map(p => {
              if (p.id === data.payload.page_id) {
                return { ...p, map_id: data.payload.map_id };
              }
              return p;
            }));
          }
          if (data.type === 'page:background_removed') {
            setPages(prev => prev.map(p => {
              if (p.id === data.payload.page_id) {
                return { ...p, map_id: null };
              }
              return p;
            }));
          }
          if (data.type === 'page:created') {
            setPages(prev => [...prev, data.payload]);
          }
          if (data.type === 'page:updated') {
            setPages(prev => prev.map(p =>
              p.id === data.payload.id ? data.payload : p
            ));
          }
          if (data.type === 'page:deleted') {
            setPages(prev => prev.filter(p => p.id !== data.payload.page_id));
          }
          break;

        case 'game:map':
          if (data.type === 'map:added') {
            setMaps(prev => [...prev, data.payload]);
          }
          if (data.type === 'map:deleted') {
            setMaps(prev => prev.filter(m => m.id !== data.payload.map_id));
          }
          break;

        case 'game:drawing':
          if (window.__handleDrawingData) {
            window.__handleDrawingData(data);
          }
          break;
        
        case 'game:audio':
          if (data.type === 'audio:player_command') {
            window.dispatchEvent(new CustomEvent('audio-player-command', {
              detail: data.payload
            }));
          }
          break;

        default:
      }
    } catch (err) {
      console.error('Failed to parse data:', err);
    }
  }, [room, setActivePageId, setActiveMapId]);

  useEffect(() => {
    setOnData(handleDataReceived);
  }, [setOnData, handleDataReceived]);

  const sendTokenMove = useCallback(
    async (token_id, x, y, rotation = null) => {
        try {
          await roomsAPI.updateTokenPosition(roomId, token_id, { position_x: x, position_y: y, rotation });

          setTokens(prev => prev.map(t => t.id === token_id ? { ...t, position_x: x, position_y: y, rotation: rotation ?? t.rotation } : t));
        } catch (err) {
          console.error('Failed to persist token position:', err);
        }

      try {
        sendData(
          {
            type: 'token:move',
            payload: { token_id, x, y, rotation },
          },
          'game:token'
        );
      } catch (err) {
        console.error('Failed to send token move via LiveKit:', err);
      }
    },
    [sendData, roomId]
  );

  const sendChatMessage = useCallback(
    async (content, message_type = 'text') => {
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

      sendData(
        {
          type: 'chat:message',
          payload: { content, message_type },
        },
        'game:chat'
      );

      try {
        const response = await roomsAPI.sendChatMessage(roomId, {
          content,
          message_type
        });
        
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
  (notation, total, rolls = [], modifier = 0, detailedString = '') => {
    const tempId = Date.now();
    const diceMessage = {
      id: tempId,
      content: `${notation} = ${total}`,
      sender: user?.username || 'Вы',
      timestamp: new Date(),
      isOwn: true,
      messageType: 'dice_roll',
      diceData: {
        notation,
        total,
        rolls,
        modifier,
        detailedString
      }
    };
    setChatMessages((prev) => [...prev, diceMessage]);
    
    sendData(
      {
        type: 'dice:roll',
        payload: {
          notation,
          total,
          rolls,
          modifier,
          detailedString,
          senderName: user?.username || 'Игрок'
        },
      },
      'game:dice'
    );
    
    roomsAPI.sendChatMessage(roomId, {
      content: `${notation} = ${total}`,
      message_type: 'dice_roll',
      dice_data: {
        notation,
        total,
        rolls,
        modifier,
        detailedString
      }
    }).catch(err => console.error('Failed to save dice message:', err));
  },
  [sendData, roomId, user, setChatMessages]
);

  const sendAudioEvent = useCallback(
    (eventType, payload) => {
      sendData(
        {
          type: eventType,
          payload,
        },
        'game:audio'
      );
    },
    [sendData]
  );

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

  const setActivePage = useCallback(async (pageId) => {
    try {
      await roomsAPI.setActivePage(roomId, pageId);
      setActivePageId(pageId);

      const page = pages.find(p => p.id === pageId);
      if (page?.map) {
        setActiveMapId(page.map.id);
      }

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

      sendData(
        {
          type: 'page:deleted',
          payload: { page_id: pageId },
        },
        'game:page'
      );

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

      sendData(
        {
          type: 'page:background_changed',
          payload: { page_id: pageId, map_id: imageId || null },
        },
        'game:page'
      );

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

      sendData(
        {
          type: 'page:background_removed',
          payload: { page_id: pageId },
        },
        'game:page'
      );

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

  const createToken = useCallback(async (tokenData) => {
    try {
      const response = await roomsAPI.createToken(roomId, tokenData);
      const newToken = response.data;
      setTokens(prev => [...prev, newToken]);

      sendData(
        {
          type: 'token:created',
          payload: newToken,
        },
        'game:token'
      );

      return newToken;
    } catch (err) {
      console.error('Failed to create token:', err);
      throw err;
    }
  }, [roomId, sendData]);

  const createTokenWithUpload = useCallback(async (tokenData, file = null, creatureData = null) => {
    try {
      const formData = new FormData();
      formData.append('name_in_room', tokenData.name_in_room);
      formData.append('position_x', tokenData.position_x || 0);
      formData.append('position_y', tokenData.position_y || 0);
      
      if (tokenData.page_id) {
        formData.append('page_id', tokenData.page_id);
      }
      
      if (file) {
        formData.append('file', file);
      }

      if (creatureData) {
        if (creatureData.creature_name) {
          formData.append('creature_name', creatureData.creature_name);
        }
        if (creatureData.max_hp !== undefined && creatureData.max_hp !== null) {
          formData.append('max_hp', creatureData.max_hp);
        }
        if (creatureData.ac !== undefined && creatureData.ac !== null) {
          formData.append('ac', creatureData.ac);
        }
        if (creatureData.cr !== undefined) {
          formData.append('cr', creatureData.cr);
        }
        if (creatureData.size) {
          formData.append('size', creatureData.size);
        }
        if (creatureData.type) {
          formData.append('type', creatureData.type);
        }
        if (creatureData.description) {
          formData.append('description', creatureData.description);
        }
      }
      
      const response = await roomsAPI.createTokenWithUpload(roomId, formData);
      let newToken = response.data;
      try {
        const tokensRes = await roomsAPI.getTokens(roomId);
        const freshToken = tokensRes.data.find(t => t.id === newToken.id);
        if (freshToken) {
          newToken = freshToken;
        }
      } catch (refreshErr) {
        console.warn('Failed to refresh token data after upload:', refreshErr);
      }

      setTokens(prev => [...prev, newToken]);

      sendData(
        {
          type: 'token:created',
          payload: newToken,
        },
        'game:token'
      );

      return newToken;
    } catch (err) {
      console.error('Failed to create token with upload:', err);
      throw err;
    }
  }, [roomId, sendData]);

  const updateToken = useCallback(async (tokenId, tokenData) => {
    try {
      const response = await roomsAPI.updateToken(roomId, tokenId, tokenData);
      const updatedToken = response.data;
      setTokens(prev => prev.map(t =>
        t.id === tokenId ? { ...t, ...updatedToken } : t
      ));
      
      sendData(
        {
          type: 'token:updated',
          payload: { token_id: tokenId, updates: updatedToken },
        },
        'game:token'
      );
      
      return updatedToken;
    } catch (err) {
      console.error('Failed to update token:', err);
      throw err;
    }
  }, [roomId, sendData]);

  const deleteToken = useCallback(async (tokenId) => {
    try {
      await roomsAPI.deleteToken(roomId, tokenId);
      setTokens(prev => prev.filter(t => t.id !== tokenId));

      sendData(
        {
          type: 'token:deleted',
          payload: { token_id: tokenId },
        },
        'game:token'
      );
    } catch (err) {
      console.error('Failed to delete token:', err);
      throw err;
    }
  }, [roomId, sendData]);

  const updateTokenHp = useCallback(async (tokenId, hpDelta) => {
    try {
      const response = await roomsAPI.updateTokenHp(roomId, tokenId, { hp_delta: hpDelta });
      setTokens(prev => prev.map(t => 
        t.id === tokenId ? { ...t, current_hp: response.data.new_hp } : t
      ));
      return response.data.new_hp;
    } catch (err) {
      console.error('Failed to update token HP:', err);
      throw err;
    }
  }, [roomId]);

  const updateTokenVisibility = useCallback(async (tokenId, isVisible) => {
    try {
      await roomsAPI.updateTokenVisibility(roomId, tokenId, { is_visible: isVisible });
      setTokens(prev => prev.map(t => 
        t.id === tokenId ? { ...t, is_visible: isVisible } : t
      ));
    } catch (err) {
      console.error('Failed to update token visibility:', err);
      throw err;
    }
  }, [roomId]);

  const [bestiary, setBestiary] = useState([]);

  useEffect(() => {
    async function loadBestiary() {
      try {
        const response = await bestiaryAPI.getAll();
        setBestiary(response.data);
      } catch (err) {
        console.error('Failed to load bestiary:', err);
      }
    }

    loadBestiary();
  }, []);

  const value = {
    livekitUrl,
    livekitToken,
    room,
    isConnected,
    participants,
    localParticipant,
    sendData,

    roomId,
    maps,
    tokens,
    activeMapId,
    setActiveMapId,

    chatMessages,
    setChatMessages,

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

    loading,
    error,

    bestiary,

    setMaps,
    setTokens,
    sendTokenMove,
    sendChatMessage,
    sendDiceRoll,
    syncMapAdded,
    syncMapDeleted,
    createToken,
    createTokenWithUpload,
    updateToken,
    deleteToken,
    updateTokenHp,
    updateTokenVisibility,
    isDm,
    audioPlayerState,
    setAudioPlayerState,
    currentPlaylist,
    setCurrentPlaylist,
    sendAudioEvent,
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
