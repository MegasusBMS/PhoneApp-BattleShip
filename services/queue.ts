import { tokenStorage } from '@/utils/tokenStorage';

const WS_BASE_URL = 'ws://10.0.2.2:3003';

export interface QueueMessage {
  type: 'join' | 'joined' | 'matched' | 'error';
  token?: string;
  queuePosition?: number;
  gameId?: string;
  playerTokens?: string[];
  data?: any;
  message?: string;
}

export type QueueStatus = 'idle' | 'connecting' | 'in_queue' | 'matched' | 'error';

export class QueueService {
  private ws: WebSocket | null = null;
  private status: QueueStatus = 'idle';
  private queuePosition: number | null = null;
  private gameId: string | null = null;
  private onStatusChange?: (status: QueueStatus) => void;
  private onQueuePositionChange?: (position: number) => void;
  private onMatched?: (gameId: string, data: any) => void;
  private onError?: (error: string) => void;

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      const token = await tokenStorage.getToken();
      if (!token) {
        throw new Error('No token available. Please login first.');
      }

      this.setStatus('connecting');
      this.ws = new WebSocket(`${WS_BASE_URL}/queue`);

      this.ws.onopen = () => {
        // Send token to join queue
        this.ws?.send(JSON.stringify({
          type: 'join',
          token: token,
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const message: QueueMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing queue message:', error);
          this.handleError('Failed to parse server message');
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.handleError('Connection error occurred');
      };

      this.ws.onclose = () => {
        if (this.status !== 'matched' && this.status !== 'error') {
          this.setStatus('idle');
        }
      };
    } catch (error: any) {
      this.handleError(error.message || 'Failed to connect to queue');
      throw error;
    }
  }

  private handleMessage(message: QueueMessage) {
    switch (message.type) {
      case 'joined':
        this.setStatus('in_queue');
        if (message.queuePosition !== undefined) {
          this.queuePosition = message.queuePosition;
          this.onQueuePositionChange?.(message.queuePosition);
        }
        break;

      case 'matched':
        this.setStatus('matched');
        {
          const resolvedGameId = message.gameId ?? message.data?.gameId;
          const gameIdStr = resolvedGameId != null ? String(resolvedGameId) : 'pending';
          this.gameId = gameIdStr;
          const payload = {
            ...(message.data ?? {}),
            playerTokens: message.playerTokens ?? message.data?.playerTokens ?? [],
          };
          if (resolvedGameId != null && payload.gameId == null) {
            payload.gameId = String(resolvedGameId);
          }
          // Close queue socket after match found
          this.disconnect();
          // Notify that match was found
          this.onMatched?.(gameIdStr, payload);
        }
        break;

      case 'error':
        this.handleError(message.message || 'Unknown error from queue service');
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private handleError(errorMessage: string) {
    this.setStatus('error');
    this.onError?.(errorMessage);
  }

  private setStatus(status: QueueStatus) {
    this.status = status;
    this.onStatusChange?.(status);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status = 'idle';
    this.queuePosition = null;
    this.gameId = null;
  }

  // Event handlers
  setOnStatusChange(handler: (status: QueueStatus) => void) {
    this.onStatusChange = handler;
  }

  setOnQueuePositionChange(handler: (position: number) => void) {
    this.onQueuePositionChange = handler;
  }

  setOnMatched(handler: (gameId: string, data: any) => void) {
    this.onMatched = handler;
  }

  setOnError(handler: (error: string) => void) {
    this.onError = handler;
  }

  getStatus(): QueueStatus {
    return this.status;
  }

  getQueuePosition(): number | null {
    return this.queuePosition;
  }

  getGameId(): string | null {
    return this.gameId;
  }
}

// Export singleton instance
export const queueService = new QueueService();

