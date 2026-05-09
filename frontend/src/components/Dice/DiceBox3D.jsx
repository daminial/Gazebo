import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import DiceBox from '@3d-dice/dice-box';

const DiceBox3D = forwardRef(({ 
  onRollComplete, 
  onReady,
  theme = 'default',
  themeColor = '#3498db',
  scale = 6,
  gravity = 1.0,
  throwForce = 5,
  spinForce = 6,
  enableShadows = true,
  debug = false 
}, ref) => {
  const containerRef = useRef(null);
  const diceBoxRef = useRef(null);
  const onRollCompleteRef = useRef(onRollComplete);
  const [isReady, setIsReady] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [error, setError] = useState(null);
  const [currentResults, setCurrentResults] = useState(null);
  
  useEffect(() => {
    onRollCompleteRef.current = onRollComplete;
  }, [onRollComplete]);

  const audioContextRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const soundIntervalRef = useRef(null);
  const rollStartTimeRef = useRef(0);
  const isRollingRef = useRef(false);
  const diceCountRef = useRef(1);

  const playCollisionSound = (intensity = 1.0) => {
    if (!audioContextRef.current || !audioUnlockedRef.current) return;
    
    const audioContext = audioContextRef.current;
    if (audioContext.state !== 'running') return;
    
    try {
      const duration = 0.04;
      const bufferSize = audioContext.sampleRate * duration;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      
      const baseFreq = 140 + (intensity * 40) + (Math.random() * 50);
      
      for (let i = 0; i < bufferSize; i++) {
        const t = i / audioContext.sampleRate;
        const envelope = Math.exp(-t * 80);
        
        const tone = Math.sin(2 * Math.PI * baseFreq * t) * 0.5;
        const noise = (Math.random() * 2 - 1) * 0.7;
        
        data[i] = (tone + noise) * envelope * intensity;
      }
      
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1000;
      
      const gain = audioContext.createGain();
      gain.gain.value = 0.18 * Math.min(intensity, 1.5);
      
      source.connect(filter);
      filter.connect(gain);
      gain.connect(audioContext.destination);
      
      source.start();
    } catch (err) {
    }
  };

  const startSoundLoop = (diceCount = 1) => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
    }
    
    rollStartTimeRef.current = Date.now();
    isRollingRef.current = true;
    diceCountRef.current = diceCount;
    
    const baseIntensity = Math.min(0.8 + (diceCount * 0.05), 1.3);
    playCollisionSound(baseIntensity);
    
    if (diceCount >= 3) {
      setTimeout(() => playCollisionSound(baseIntensity * 0.9), 40);
    }
    if (diceCount >= 5) {
      setTimeout(() => playCollisionSound(baseIntensity * 0.8), 80);
    }
    if (diceCount >= 8) {
      setTimeout(() => playCollisionSound(baseIntensity * 0.7), 120);
    }
    if (diceCount >= 12) {
      setTimeout(() => playCollisionSound(baseIntensity * 0.6), 160);
    }
    
    soundIntervalRef.current = setInterval(() => {
      if (!isRollingRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
        return;
      }
      
      const elapsed = (Date.now() - rollStartTimeRef.current) / 1000;
      
      if (elapsed > 5) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
        return;
      }
      
      const diceCount = diceCountRef.current;
      let intensity;
      let probability;
      
      if (elapsed < 1.0) {
        intensity = 0.9 - (elapsed * 0.2) + (diceCount * 0.03);
        probability = 0.4 + (diceCount * 0.03);
      } else if (elapsed < 2.5) {
        intensity = 0.7 - ((elapsed - 1.0) * 0.25) + (diceCount * 0.02);
        probability = 0.25 + (diceCount * 0.02);
      } else {
        intensity = 0.45 - ((elapsed - 2.5) * 0.12) + (diceCount * 0.01);
        probability = 0.12 + (diceCount * 0.01);
      }
      
      intensity = Math.min(Math.max(intensity, 0.1), 1.5);
      probability = Math.min(probability, 0.85);
      
      if (Math.random() < probability) {
        playCollisionSound(intensity);
      }
      
    }, 100);
  };

  const stopSoundLoop = () => {
    isRollingRef.current = false;
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
  };
  const unlockAudio = async () => {
    if (audioUnlockedRef.current) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      audioUnlockedRef.current = true;
    } catch (err) {
      console.warn('Аудио не удалось разблокировать:', err);
    }
  };

  useEffect(() => {
    const events = ['click', 'touchstart', 'keydown'];
    const handleInteraction = () => {
      unlockAudio();
      events.forEach(e => document.removeEventListener(e, handleInteraction));
    };
    events.forEach(e => document.addEventListener(e, handleInteraction));
    
    return () => {
      events.forEach(e => document.removeEventListener(e, handleInteraction));
      if (audioContextRef.current) audioContextRef.current.close();
      stopSoundLoop();
    };
  }, []);

  useEffect(() => {
    const initDiceBox = async () => {
      try {
        const container = document.querySelector('#dice-canvas-main');
        if (container) {
          const oldCanvases = container.querySelectorAll('canvas');
          oldCanvases.forEach(c => c.remove());
        }
        
        const box = new DiceBox({
          container: '#dice-canvas-main',
          assetPath: '/assets/dice-box/',
          theme, themeColor, scale, gravity,
          lightIntensity: 0.8,
          enableShadows,
          throwForce, spinForce,
          sound: false,
          settleTimeout: 5000,
          linearDamping: 0.5, 
          angularDamping: 0.4,
          restitution: 0.0,  
          friction: 0.8,
          mass: 1.0,
          startingHeight: 8  
        });

        await box.init();
        
        const originalRoll = box.roll;
        box.roll = function(notation, diceCount = 1, ...args) {
          setIsRolling(true);
          startSoundLoop(diceCount);
          return originalRoll.call(this, notation, ...args);
        };
        
       box.onRollComplete = (results) => {
          try {
            stopSoundLoop();
            setIsRolling(false);
            
            let diceArray = [];

            if (results && Array.isArray(results)) {
              for (const item of results) {
                if (item.rolls && Array.isArray(item.rolls)) {
                  for (const rollValue of item.rolls) {
                    let actualValue = rollValue;
                    let actualSides = item.sides;
                    
                    if (typeof rollValue === 'object' && rollValue !== null) {
                      actualValue = rollValue.value || rollValue.val || 0;
                      actualSides = rollValue.sides || item.sides;
                    }
                    
                    diceArray.push({
                      sides: actualSides,
                      value: actualValue,
                      rollId: `${item.id}_${actualValue}`
                    });
                  }
                } else if (item.value !== undefined && item.sides !== undefined) {
                  let actualValue = item.value;
                  let actualSides = item.sides;
                  
                  if (typeof actualValue === 'object' && actualValue !== null) {
                    actualValue = actualValue.value || actualValue.val || 0;
                    actualSides = actualValue.sides || item.sides;
                  }
                  
                  diceArray.push({
                    sides: actualSides,
                    value: actualValue,
                    rollId: item.rollId || item.id
                  });
                }
              }
            }

            const total = diceArray.reduce((sum, die) => {
              const value = typeof die.value === 'number' ? die.value : 0;
              return sum + value;
            }, 0);

            const formattedResults = {
              total: total,
              dice: diceArray,
              raw: results,
              timestamp: Date.now()
            };

            setCurrentResults(formattedResults);

            console.log('🎯 DiceBox вызывает onRollComplete через ref');
            if (onRollCompleteRef.current) {
              onRollCompleteRef.current(formattedResults);
            }
          } catch (err) {
            console.error('Ошибка в onRollComplete:', err);
            setIsRolling(false);
            stopSoundLoop();
          }
        };

        diceBoxRef.current = box;
        setIsReady(true);
        if (onReady) onReady(box);
        
      } catch (err) {
        console.error('Ошибка инициализации DiceBox:', err.message);
        setError(err.message);
      }
    };

    const timer = setTimeout(initDiceBox, 100);
    
    return () => {
      clearTimeout(timer);
      stopSoundLoop();
      if (diceBoxRef.current) {
        try {
          if (typeof diceBoxRef.current.clear === 'function') {
            diceBoxRef.current.clear();
          }
          const container = document.querySelector('#dice-canvas-main');
          if (container) {
            const canvases = container.querySelectorAll('canvas');
            canvases.forEach(c => c.remove());
          }
          if (typeof diceBoxRef.current.destroy === 'function') {
            diceBoxRef.current.destroy();
          }
        } catch (e) {}
        diceBoxRef.current = null;
      }
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [theme, themeColor, scale, gravity, throwForce, spinForce, enableShadows]);

  useImperativeHandle(ref, () => ({
    roll: (notation, diceCount = 1) => {
      if (!diceBoxRef.current || !isReady || isRolling) return false;
      
      setIsRolling(true);
      setCurrentResults(null);
      const result = diceBoxRef.current.roll(notation);

      if (!result && diceBoxRef.current.addDice) {
        diceBoxRef.current.clear();
        
        const diceRegex = /(\d+)d(\d+)/g;
        let match;
        const diceToAdd = [];
        
        while ((match = diceRegex.exec(notation)) !== null) {
          const count = parseInt(match[1], 10);
          const sides = parseInt(match[2], 10);
          for (let i = 0; i < count; i++) {
            diceToAdd.push({ sides });
          }
        }
        
        if (diceToAdd.length > 0) {
          diceBoxRef.current.addDice(diceToAdd);
          diceBoxRef.current.roll();
        }
      }
      
      return true;
    },
    
    clear: () => {
      if (diceBoxRef.current && isReady) {
        diceBoxRef.current.clear();
        setCurrentResults(null);
        setIsRolling(false);
        stopSoundLoop();
        return true;
      }
      return false;
    },
    
    getInternalBox: () => diceBoxRef.current,
    isReady: () => isReady,
    isRolling: () => isRolling,
    getResults: () => currentResults,
  }), [isReady, isRolling, currentResults]);

  if (error) {
    return (
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'white',
        padding: '20px',
        borderRadius: '10px',
        zIndex: 2000
      }}>
        <h4>⚠️ Ошибка загрузки костей</h4>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Перезагрузить
        </button>
      </div>
    );
  }

  return (
    <>
      <div 
        id="dice-canvas-main"
        ref={containerRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 998
        }}
      />
      
      {!isReady && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(26, 26, 46, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          color: 'white'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid rgba(255,255,255,0.2)',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }} />
          <p>Загрузка комнаты...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </>
  );
});

DiceBox3D.displayName = 'DiceBox3D';
export default DiceBox3D;