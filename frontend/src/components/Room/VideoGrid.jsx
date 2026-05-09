import React, { useState, useEffect } from 'react';
import { Track, createLocalTracks } from 'livekit-client';
import { useRoom } from '../../context/RoomContext';
import './VideoGrid.css';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from 'react-icons/fa';

export function VideoGrid() {
  const { room, isConnected } = useRoom();
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [remoteTracks, setRemoteTracks] = useState([]);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);

  useEffect(() => {
    async function requestLocalTracks() {
      if (!room || !isConnected) return;

      try {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true 
          });
          audioStream.getTracks().forEach(track => track.stop());
          console.log('Microphone permission granted');
        } catch (audioErr) {
          console.error('Microphone permission denied:');
          setIsMicEnabled(false);
        }

        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: true 
          });
          videoStream.getTracks().forEach(track => track.stop());
          console.log('Camera permission granted');
        } catch (videoErr) {
          console.error('Camera permission denied:');
          setIsCameraEnabled(false);
        }
        const tracks = await createLocalTracks({
          audio: true,
          video: true,
        });
        
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
        console.error('Failed to get local tracks:');
        setIsCameraEnabled(false);
        setIsMicEnabled(false);
      }
    }

    requestLocalTracks();
  }, [room, isConnected]);

  useEffect(() => {
    if (!room) return;

    const updateTracks = () => {
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
      setLocalVideoTrack(local);

      const remotes = [];
      if (room.remoteParticipants) {
        room.remoteParticipants.forEach((participant) => {
          const cameraPub = participant.getTrackPublication(Track.Source.Camera);
          if (cameraPub) {
            remotes.push({
              participant,
              publication: cameraPub,
              track: cameraPub.track || null,
            });
          }
        });
      }
      
      const uniqueRemotes = [];
      const seen = new Set();
      remotes.forEach(r => {
        if (!seen.has(r.participant.identity)) {
          seen.add(r.participant.identity);
          uniqueRemotes.push(r);
        }
      });
      
      setRemoteTracks(uniqueRemotes);
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

  if (!room) {
    return null;
  }

  const toggleMicrophone = async () => {
    if (room?.localParticipant) {
      try {
        await room.localParticipant.setMicrophoneEnabled(!isMicEnabled);
        setIsMicEnabled(!isMicEnabled);
      } catch (err) {
        console.error('Microphone toggle error:');
        if (err.name === 'NotAllowedError') {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            await room.localParticipant.setMicrophoneEnabled(!isMicEnabled);
            setIsMicEnabled(!isMicEnabled);
          } catch (permErr) {
            alert('Пожалуйста, разрешите доступ к микрофону в настройках браузера');
          }
        }
      }
    }
  };

  const toggleCamera = async () => {
    if (room?.localParticipant) {
      try {
        await room.localParticipant.setCameraEnabled(!isCameraEnabled);
        setIsCameraEnabled(!isCameraEnabled);
      } catch (err) {
        console.error('Camera toggle error:');
        if (err.name === 'NotAllowedError') {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(t => t.stop());
            await room.localParticipant.setCameraEnabled(!isCameraEnabled);
            setIsCameraEnabled(!isCameraEnabled);
          } catch (permErr) {
            alert('Пожалуйста, разрешите доступ к камере в настройках браузера');
          }
        }
      }
    }
  };

  return (
    <div className="video-grid">
      {/* Локальное видео */}
      {localVideoTrack ? (
        <VideoTile
          key={localVideoTrack.participant.sid + localVideoTrack.track.sid}
          trackRef={localVideoTrack}
          isMain
          isCameraEnabled={isCameraEnabled}
          isMicEnabled={isMicEnabled}
          onToggleCamera={toggleCamera}
          onToggleMicrophone={toggleMicrophone}
        />
      ) : (
        <div className="video-tile video-tile-main video-placeholder-tile">
          <div className="placeholder-content">
            <FaVideoSlash />
            <span>Нет камеры</span>
          </div>
          {/* Контролы для локального участника */}
          <div className="placeholder-controls">
            <button
              className={`control-btn ${!isMicEnabled ? 'muted' : ''}`}
              onClick={toggleMicrophone}
              title={isMicEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
            >
              {isMicEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
            </button>
            <button
              className={`control-btn ${!isCameraEnabled ? 'off' : ''}`}
              onClick={toggleCamera}
              title={isCameraEnabled ? 'Выключить камеру' : 'Включить камеру'}
            >
              {isCameraEnabled ? <FaVideo /> : <FaVideoSlash />}
            </button>
          </div>
        </div>
      )}

      {/* Удалённые участники */}
      {remoteTracks.filter(tr => tr.track?.kind === 'video').length > 0 && (
        <div className="remote-videos">
          {remoteTracks.filter(tr => tr.track?.kind === 'video').map((trackRef) => (
            <VideoTile
              key={trackRef.participant.sid + trackRef.track.sid}
              trackRef={trackRef}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function VideoTile({ trackRef, isMain, isCameraEnabled, isMicEnabled, onToggleCamera, onToggleMicrophone }) {
  const { participant, publication, track } = trackRef;
  const isLocal = participant.isLocal;

  const getUsernameFromMetadata = (p) => {
    try {
      if (p?.metadata) {
        const meta = typeof p.metadata === 'string'
          ? JSON.parse(p.metadata)
          : p.metadata;
        return meta.username || p.identity || 'Unknown';
      }
    } catch (e) {
      console.warn('Failed to parse metadata:', e);
    }
    return p?.identity || 'Unknown';
  };

  const username = isLocal ? 'Вы' : getUsernameFromMetadata(participant);
  const videoRef = React.useRef(null);
  const audioRef = React.useRef(null);
  const isVideoTrack = track?.kind === 'video';
  const isAudioTrack = track?.kind === 'audio';
  const isVideoMuted = publication?.isMuted ?? false;
  
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  useEffect(() => {
    if (track) {
      if (isVideoTrack && videoRef.current && !isVideoMuted) {
        track.attach(videoRef.current);
      }
      if (isAudioTrack && audioRef.current) {
        track.attach(audioRef.current);
      }
    }

    return () => {
      if (track) {
        track.detach();
      }
    };
  }, [track, isVideoMuted, isVideoTrack, isAudioTrack]);

  useEffect(() => {
    if (!participant) return;

    const updateAudioStatus = () => {
      const audioPub = participant.getTrackPublication(Track.Source.Microphone);
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

  const handleToggleMicrophone = () => {
    if (onToggleMicrophone) {
      onToggleMicrophone();
    }
  };

  const handleToggleCamera = () => {
    if (onToggleCamera) {
      onToggleCamera();
    }
  };

  return (
    <div className={`video-tile ${isMain ? 'video-tile-main' : ''}`}>
      {isVideoTrack ? (
        !isVideoMuted ? (
          <video ref={videoRef} autoPlay muted={isLocal} playsInline />
        ) : (
          <div className="video-off-placeholder">
            <FaVideoSlash />
          </div>
        )
      ) : (
        <audio ref={audioRef} autoPlay muted={isLocal} />
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
              {isAudioMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
            </button>
            <button
              className={`control-btn ${isVideoMuted ? 'off' : ''}`}
              onClick={handleToggleCamera}
              title={isVideoMuted ? 'Включить камеру' : 'Выключить камеру'}
            >
              {isVideoMuted ? <FaVideoSlash /> : <FaVideo />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}