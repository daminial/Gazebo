import React, { useState, useEffect } from 'react';
import { Track, createLocalTracks } from 'livekit-client';
import { useRoom } from '../../context/RoomContext';
import './VideoGrid.css';

export function VideoGrid() {
  const { room, isConnected } = useRoom();
  const [localTrack, setLocalTrack] = useState(null);
  const [remoteTracks, setRemoteTracks] = useState([]);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);

  // Запрос камеры и микрофона при подключении
  useEffect(() => {
    async function requestLocalTracks() {
      if (!room || !isConnected) return;

      try {
        const tracks = await createLocalTracks({
          audio: true,
          video: true,
        });

        // Публикуем треки в комнате
        for (const track of tracks) {
          if (track.kind === 'video') {
            await room.localParticipant.publishTrack(track);
          } else if (track.kind === 'audio') {
            await room.localParticipant.publishTrack(track);
          }
        }

        setIsCameraEnabled(true);
        setIsMicEnabled(true);
      } catch (err) {
        console.error('Failed to get local tracks:', err);
        setIsCameraEnabled(false);
        setIsMicEnabled(false);
      }
    }

    requestLocalTracks();
  }, [room, isConnected]);

  useEffect(() => {
    if (!room) return;

    const updateTracks = () => {
      // Локальный участник - проверяем наличие публикации камеры
      let local = null;
      if (room.localParticipant) {
        const cameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (cameraPub && cameraPub.track) {
          local = {
            participant: room.localParticipant,
            publication: cameraPub,
            track: cameraPub.track,
          };
        }
      }
      setLocalTrack(local);

      // Удалённые участники
      const remotes = [];
      if (room.remoteParticipants) {
        room.remoteParticipants.forEach((participant) => {
          const cameraPub = participant.getTrackPublication(Track.Source.Camera);
          if (cameraPub && cameraPub.track) {
            remotes.push({
              participant,
              publication: cameraPub,
              track: cameraPub.track,
            });
          }
        });
      }
      setRemoteTracks(remotes);
    };

    updateTracks();

    room.on('trackPublished', updateTracks);
    room.on('trackUnpublished', updateTracks);
    room.on('trackSubscribed', updateTracks);
    room.on('trackUnsubscribed', updateTracks);
    room.on('trackMuted', updateTracks);
    room.on('trackUnmuted', updateTracks);
    room.on('participantConnected', updateTracks);
    room.on('participantDisconnected', updateTracks);

    // События локальных треков
    room.localParticipant.on('trackPublished', updateTracks);
    room.localParticipant.on('trackUnpublished', updateTracks);
    room.localParticipant.on('trackMuted', updateTracks);
    room.localParticipant.on('trackUnmuted', updateTracks);

    return () => {
      room.off('trackPublished', updateTracks);
      room.off('trackUnpublished', updateTracks);
      room.off('trackSubscribed', updateTracks);
      room.off('trackUnsubscribed', updateTracks);
      room.off('trackMuted', updateTracks);
      room.off('trackUnmuted', updateTracks);
      room.off('participantConnected', updateTracks);
      room.off('participantDisconnected', updateTracks);

      room.localParticipant.off('trackPublished', updateTracks);
      room.localParticipant.off('trackUnpublished', updateTracks);
      room.localParticipant.off('trackMuted', updateTracks);
      room.localParticipant.off('trackUnmuted', updateTracks);
    };
  }, [room]);

  // Показываем контейнер всегда, когда есть комната
  if (!room) {
    return null;
  }

  const toggleMicrophone = async () => {
    if (room?.localParticipant) {
      await room.localParticipant.setMicrophoneEnabled(!isMicEnabled);
      setIsMicEnabled(!isMicEnabled);
    }
  };

  const toggleCamera = async () => {
    if (room?.localParticipant) {
      await room.localParticipant.setCameraEnabled(!isCameraEnabled);
      setIsCameraEnabled(!isCameraEnabled);
    }
  };

  return (
    <div className="video-grid">
      {/* Локальное видео */}
      {localTrack ? (
        <VideoTile
          key={localTrack.participant.sid + localTrack.track.sid}
          trackRef={localTrack}
          isMain
          isCameraEnabled={isCameraEnabled}
          isMicEnabled={isMicEnabled}
          onToggleCamera={toggleCamera}
          onToggleMicrophone={toggleMicrophone}
        />
      ) : (
        <div className="video-tile video-tile-main video-placeholder-tile">
          <div className="placeholder-content">
            <span>📹</span>
            <span>Нет камеры</span>
          </div>
          {/* Контролы для локального участника */}
          <div className="placeholder-controls">
            <button
              className={`control-btn ${!isMicEnabled ? 'muted' : ''}`}
              onClick={toggleMicrophone}
              title={isMicEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
            >
              {isMicEnabled ? '🎤' : '🔇'}
            </button>
            <button
              className={`control-btn ${!isCameraEnabled ? 'off' : ''}`}
              onClick={toggleCamera}
              title={isCameraEnabled ? 'Выключить камеру' : 'Включить камеру'}
            >
              {isCameraEnabled ? '📹' : '📷'}
            </button>
          </div>
        </div>
      )}

      {/* Удалённые участники */}
      {remoteTracks.length > 0 && (
        <div className="remote-videos">
          {remoteTracks.map((trackRef) => (
            <VideoTile
              key={trackRef.participant.sid + trackRef.track.sid}
              trackRef={trackRef}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoTile({ trackRef, isMain, isCameraEnabled, isMicEnabled, onToggleCamera, onToggleMicrophone }) {
  const { participant, publication, track } = trackRef;
  const isLocal = participant.isLocal;
  const username = participant.name || participant.identity || 'Unknown';
  const videoRef = React.useRef(null);
  const isVideoMuted = publication?.isMuted ?? false;
  
  // Состояние микрофона
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  useEffect(() => {
    if (videoRef.current && track && !isVideoMuted) {
      track.attach(videoRef.current);
    }
    return () => {
      if (track) {
        track.detach();
      }
    };
  }, [track, isVideoMuted]);

  useEffect(() => {
    if (!participant) return;

    const updateAudioStatus = () => {
      const audioPub = participant.getTrackPublication('microphone');
      setIsAudioMuted(audioPub?.isMuted ?? false);
    };

    updateAudioStatus();

    participant.on('trackMuted', updateAudioStatus);
    participant.on('trackUnmuted', updateAudioStatus);

    return () => {
      participant.off('trackMuted', updateAudioStatus);
      participant.off('trackUnmuted', updateAudioStatus);
    };
  }, [participant]);

  const handleToggleMicrophone = async () => {
    if (onToggleMicrophone) {
      await onToggleMicrophone();
    } else if (isLocal) {
      await participant.setMicrophoneEnabled(!isAudioMuted);
    }
  };

  const handleToggleCamera = async () => {
    if (onToggleCamera) {
      await onToggleCamera();
    } else if (isLocal) {
      await participant.setCameraEnabled(isVideoMuted);
    }
  };

  return (
    <div className={`video-tile ${isMain ? 'video-tile-main' : ''}`}>
      {!isVideoMuted ? (
        <video ref={videoRef} autoPlay muted={isLocal} playsInline />
      ) : (
        <div className="video-off-placeholder">
          <span>📹</span>
        </div>
      )}

      {/* Overlay с именем и контролами */}
      <div className="video-overlay">
        <span className="video-name">
          {isLocal ? 'Вы' : username}
        </span>

        {/* Контролы только для локального участника */}
        {isLocal && (
          <div className="video-controls">
            <button
              className={`control-btn ${isAudioMuted ? 'muted' : ''}`}
              onClick={handleToggleMicrophone}
              title={isAudioMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            >
              {isAudioMuted ? '🔇' : '🎤'}
            </button>
            <button
              className={`control-btn ${isVideoMuted ? 'off' : ''}`}
              onClick={handleToggleCamera}
              title={isVideoMuted ? 'Включить камеру' : 'Выключить камеру'}
            >
              {isVideoMuted ? '📷' : '📹'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
