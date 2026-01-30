import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  style,
  textStyle
}) {
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.btn, style, inactive && styles.disabled]}
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.txt, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center'
  },
  disabled: { opacity: 0.7 },
  txt: {
    color: '#fff',
    fontSize: 16
  }
});
