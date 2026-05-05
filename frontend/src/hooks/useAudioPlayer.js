import { useState, useCallback, useRef, useEffect } from 'react';
import { useRoom } from '../context/RoomContext';
import { roomsAPI } from '../api';

export function useAudioPlayer() {
  const { roomId, isConnected, isDm, sendAudioEvent } = useRoom();
  
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    currentTrack: null,
    currentPlaylist: null,
    playlistIndex: 0,
    trackPositionMs: 0,
    volume: 70,
    repeatMode: 'none',
    shuffle: false,
  });
  
  const [roomTracks, setRoomTracks] = useState([]);
  const [libraryTracks, setLibraryTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  
  const audioRef = useRef(null);

  const loadRoomTracks = useCallback(async () => {
    if (!roomId) return;
    try {
      const response = await roomsAPI.getAudioTracks(roomId);
      setRoomTracks(response.data);
    } catch (err) {
      console.error('Failed to load room tracks:', err);
    }
  }, [roomId]);

  const loadLibrary = useCallback(async (search = '') => {
    try {
      const response = await roomsAPI.getLibraryAudio(search);
      setLibraryTracks(response.data);
    } catch (err) {
      console.error('Failed to load library:', err);
    }
  }, []);

  const loadPlaylists = useCallback(async () => {
    try {
      const response = await roomsAPI.getPlaylists();
      setPlaylists(response.data);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    }
  }, []);

  const loadPlayerState = useCallback(async () => {
    if (!roomId) return;
    try {
      const response = await roomsAPI.getPlayerState(roomId);
      const serverState = response.data;
      
      setPlayerState(prev => ({
        ...prev,
        isPlaying: serverState.is_playing,
        volume: serverState.volume,
        repeatMode: serverState.repeat_mode,
        shuffle: serverState.shuffle,
        playlistIndex: serverState.playlist_index,
        trackPositionMs: serverState.track_position_ms,
        currentPlaylist: serverState.current_playlist || null,
        currentTrack: serverState.current_track ? {
          id: serverState.current_track_id,
          title: serverState.current_track.title,
          artist: serverState.current_track.artist,
          duration_seconds: serverState.current_track.duration_seconds,
          url: serverState.current_track.url || serverState.current_track.public_url,
        } : null,
      }));
    } catch (err) {
      console.error('Failed to load player state:', err);
    }
  }, [roomId]);

  const getTrackUrl = useCallback((track) => {
    if (!track) return null;
    const audio = track.audio || track.audio_file;
    if (audio?.public_url) return audio.public_url;
    if (audio?.storage_key) return `/api/media/${audio.id}`;
    return null;
  }, []);

  const setTrack = useCallback(async (track) => {
    if (!track) return;
    
    const url = track.url || getTrackUrl(track);
    
    setPlayerState(prev => ({
      ...prev,
      currentTrack: { ...track, url },
      trackPositionMs: 0,
      isPlaying: false,
    }));

    if (isDm && isConnected) {
      try {
        await roomsAPI.updatePlayerState(roomId, {
          track_id: track.id,
          action: 'stop',
        });
        
        sendAudioEvent('audio:player_command', {
          action: 'set_track',
          track_id: track.id,
        });
      } catch (err) {
        console.error('Failed to sync track change:', err);
      }
    }
  }, [roomId, isDm, isConnected, sendAudioEvent, getTrackUrl]);

  const play = useCallback(async () => {
    if (!audioRef.current || !playerState.currentTrack?.url) return;
    
    try {
      if (audioRef.current.paused) {
        audioRef.current.currentTime = playerState.trackPositionMs / 1000;
      }
      
      await audioRef.current.play();
      setPlayerState(prev => ({ ...prev, isPlaying: true }));
      
      if (isDm && isConnected) {
        await roomsAPI.updatePlayerState(roomId, { action: 'play' });
        sendAudioEvent('audio:player_command', { action: 'play' });
      }
    } catch (err) {
      console.error('Play failed:', err);
    }
  }, [playerState.currentTrack, playerState.trackPositionMs, roomId, isDm, isConnected, sendAudioEvent]);

  const pause = useCallback(async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
      
      if (isDm && isConnected) {
        await roomsAPI.updatePlayerState(roomId, { action: 'pause' });
        sendAudioEvent('audio:player_command', { action: 'pause' });
      }
    }
  }, [roomId, isDm, isConnected, sendAudioEvent]);

  const stop = useCallback(async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayerState(prev => ({ 
        ...prev, 
        isPlaying: false, 
        trackPositionMs: 0 
      }));
      
      if (isDm && isConnected) {
        await roomsAPI.updatePlayerState(roomId, { action: 'stop' });
        sendAudioEvent('audio:player_command', { action: 'stop' });
      }
    }
  }, [roomId, isDm, isConnected, sendAudioEvent]);

  const nextTrack = useCallback(async () => {
    const playlist = playerState.currentPlaylist;
    if (!playlist?.tracks?.length) {
      const currentIdx = roomTracks.findIndex(t => 
        t.audio_file_id === playerState.currentTrack?.id || 
        t.id === playerState.currentTrack?.id
      );
      
      if (currentIdx >= 0 && currentIdx < roomTracks.length - 1) {
        const nextTrackData = roomTracks[currentIdx + 1];
        const audio = nextTrackData.audio || nextTrackData.audio_file;
        await setTrack({
          id: audio?.id || nextTrackData.audio_file_id,
          title: nextTrackData.name_in_room || audio?.title,
          artist: audio?.artist,
          duration_seconds: audio?.duration_seconds,
          url: getTrackUrl(nextTrackData),
        });
        setTimeout(() => play(), 100);
      }
      return;
    }
    
    const tracks = playlist.tracks;
    const currentIdx = playerState.playlistIndex;
    let nextIdx = currentIdx + 1;
    
    if (nextIdx >= tracks.length) {
      if (playerState.repeatMode === 'all') {
        nextIdx = 0;
      } else {
        await stop();
        return;
      }
    }
    
    const nextTrackData = tracks[nextIdx];
    const audio = nextTrackData.audio;
    await setTrack({
      id: audio?.id || nextTrackData.audio_id,
      title: nextTrackData.custom_title || audio?.title,
      artist: nextTrackData.custom_artist || audio?.artist,
      duration_seconds: audio?.duration_seconds,
      url: audio?.public_url || getTrackUrl(nextTrackData),
    });
    
    setPlayerState(prev => ({ ...prev, playlistIndex: nextIdx }));
    setTimeout(() => play(), 100);
    
    if (isDm && isConnected) {
      await roomsAPI.updatePlayerState(roomId, { action: 'next' });
      sendAudioEvent('audio:player_command', { action: 'next' });
    }
  }, [
    playerState.currentPlaylist, 
    playerState.playlistIndex, 
    playerState.repeatMode, 
    playerState.currentTrack,
    roomTracks,
    play, 
    stop, 
    setTrack,
    getTrackUrl,
    roomId, 
    isDm, 
    isConnected, 
    sendAudioEvent
  ]);

  const prevTrack = useCallback(async () => {
    const playlist = playerState.currentPlaylist;
    if (!playlist?.tracks?.length) {
      const currentIdx = roomTracks.findIndex(t => 
        t.audio_file_id === playerState.currentTrack?.id || 
        t.id === playerState.currentTrack?.id
      );
      
      if (currentIdx > 0) {
        const prevTrackData = roomTracks[currentIdx - 1];
        const audio = prevTrackData.audio || prevTrackData.audio_file;
        await setTrack({
          id: audio?.id || prevTrackData.audio_file_id,
          title: prevTrackData.name_in_room || audio?.title,
          artist: audio?.artist,
          duration_seconds: audio?.duration_seconds,
          url: getTrackUrl(prevTrackData),
        });
        setTimeout(() => play(), 100);
      }
      return;
    }
    
    const tracks = playlist.tracks;
    const currentIdx = playerState.playlistIndex;
    let prevIdx = currentIdx - 1;
    
    if (prevIdx < 0) {
      if (playerState.repeatMode === 'all') {
        prevIdx = tracks.length - 1;
      } else {
        await stop();
        return;
      }
    }
    
    const prevTrackData = tracks[prevIdx];
    const audio = prevTrackData.audio;
    await setTrack({
      id: audio?.id || prevTrackData.audio_id,
      title: prevTrackData.custom_title || audio?.title,
      artist: prevTrackData.custom_artist || audio?.artist,
      duration_seconds: audio?.duration_seconds,
      url: audio?.public_url || getTrackUrl(prevTrackData),
    });
    
    setPlayerState(prev => ({ ...prev, playlistIndex: prevIdx }));
    setTimeout(() => play(), 100);
    
    if (isDm && isConnected) {
      await roomsAPI.updatePlayerState(roomId, { action: 'prev' });
      sendAudioEvent('audio:player_command', { action: 'prev' });
    }
  }, [
    playerState.currentPlaylist, 
    playerState.playlistIndex, 
    playerState.repeatMode, 
    playerState.currentTrack,
    roomTracks,
    play, 
    stop, 
    setTrack,
    getTrackUrl,
    roomId, 
    isDm, 
    isConnected, 
    sendAudioEvent
  ]);

  const setVolume = useCallback(async (volume) => {
    const normalizedVolume = Math.max(0, Math.min(100, volume));
    
    if (audioRef.current) {
      audioRef.current.volume = normalizedVolume / 100;
    }
    setPlayerState(prev => ({ ...prev, volume: normalizedVolume }));
    
    if (isDm && isConnected) {
      try {
        await roomsAPI.updatePlayerState(roomId, { volume: normalizedVolume });
        sendAudioEvent('audio:player_command', { 
          action: 'volume', 
          volume: normalizedVolume 
        });
      } catch (err) {
        console.error('Failed to sync volume:', err);
      }
    }
  }, [roomId, isDm, isConnected, sendAudioEvent]);

  const seekTo = useCallback(async (positionMs) => {
    if (audioRef.current && playerState.currentTrack) {
      const maxPosition = (playerState.currentTrack.duration_seconds || 0) * 1000;
      const clampedPosition = Math.max(0, Math.min(positionMs, maxPosition));
      
      audioRef.current.currentTime = clampedPosition / 1000;
      setPlayerState(prev => ({ ...prev, trackPositionMs: clampedPosition }));
      
      if (isDm && isConnected) {
        await roomsAPI.updatePlayerState(roomId, { seek_position_ms: clampedPosition });
        sendAudioEvent('audio:player_command', { 
          action: 'seek', 
          seek_position_ms: clampedPosition 
        });
      }
    }
  }, [playerState.currentTrack, roomId, isDm, isConnected, sendAudioEvent]);

  const addTrackToRoom = useCallback(async (audioFileId, nameInRoom = null) => {
    try {
      const response = await roomsAPI.addAudioToRoom(roomId, {
        audio_file_id: audioFileId,
        name_in_room: nameInRoom,
      });
      setRoomTracks(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      console.error('Failed to add track to room:', err);
      throw err;
    }
  }, [roomId]);

  const removeTrackFromRoom = useCallback(async (trackId) => {
    try {
      await roomsAPI.removeAudioFromRoom(roomId, trackId);
      setRoomTracks(prev => prev.filter(t => t.id !== trackId));
      
      if (playerState.currentTrack?.id === trackId) {
        await stop();
      }
    } catch (err) {
      console.error('Failed to remove track:', err);
      throw err;
    }
  }, [roomId, playerState.currentTrack, stop]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (playerState.repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        nextTrack();
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [nextTrack, playerState.repeatMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (audioRef.current && playerState.isPlaying) {
        const currentMs = Math.floor(audioRef.current.currentTime * 1000);
        setPlayerState(prev => ({ ...prev, trackPositionMs: currentMs }));
      }
    }, 500);

    return () => clearInterval(interval);
  }, [playerState.isPlaying]);

  useEffect(() => {
    const handleCommand = (event) => {
      const { action, track_id, volume, seek_position_ms } = event.detail;
      
      switch (action) {
        case 'play': 
          play(); 
          break;
        case 'pause': 
          pause(); 
          break;
        case 'stop': 
          stop(); 
          break;
        case 'next':
          nextTrack();
          break;
        case 'prev':
          prevTrack();
          break;
        case 'set_track': {
          const track = roomTracks.find(t => 
            t.audio_file_id === track_id || t.id === track_id
          );
          if (track) {
            const audio = track.audio || track.audio_file;
            setTrack({
              id: audio?.id || track.audio_file_id,
              title: track.name_in_room || audio?.title,
              artist: audio?.artist,
              duration_seconds: audio?.duration_seconds,
              url: getTrackUrl(track),
            });
          }
          break;
        }
        case 'volume': 
          setVolume(volume); 
          break;
        case 'seek': 
          seekTo(seek_position_ms); 
          break;
      }
    };
    
    window.addEventListener('audio-player-command', handleCommand);
    return () => window.removeEventListener('audio-player-command', handleCommand);
  }, [roomTracks, play, pause, stop, nextTrack, prevTrack, setTrack, setVolume, seekTo, getTrackUrl]);

  return {
    playerState,
    roomTracks,
    libraryTracks,
    playlists,
    
    play,
    pause,
    stop,
    setTrack,
    setVolume,
    seekTo,
    nextTrack,
    prevTrack,
    
    loadRoomTracks,
    loadLibrary,
    loadPlaylists,
    loadPlayerState,
    addTrackToRoom,
    removeTrackFromRoom,
    
    audioRef,
    getTrackUrl,
  };
}