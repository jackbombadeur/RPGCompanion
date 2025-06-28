import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  sessionId?: number;
  data?: any;
}

export function useWebSocket(sessionId: number | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) {
      console.log('No sessionId provided, skipping WebSocket connection');
      return;
    }

    // Ensure sessionId is a number
    const numericSessionId = Number(sessionId);
    if (isNaN(numericSessionId)) {
      console.error('Invalid sessionId:', sessionId);
      setError('Invalid session ID');
      return;
    }

    // Debug information
    console.log('WebSocket connection details:', {
      sessionId: numericSessionId,
      hostname: window.location.hostname,
      port: window.location.port,
      protocol: window.location.protocol,
      host: window.location.host,
      href: window.location.href
    });

    // More robust WebSocket URL construction
    let wsUrl: string;
    
    try {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // For local development - use clean URL without query parameters
        const port = window.location.port || '5000';
        wsUrl = `ws://localhost:${port}/ws`;
      } else {
        // For production, use secure WebSocket if HTTPS
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.hostname;
        const port = window.location.port;
        wsUrl = `${protocol}//${host}${port ? ':' + port : ''}/ws`;
      }
      
      console.log('Constructed WebSocket URL:', wsUrl);
    } catch (error) {
      console.error('Error constructing WebSocket URL:', error);
      setError('Error constructing WebSocket URL');
      return;
    }
    
    // Validate URL before creating WebSocket
    try {
      new URL(wsUrl);
      console.log('WebSocket URL is valid');
    } catch (error) {
      console.error('Invalid WebSocket URL:', wsUrl, error);
      setError('Invalid WebSocket URL');
      return;
    }
    
    let ws: WebSocket;
    try {
      console.log('Creating WebSocket connection to:', wsUrl);
      ws = new WebSocket(wsUrl);
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setError('Failed to create WebSocket connection');
      return;
    }
    
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected successfully');
      setIsConnected(true);
      setError(null);
      
      // Join the session room
      const joinMessage = {
        type: 'join_session',
        sessionId: numericSessionId
      };
      console.log('Sending join message:', joinMessage);
      ws.send(JSON.stringify(joinMessage));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received WebSocket message:', message);
        setLastMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        setError('Failed to parse message');
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);
      if (event.code !== 1000) {
        setError(`Connection closed: ${event.code} - ${event.reason}`);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error');
      setIsConnected(false);
    };

    return () => {
      console.log('Cleaning up WebSocket connection');
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Component unmounting');
      }
    };
  }, [sessionId]);

  const sendMessage = (message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  };

  return {
    isConnected,
    lastMessage,
    error,
    sendMessage
  };
}
