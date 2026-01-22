import { tokenStorage } from '@/utils/tokenStorage';

const GAME_API_BASE_URL = 'http://10.0.2.2:3002';

export interface SubmitBoardRequest {
  gameId: string;
  board: (string | null)[][];
  token?: string;
}

export interface SubmitBoardResponse {
  success?: boolean;
  [key: string]: any;
}

export interface GameStateResponse {
  status?: string;
  currentTurn?: number | string;
  players?: any;
  [key: string]: any;
}

async function authorizedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { headers, ...rest } = options;
  const finalHeaders = new Headers(headers || {});
  if (!finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  return fetch(`${GAME_API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });
}

export const gameApi = {
  async submitBoard({ gameId, board, token }: SubmitBoardRequest): Promise<SubmitBoardResponse> {
    const authToken = token || (await tokenStorage.getToken());
    if (!authToken) {
      throw new Error('No authentication token available for submit-board');
    }
    let response: Response;
    try {
      response = await authorizedFetch('/submit-board', {
        method: 'POST',
        body: JSON.stringify({
          gameId,
          token: authToken,
          board,
        }),
      });
    } catch (networkError: any) {
      throw new Error(networkError?.message || 'Network error while submitting board');
    }

    if (!response.ok) {
      let errorMessage = `Submit board failed: ${response.status}`;
      try {
        const errorData = await response.json();
        if (typeof errorData?.message === 'string' && errorData.message.trim()) {
          errorMessage = errorData.message;
        } else if (typeof errorData?.error === 'string' && errorData.error.trim()) {
          errorMessage = errorData.error;
        }
      } catch {
        // Ignore JSON parsing issues; keep default message
      }
      throw new Error(errorMessage);
    }

    return response.json().catch(() => ({}));
  },

  async fireAttack({
    gameId,
    x,
    y,
    token,
  }: {
    gameId: string;
    x: number;
    y: number;
    token?: string;
  }): Promise<any> {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('Invalid attack coordinates');
    }
    const authToken = token || (await tokenStorage.getToken());
    if (!authToken) {
      throw new Error('No authentication token available for attack');
    }

    let response: Response;
    try {
      response = await authorizedFetch('/fire', {
        method: 'POST',
        body: JSON.stringify({
          gameId,
          token: authToken,
          x,
          y,
        }),
      });
    } catch (networkError: any) {
      throw new Error(networkError?.message || 'Network error while firing');
    }

    if (!response.ok) {
      let errorMessage = `Attack failed: ${response.status}`;
      try {
        const errorData = await response.json();
        if (typeof errorData?.message === 'string' && errorData.message.trim()) {
          errorMessage = errorData.message;
        } else if (typeof errorData?.error === 'string' && errorData.error.trim()) {
          errorMessage = errorData.error;
        }
      } catch {
        // ignore
      }
      throw new Error(errorMessage);
    }

    return response.json().catch(() => ({}));
  },

  async getState(gameId: string): Promise<GameStateResponse> {
    if (!gameId) {
      throw new Error('gameId is required to load game state');
    }
    const response = await fetch(`${GAME_API_BASE_URL}/state?gameId=${encodeURIComponent(gameId)}`);
    if (!response.ok) {
      let errorMessage = `Failed to load game state: ${response.status}`;
      try {
        const errorData = await response.json();
        if (typeof errorData?.message === 'string' && errorData.message.trim()) {
          errorMessage = errorData.message;
        } else if (typeof errorData?.error === 'string' && errorData.error.trim()) {
          errorMessage = errorData.error;
        }
      } catch {
        // ignore
      }
      throw new Error(errorMessage);
    }
    return response.json().catch(() => ({}));
  },
};
