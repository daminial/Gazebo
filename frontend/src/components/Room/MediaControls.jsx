import React, { useState } from 'react';
import { useRoom } from '../../context/RoomContext';
import './MediaControls.css';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from 'react-icons/fa';

export function MediaControls() {
  const { room, localParticipant } = useRoom();
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const toggleAudio = async () => {
    if (!room?.localParticipant) return;

    try {
      if (isAudioEnabled) {
        await room.localParticipant.setMicrophoneEnabled(false);
      } else {
        setIsConnecting(true);
        await room.localParticipant.setMicrophoneEnabled(true);
      }
      setIsAudioEnabled(!isAudioEnabled);
    } catch (err) {
      console.error('Failed to toggle audio:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleVideo = async () => {
    if (!room?.localParticipant) return;

    try {
      if (isVideoEnabled) {
        await room.localParticipant.setCameraEnabled(false);
      } else {
        setIsConnecting(true);
        await room.localParticipant.setCameraEnabled(true);
      }
      setIsVideoEnabled(!isVideoEnabled);
    } catch (err) {
      console.error('Failed to toggle video:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="media-controls">
      <button
        className={`media-btn ${isAudioEnabled ? 'active' : ''}`}
        onClick={toggleAudio}
        disabled={isConnecting}
        title={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
      >
        {isAudioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
      </button>
      <button
        className={`media-btn ${isVideoEnabled ? 'active' : ''}`}
        onClick={toggleVideo}
        disabled={isConnecting}
        title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
      >
        {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
      </button>
    </div>
  );
}
