import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, RoomEvent, DataPacket_Kind } from 'livekit-client';

export function useLiveKit(roomId, token, url) {
  const [room, setRoom] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState(new Map());
  const [error, setError] = useState(null);
  const onDataRef = useRef(null);

  // Подключение к комнате
  const connect = useCallback(async () => {
    if (!token || !url || !roomId) return;

    const newRoom = new Room();

    try {
        await newRoom.connect(url, token, {
          adaptiveStream: true,
          dynacast: true,
          forceTCP: true,
        });

      setIsConnected(true);
      setRoom(newRoom);

      // Получаем текущих участников
      const initialParticipants = new Map();
      newRoom.remoteParticipants.forEach((p, identity) => {
        initialParticipants.set(identity, p);
      });
      setParticipants(initialParticipants);

      // Подписка на события
      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        setParticipants((prev) => new Map(prev).set(participant.identity, participant));
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        setParticipants((prev) => {
          const next = new Map(prev);
          next.delete(participant.identity);
          return next;
        });
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setRoom(null);
        setParticipants(new Map());
      });

      newRoom.on(RoomEvent.Reconnecting, () => {
        console.log('Reconnecting to LiveKit...');
      });

      newRoom.on(RoomEvent.Reconnected, () => {
        console.log('Reconnected to LiveKit');
      });

      // Подписка на входящие данные (data channel)
      newRoom.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
        if (onDataRef.current) {
          onDataRef.current(payload, participant, kind, topic);
        }
      });

    } catch (err) {
      setError(err);
      console.error('LiveKit connection error:', err);
    }
  }, [token, url, roomId]);

  // Отключение
  const disconnect = useCallback(async () => {
    if (room) {
      await room.disconnect();
      setRoom(null);
      setIsConnected(false);
      setParticipants(new Map());
    }
  }, [room]);

  // Отправка данных
  const sendData = useCallback((data, topic = 'game:default') => {
    if (!room || !room.localParticipant) return;

    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    room.localParticipant.publishData(new TextEncoder().encode(payload), {
      topic,
      kind: DataPacket_Kind.RELIABLE,
    });
  }, [room]);

  // Установка обработчика данных извне (через RoomContext)
  const setOnData = useCallback((handler) => {
    onDataRef.current = handler;
  }, []);

  // Авто-подключение при изменении токена
  useEffect(() => {
    if (token && url && roomId && !isConnected) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, url, roomId, isConnected, connect, disconnect]);

  return {
    room,
    isConnected,
    participants,
    localParticipant: room?.localParticipant,
    error,
    connect,
    disconnect,
    sendData,
    setOnData,
  };
}
