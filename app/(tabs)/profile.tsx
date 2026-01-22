import { authService } from '@/services/auth';
import { queueService, QueueStatus } from '@/services/queue';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const [status, setStatus] = useState<QueueStatus>('idle');
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  useEffect(() => {
    // Set up event handlers
    queueService.setOnStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    queueService.setOnQueuePositionChange((position) => {
      setQueuePosition(position);
    });

    queueService.setOnMatched((gameId, data) => {
      const matchedTokens: string[] = Array.isArray(data?.playerTokens) ? data.playerTokens : [];
      const params: Record<string, string> = { gameId: String(data?.gameId ?? gameId) };
      if (data?.matchId) {
        params.matchId = String(data.matchId);
      }
      if (data?.opponentName) {
        params.opponentName = String(data.opponentName);
      }
      if (data?.opponentUuid) {
        params.opponentUuid = String(data.opponentUuid);
      }
      if (matchedTokens.length) {
        try {
          params.playerTokens = JSON.stringify(matchedTokens);
        } catch (error) {
          console.warn('Failed to serialise player tokens for routing', error);
        }
      }
      // Navigate to game with gameId (and tokens when available)
      router.push({
        pathname: '/game',
        params,
      });
    });

    queueService.setOnError((error) => {
      Alert.alert('Queue Error', error);
    });

    // Cleanup on unmount
    return () => {
      queueService.disconnect();
    };
  }, []);

  const handleStartGame = async () => {
    try {
      await queueService.connect();
    } catch (error: any) {
      Alert.alert('Connection Error', error.message || 'Failed to connect to queue');
    }
  };

  const handleCancel = () => {
    queueService.disconnect();
    setQueuePosition(null);
  };

  const handleLogout = async () => {
    try {
      // Disconnect from queue if connected
      queueService.disconnect();
      // Remove token from storage
      await authService.logout();
      // Navigate to login
      router.replace('/login');
    } catch (error: any) {
      Alert.alert('Logout Error', error.message || 'Failed to logout');
    }
  };

  const getButtonText = () => {
    switch (status) {
      case 'connecting':
        return 'Connecting...';
      case 'in_queue':
        return `In Queue (${queuePosition})`;
      case 'matched':
        return 'Match Found!';
      case 'error':
        return 'Retry';
      default:
        return 'Start Game';
    }
  };

  const isButtonDisabled = status === 'connecting' || status === 'matched';

  return (
    <View style={styles.root}>
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Profile</Text>
      
      {status === 'in_queue' && (
        <View style={styles.queueInfo}>
          <ActivityIndicator size="small" color="#2ecc71" />
          <Text style={styles.queueText}>
            Waiting for opponent... Position: {queuePosition}
          </Text>
        </View>
      )}

      {status === 'connecting' && (
        <View style={styles.queueInfo}>
          <ActivityIndicator size="small" color="#2ecc71" />
          <Text style={styles.queueText}>Connecting to queue...</Text>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.btn, isButtonDisabled && styles.btnDisabled]} 
        onPress={handleStartGame}
        disabled={isButtonDisabled}
      >
        <Text style={styles.btnText}>{getButtonText()}</Text>
      </TouchableOpacity>

      {(status === 'in_queue' || status === 'connecting') && (
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 16,
    padding: 20,
  },
  title: { 
    fontSize: 20, 
    fontWeight: '700',
    marginBottom: 20,
  },
  btn: { 
    backgroundColor: '#2ecc71', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: '#95a5a6',
    opacity: 0.6,
  },
  btnText: { 
    color: 'white', 
    fontWeight: '700', 
    fontSize: 16,
  },
  queueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  queueText: {
    fontSize: 14,
    color: '#666',
  },
  cancelBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: '#e74c3c',
    fontWeight: '600',
    fontSize: 14,
  },
  logoutBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logoutBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
});


