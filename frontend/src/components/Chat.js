
import React, { useState, useEffect, useRef } from 'react';
import messageService from '../services/messageService';
import { authService } from '../services/auth';
import { usersAPI } from '../services/api';
import './Chat.css';

const Chat = ({ recipientId, sessionId, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [recipient, setRecipient] = useState(null);
  const messagesEndRef = useRef(null);
  const currentUser = authService.getCurrentUser();

  console.log('🔍 Chat component mounted:', { recipientId, sessionId, currentUserId: currentUser?.id });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadRecipient = async () => {
    try {
      console.log('📡 Loading recipient info for:', recipientId);
      const response = await usersAPI.getPublicKey(recipientId);
      setRecipient(response.data);
      console.log('✅ Recipient loaded:', response.data.username);
    } catch (error) {
      console.error('❌ Failed to load recipient:', error);
      setError('Failed to load recipient info');
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('📡 Loading messages for conversation:', recipientId);

      const result = await messageService.getConversationMessages(
        recipientId,
        currentUser.id,
        { limit: 50 }
      );

      console.log('✅ Messages loaded:', result.messages.length);
      setMessages(result.messages);
      setTimeout(scrollToBottom, 100);

    } catch (error) {
      console.error('❌ Failed to load messages:', error);
      setError('Failed to load messages: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!messageText.trim()) return;
    if (!sessionId) {
      setError('No active session. Please complete key exchange first.');
      return;
    }

    try {
      setSending(true);
      setError('');

      if (messageText.length > 200000) {
        setError('Message is too long. Maximum 200KB.');
        return;
      }

      console.log('🔐 Sending encrypted message...');

      await messageService.sendMessage(
        recipientId,
        sessionId,
        messageText,
        currentUser.id
      );

      console.log('✅ Message sent successfully');

      // Optimistic update
      setMessages(prev => [
        ...prev,
        {
          id: 'temp-' + Date.now(),
          from: { _id: currentUser.id, username: currentUser.username },
          to: { _id: recipientId },
          plaintext: messageText,
          timestamp: new Date().toISOString(),
          decrypted: true
        }
      ]);

      setMessageText('');
      setTimeout(scrollToBottom, 100);
      setTimeout(loadMessages, 1000);

    } catch (error) {
      console.error('❌ Failed to send message:', error);
      setError('Failed to send message: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!recipientId || !sessionId) {
      console.error('❌ Missing recipientId or sessionId');
      setError('Missing required parameters');
      return;
    }

    loadRecipient();
    loadMessages();

    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [recipientId, sessionId]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <button onClick={onBack} className="back-button">← Back</button>
        <div className="chat-header-info">
          <h3>{recipient?.username || 'Loading...'}</h3>
          <span className="session-badge">🔐 Encrypted Session</span>
        </div>
      </div>

      <div className="messages-container">
        {loading && messages.length === 0 ? (
          <div className="loading-messages">
            <div className="loading-spinner"></div>
            <p>Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isFromMe = msg.from._id === currentUser.id;
              return (
                <div
                  key={msg.id}
                  className={`message ${isFromMe ? 'message-sent' : 'message-received'} ${msg.error ? 'message-error' : ''}`}
                >
                  <div className="message-content">
                    {!msg.decrypted && (
                      <div className="message-error-badge">⚠️ Decryption failed</div>
                    )}
                    <p>{msg.plaintext}</p>
                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {error && (
        <div className="chat-error">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={sendMessage} className="message-input-form">
        <textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Type a message... (max 200KB)"
          disabled={sending || !sessionId}
          rows={3}
          className="message-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={sending || !messageText.trim() || !sessionId}
          className="send-button"
        >
          {sending ? 'Sending...' : '🔐 Send'}
        </button>
      </form>

      {!sessionId && (
        <div className="no-session-warning">
          ⚠️ No active session. Please complete key exchange first.
        </div>
      )}
    </div>
  );
};

export default Chat;