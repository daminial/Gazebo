import React, { useState, useEffect, useRef } from 'react';
import { useRoom } from '../../context/RoomContext';
import './ChatPanel.css';

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
                className={`chat-message ${msg.isOwn ? 'own' : ''}`}
              >
                <div className="message-avatar">
                  {msg.sender.charAt(0).toUpperCase()}
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
                  <p className="message-text">{msg.content}</p>
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
        <button type="submit" className="chat-send-btn" disabled={!isConnected || !message.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}
