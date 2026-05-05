import React, { useEffect, useState, useRef } from 'react';
import { useRoom } from '../../context/RoomContext';
import { roomsAPI } from '../../api';
import { FaPlay, FaPause, FaStop, FaForward, FaBackward, FaVolumeUp, FaMusic, FaPlus } from 'react-icons/fa';
import { TbRepeat, TbRepeatOnce, TbRepeatOff } from 'react-icons/tb';
import './AudioPlayer.css';

export function AudioPlayer() {
  const { roomId } = useRoom();
  const audioRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(70);
  const [repeatMode, setRepeatMode] = useState('none');
  
  const [roomTracks, setRoomTracks] = useState([]);
  const [libraryTracks, setLibraryTracks] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!roomId) return;
    
    const loadTracks = async () => {
      try {
        const response = await roomsAPI.getAudioTracks(roomId);
        setRoomTracks(response.data);
      } catch (err) {
        console.error('Failed to load room tracks:', err);
      }
    };
    
    loadTracks();
  }, [roomId]);

  const loadLibrary = async (search = '') => {
    try {
      const response = await roomsAPI.getLibraryAudio(search);
      setLibraryTracks(response.data);
    } catch (err) {
      console.error('Failed to load library:', err);
    }
  };

  useEffect(() => {
    if (showLibrary) {
      loadLibrary(searchQuery);
    }
  }, [showLibrary, searchQuery]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      
      if (repeatMode === 'one') {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().then(() => setIsPlaying(true));
        }
      } else {
        handleNext();
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentTrack, repeatMode, roomTracks]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const handlePlay = async () => {
    if (!audioRef.current || !currentTrack?.url) {
      console.error('No track or URL');
      return;
    }

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Play failed:', err);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const handleSetTrack = (track) => {
    const url = track.audio?.url || track.audio_url || `/api/media/audio/${track.audio_file_id || track.audio?.id}`;
    
    const trackData = {
      id: track.audio_file_id || track.audio?.id,
      title: track.name_in_room || track.audio?.title || 'Без названия',
      artist: track.audio?.artist || 'Неизвестен',
      duration_seconds: track.audio?.duration_seconds || 0,
      url: url,
    };
    
    setCurrentTrack(trackData);
    setIsPlaying(false);
    setCurrentTime(0);
    
    if (audioRef.current && url) {
      audioRef.current.src = url;
      audioRef.current.load();
    }
  };

  const handleVolumeChange = (value) => {
    setVolumeState(Number(value));
  };

  const handleSeek = (value) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Number(value);
      setCurrentTime(Number(value));
    }
  };

  const handleNext = () => {
    if (roomTracks.length === 0) return;
    
    const currentIdx = roomTracks.findIndex(t => 
      (t.audio_file_id || t.audio?.id) === currentTrack?.id
    );
    
    let nextIdx = currentIdx + 1;
    
    if (nextIdx >= roomTracks.length) {
      if (repeatMode === 'all') {
        nextIdx = 0;
      } else {
        handleStop();
        return;
      }
    }
    
    handleSetTrack(roomTracks[nextIdx]);
    setTimeout(() => {
      if (audioRef.current && audioRef.current.src) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
      }
    }, 100);
  };

  const handlePrev = () => {
    if (roomTracks.length === 0) return;
    
    const currentIdx = roomTracks.findIndex(t => 
      (t.audio_file_id || t.audio?.id) === currentTrack?.id
    );
    
    if (currentTime > 3) {
      handleSeek(0);
      return;
    }
    
    let prevIdx = currentIdx - 1;
    
    if (prevIdx < 0) {
      if (repeatMode === 'all') {
        prevIdx = roomTracks.length - 1;
      } else {
        handleSeek(0);
        return;
      }
    }
    
    handleSetTrack(roomTracks[prevIdx]);
    setTimeout(() => {
      if (audioRef.current && audioRef.current.src) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
      }
    }, 100);
  };

  const handleRepeatToggle = () => {
    setRepeatMode(prev => {
      if (prev === 'none') return 'all';
      if (prev === 'all') return 'one';
      return 'none';
    });
  };

  const handleAddTrack = async (audioFile) => {
    try {
      const response = await roomsAPI.addAudioToRoom(roomId, {
        audio_file_id: audioFile.id,
        name_in_room: audioFile.title,
      });
      setRoomTracks(prev => [...prev, response.data]);
      setShowLibrary(false);
    } catch (err) {
      console.error('Failed to add track:', err);
    }
  };

  const handleRemoveTrack = async (trackId) => {
    try {
      await roomsAPI.removeAudioFromRoom(roomId, trackId);
      setRoomTracks(prev => prev.filter(t => t.id !== trackId));
      
      if (currentTrack?.id === trackId) {
        handleStop();
        setCurrentTrack(null);
      }
    } catch (err) {
      console.error('Failed to remove track:', err);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

    try {
      const response = await roomsAPI.uploadAudio(formData);
      await handleAddTrack(response.data);
      loadLibrary(searchQuery);
    } catch (err) {
      console.error('Failed to upload audio:', err);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const RepeatIcon = () => {
    switch (repeatMode) {
      case 'one': return <TbRepeatOnce size={20} />;
      case 'all': return <TbRepeat size={20} />;
      default: return <TbRepeatOff size={20} opacity={0.4} />;
    }
  };

  return (
    <div className="audio-player-panel">
      <audio ref={audioRef} preload="auto" />
      
      {/* Заголовок */}
      <div className="audio-header">
        <FaMusic />
        <h3>Музыка</h3>
        <button className="btn-add-track" onClick={() => setShowLibrary(true)}>
          <FaPlus /> Добавить
        </button>
      </div>

      {/* Сейчас играет */}
      <div className="now-playing">
        <div className="track-cover">
          <div className="track-cover-placeholder">
            <FaMusic />
          </div>
        </div>
        <div className="track-info">
          <div className="track-title">
            {currentTrack?.title || 'Нет трека'}
          </div>
          <div className="track-artist">
            {currentTrack?.artist || 'Выберите трек'}
          </div>
        </div>
      </div>

      {/* Прогресс-бар */}
      <div className="progress-bar-container">
        <span className="time">{formatTime(currentTime)}</span>
        <input
          type="range"
          className="progress-bar"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={(e) => handleSeek(e.target.value)}
        />
        <span className="time">{formatTime(duration)}</span>
      </div>

      {/* Контролы */}
      <div className="player-controls">
        
        <button className="audio-control-btn" onClick={handlePrev}>
          <FaBackward />
        </button>
        <button className="audio-control-btn play-btn" onClick={isPlaying ? handlePause : handlePlay}>
          {isPlaying ? <FaPause /> : <FaPlay />}
        </button>
        <button className="audio-control-btn" onClick={handleNext}>
          <FaForward />
        </button>
        <button 
          className={`audio-control-btn repeat-btn ${repeatMode !== 'none' ? 'active' : ''}`}
          onClick={handleRepeatToggle}
          title={repeatMode === 'none' ? 'Повтор выключен' : repeatMode === 'all' ? 'Повтор плейлиста' : 'Повтор одного трека'}
        >
          <RepeatIcon />
        </button>
      </div>

      {/* Громкость */}
      <div className="volume-control">
        <FaVolumeUp />
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => handleVolumeChange(e.target.value)}
          className="volume-slider"
        />
        <span>{volume}%</span>
      </div>

      {/* Плейлист */}
      <div className="playlist-section">
        <h4>Плейлист комнаты</h4>
        <div className="tracks-list">
          {roomTracks.length === 0 ? (
            <div className="empty-message">Нет треков в комнате</div>
          ) : (
            roomTracks.map(track => (
              <div
                key={track.id}
                className={`track-item ${currentTrack?.id === track.audio_file_id ? 'active' : ''}`}
                onClick={() => handleSetTrack(track)}
              >
                <div className="track-item-title">
                  {track.name_in_room || track.audio?.title || 'Без названия'}
                </div>
                <button
                  className="btn-remove-track"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTrack(track.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Модальное окно библиотеки */}
      {showLibrary && (
        <div className="modal-overlay" onClick={() => setShowLibrary(false)}>
          <div className="library-modal" onClick={e => e.stopPropagation()}>
            <div className="library-header">
              <h3>Библиотека аудио</h3>
              <button className="modal-close" onClick={() => setShowLibrary(false)}>✕</button>
            </div>
            
            <div className="library-search">
              <input
                type="text"
                placeholder="Поиск аудио..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="library-list">
              {libraryTracks.length === 0 ? (
                <div className="empty-message">Нет аудио в библиотеке</div>
              ) : (
                libraryTracks.map(audio => (
                  <div key={audio.id} className="library-item">
                    <div className="library-item-info">
                      <span className="library-item-title">{audio.title}</span>
                      <span className="library-item-artist">{audio.artist}</span>
                    </div>
                    <button className="btn-add-to-room" onClick={() => handleAddTrack(audio)}>
                      <FaPlus />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="upload-section">
              <input type="file" accept="audio/*" onChange={handleUpload} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}