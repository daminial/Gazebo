import React, { useState, useEffect, useRef } from 'react';
import { useRoom } from '../../context/RoomContext';
import './ChatPanel.css';
import { FaDiceD6 } from 'react-icons/fa'

export function ChatPanel() {
  const { sendChatMessage, isConnected, chatMessages } = useRoom();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (message.trim() && isConnected) {
      try {
        await sendChatMessage(message.trim());
        setMessage('');
      } catch (err) {
        console.error('Failed to send message:', err);
      }
    }
  };

  const DiceRollMessage = ({ message }) => {
    const diceData = message.diceData;
    if (!diceData) return <p className="message-text">{message.content}</p>;

    const rollValues = diceData.rolls.map(roll => roll.value);
    const rollsString = rollValues.join(' + ');
    
    const modifierString = diceData.modifier !== 0 
      ? (diceData.modifier > 0 ? `+ ${diceData.modifier}` : `- ${Math.abs(diceData.modifier)}`)
      : '';
    
    const formulaString = modifierString 
      ? `(${rollsString}) ${modifierString}`
      : rollsString;

    return (
      <div className="dice-roll-content">
        <div className="dice-roll-header">
          <span className="message-sender">{message.sender}</span> бросил <span className="dice-notation">{diceData.notation}</span>
        </div>
        <div className="dice-roll-formula">
          {formulaString}
        </div>
        <div className="dice-roll-result">
          = <span className="dice-total-value">{diceData.total}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        {!isConnected && <span className="connection-status">⚠ Нет подключения</span>}
      </div>

      <div className="chat-messages">
        {chatMessages.length === 0 ? (
          <div className="chat-empty">
            <p>Сообщений пока нет</p>
            <p className="chat-hint">Отправьте первое сообщение!</p>
          </div>
        ) : (
          <>
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message ${msg.isOwn ? 'own' : ''} ${msg.messageType === 'dice_roll' ? 'dice-message' : ''}`}
              >
                <div className="message-avatar">
                  {msg.messageType === 'dice_roll' 
                    ? <FaDiceD6 /> 
                    : msg.sender.charAt(0).toUpperCase()}
                </div>
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-sender">{msg.sender}</span>
                    <span className="message-time">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {msg.messageType === 'dice_roll' ? (
                    <DiceRollMessage message={msg} />
                  ) : (
                    <p className="message-text">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Введите сообщение..."
          className="chat-input"
          disabled={!isConnected}
        />
      </form>
    </div>
  );
}