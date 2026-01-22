import { tokenStorage } from '@/utils/tokenStorage';

const API_BASE_URL = 'http://10.0.2.2:3001';

export interface SignupRequest {
  email: string;
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface IntrospectRequest {
  token: string;
}

export interface AuthResponse {
  token: string;
  [key: string]: any;
}

export interface IntrospectResponse {
  valid: boolean;
  [key: string]: any;
}

export const authService = {
  async signup(data: SignupRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Signup failed' }));
        throw new Error(errorData.message || `Signup failed: ${response.status}`);
      }

      const result: AuthResponse = await response.json();
      
      // Save token if present
      if (result.token) {
        await tokenStorage.saveToken(result.token);
      }

      return result;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errorData.message || `Login failed: ${response.status}`);
      }

      const result: AuthResponse = await response.json();
      
      // Save token if present
      if (result.token) {
        await tokenStorage.saveToken(result.token);
      }

      return result;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  async introspect(token?: string): Promise<IntrospectResponse> {
    try {
      // Use provided token or get from storage
      const tokenToUse = token || await tokenStorage.getToken();
      
      if (!tokenToUse) {
        throw new Error('No token available for introspection');
      }

      const response = await fetch(`${API_BASE_URL}/auth/introspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: tokenToUse }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Introspect failed' }));
        throw new Error(errorData.message || `Introspect failed: ${response.status}`);
      }

      const result: IntrospectResponse = await response.json();
      return result;
    } catch (error) {
      console.error('Introspect error:', error);
      throw error;
    }
  },

  async logout(): Promise<void> {
    await tokenStorage.removeToken();
  },
};

