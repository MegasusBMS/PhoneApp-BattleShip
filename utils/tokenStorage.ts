import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@battleship_token';

/**
 * Decodes base64 string (works in React Native)
 */
function base64Decode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  
  str = str.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  
  while (i < str.length) {
    const enc1 = chars.indexOf(str.charAt(i++));
    const enc2 = chars.indexOf(str.charAt(i++));
    const enc3 = chars.indexOf(str.charAt(i++));
    const enc4 = chars.indexOf(str.charAt(i++));
    
    const bits = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;
    
    if (enc3 === 64) {
      output += String.fromCharCode((bits >> 16) & 255);
    } else if (enc4 === 64) {
      output += String.fromCharCode((bits >> 16) & 255, (bits >> 8) & 255);
    } else {
      output += String.fromCharCode((bits >> 16) & 255, (bits >> 8) & 255, bits & 255);
    }
  }
  
  return output;
}

/**
 * Decodes JWT token and extracts the payload
 */
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }
    
    // Payload is the second part (index 1)
    const payload = parts[1];
    
    // Decode base64url (JWT uses base64url encoding, not standard base64)
    // Replace URL-safe characters and add padding if needed
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) {
      base64 += '='.repeat(4 - padding);
    }
    
    // Decode and parse JSON
    const decoded = base64Decode(base64);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    throw new Error('Failed to decode JWT token');
  }
}

/**
 * Extracts the user UUID (sub field) from JWT token
 */
export function getUserIdFromToken(token: string): string {
  try {
    const payload = decodeJWT(token);
    if (!payload.sub) {
      throw new Error('Token payload does not contain sub field');
    }
    return payload.sub;
  } catch (error: any) {
    throw new Error(`Failed to extract user ID from token: ${error.message}`);
  }
}

/**
 * Extracts username-like fields from JWT payload (best effort).
 */
export function getUsernameFromToken(token: string): string | null {
  try {
    const payload = decodeJWT(token);
    const candidates = [
      payload.username,
      payload.name,
      payload.preferred_username,
      payload.user?.username,
      payload.user?.name,
      payload.profile?.username,
      payload.profile?.name,
      payload.account?.username,
      payload.account?.name,
    ];
    const match = candidates.find(
      (value) => typeof value === 'string' && value.trim().length > 0
    );
    return match ? match.trim() : null;
  } catch (error) {
    console.warn('Failed to extract username from token', error);
    return null;
  }
}

export const tokenStorage = {
  async saveToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving token:', error);
      throw error;
    }
  },

  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  async removeToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Error removing token:', error);
      throw error;
    }
  },
};


