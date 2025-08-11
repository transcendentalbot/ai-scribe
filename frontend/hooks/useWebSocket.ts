import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

interface UseWebSocketOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: MessageEvent) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    url = process.env.NEXT_PUBLIC_WEBSOCKET_URL || '',
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onOpen,
    onClose,
    onError,
    onMessage,
  } = options;

  // Log warning if WebSocket URL is not configured
  if (!url && !options.url) {
    console.warn('WebSocket URL not configured. Set NEXT_PUBLIC_WEBSOCKET_URL environment variable.');
  }

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const urlRef = useRef(url);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      wsRef.current = new WebSocket(urlRef.current);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setReconnectCount(0);
        onOpen?.();
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        onClose?.();

        // Attempt reconnection
        if (reconnectCount < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting... (attempt ${reconnectCount + 1}/${maxReconnectAttempts})`);
            setReconnectCount(prev => prev + 1);
            connect();
          }, reconnectInterval);
        } else {
          toast.error('Failed to connect to server. Please refresh the page.');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      wsRef.current.onmessage = (message) => {
        setLastMessage(message);
        onMessage?.(message);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      toast.error('Failed to connect to server');
    }
  }, [reconnectCount, maxReconnectAttempts, reconnectInterval, onOpen, onClose, onError, onMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Sending WebSocket message:', data.action || 'default', { sessionId: data.sessionId, hasChunk: !!data.chunk });
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
      toast.error('Connection lost. Please wait for reconnection.');
    }
  }, []);

  // Initialize connection
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Update URL if it changes
  useEffect(() => {
    if (url !== urlRef.current) {
      urlRef.current = url;
      disconnect();
      connect();
    }
  }, [url, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
  };
};