import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function PlayersScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Players</Text>
      <Text>Coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8,
    padding: 20,
  },
  title: { 
    fontSize: 20, 
    fontWeight: '700',
    marginBottom: 20,
  },
});


