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
        const tracks = await createLocalTracks({ audio: true, video: true });
        for (const track of tracks) {
          await room.localParticipant.publishTrack(track);
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
      let local = null;
      if (room.localParticipant) {
        const cameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (cameraPub && cameraPub.track) {
          local = {
            participant: room.localParticipant,
            videoPublication: cameraPub,
            videoTrack: cameraPub.track,
          };
        }
      }
      setLocalVideoTrack(local);

      const remotes = [];
      if (room.remoteParticipants) {
        room.remoteParticipants.forEach((participant) => {
          const cameraPub = participant.getTrackPublication(Track.Source.Camera);
          const micPub = participant.getTrackPublication(Track.Source.Microphone);
          if (cameraPub || micPub) {
            remotes.push({
              participant,
              videoPublication: cameraPub,
              videoTrack: cameraPub?.track || null,
              audioPublication: micPub,
              audioTrack: micPub?.track || null,
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

  if (!room) return null;

  const toggleMicrophone = async () => {
    if (room?.localParticipant) {
      try {
        await room.localParticipant.setMicrophoneEnabled(!isMicEnabled);
        setIsMicEnabled(!isMicEnabled);
      } catch (err) {
        console.error('Microphone toggle error:', err);
      }
    }
  };

  const toggleCamera = async () => {
    if (room?.localParticipant) {
      try {
        await room.localParticipant.setCameraEnabled(!isCameraEnabled);
        setIsCameraEnabled(!isCameraEnabled);
      } catch (err) {
        console.error('Camera toggle error:', err);
      }
    }
  };

  return (
    <div className="video-grid">
      {localVideoTrack ? (
        <VideoTile
          key={localVideoTrack.participant.sid}
          trackRef={localVideoTrack}
          isMain
          isCameraEnabled={isCameraEnabled}
          isMicEnabled={isMicEnabled}
          onToggleCamera={toggleCamera}
          onToggleMicrophone={toggleMicrophone}
        />
      ) : (
        <div className="video-tile video-tile-main video-placeholder-tile">
          <div className="placeholder-content"><FaVideoSlash /><span>Нет камеры</span></div>
          <div className="placeholder-controls">
            <button className={`control-btn ${!isMicEnabled ? 'muted' : ''}`} onClick={toggleMicrophone} title={isMicEnabled ? 'Выключить микрофон' : 'Включить микрофон'}>
              {isMicEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
            </button>
            <button className={`control-btn ${!isCameraEnabled ? 'off' : ''}`} onClick={toggleCamera} title={isCameraEnabled ? 'Выключить камеру' : 'Включить камеру'}>
              {isCameraEnabled ? <FaVideo /> : <FaVideoSlash />}
            </button>
          </div>
        </div>
      )}

      {remoteTracks.length > 0 && (
        <div className="remote-videos">
          {remoteTracks.map((trackRef) => (
            <VideoTile key={trackRef.participant.sid} trackRef={trackRef} />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoTile({ trackRef, isMain, isCameraEnabled, isMicEnabled, onToggleCamera, onToggleMicrophone }) {
  const { participant, videoPublication, videoTrack, audioPublication, audioTrack } = trackRef;
  const isLocal = participant.isLocal;
  const videoRef = React.useRef(null);
  const audioRef = React.useRef(null);
  const [isAudioMuted, setIsAudioMuted] = useState(audioPublication?.isMuted ?? false);
  const [isVideoMuted, setIsVideoMuted] = useState(videoPublication?.isMuted ?? false);

  const username = (() => {
    if (isLocal) return 'Вы';
    try {
      if (participant?.metadata) {
        const meta = typeof participant.metadata === 'string' ? JSON.parse(participant.metadata) : participant.metadata;
        return meta.username || participant.identity || 'Unknown';
      }
    } catch (e) {}
    return participant?.identity || 'Unknown';
  })();

  useEffect(() => {
    if (videoTrack && videoRef.current && !isVideoMuted) {
      videoTrack.attach(videoRef.current);
    }
    if (audioTrack && audioRef.current) {
      audioTrack.attach(audioRef.current);
    }
    return () => {
      if (videoTrack) videoTrack.detach();
      if (audioTrack) audioTrack.detach();
    };
  }, [videoTrack, audioTrack, isVideoMuted]);

  useEffect(() => {
    if (!participant) return;
    const updateMute = () => {
      const micPub = participant.getTrackPublication(Track.Source.Microphone);
      setIsAudioMuted(micPub?.isMuted ?? false);
      const camPub = participant.getTrackPublication(Track.Source.Camera);
      setIsVideoMuted(camPub?.isMuted ?? false);
    };
    updateMute();
    participant.on('trackMuted', updateMute);
    participant.on('trackUnmuted', updateMute);
    return () => {
      participant.off('trackMuted', updateMute);
      participant.off('trackUnmuted', updateMute);
    };
  }, [participant]);

  return (
    <div className={`video-tile ${isMain ? 'video-tile-main' : ''}`}>
      {videoTrack && !isVideoMuted ? (
        <video ref={videoRef} autoPlay muted={isLocal} playsInline />
      ) : (
        <div className="video-off-placeholder"><FaVideoSlash /></div>
      )}
      {audioTrack && <audio ref={audioRef} autoPlay playsInline />}
      <div className="video-overlay">
        <span className="video-name">{username}</span>
        {isMain && (
          <div className="video-controls">
            <button className={`control-btn ${isAudioMuted ? 'muted' : ''}`} onClick={onToggleMicrophone} title={isAudioMuted ? 'Включить микрофон' : 'Выключить микрофон'}>
              {isAudioMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
            </button>
            <button className={`control-btn ${isVideoMuted ? 'off' : ''}`} onClick={onToggleCamera} title={isVideoMuted ? 'Включить камеру' : 'Выключить камеру'}>
              {isVideoMuted ? <FaVideoSlash /> : <FaVideo />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}