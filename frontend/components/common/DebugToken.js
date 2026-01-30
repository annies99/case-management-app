import React, { useState, useEffect } from 'react'
import { View, Text } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function DebugToken() {
  const [token, setToken] = useState('')

  useEffect(() => {
    AsyncStorage.getItem('authToken').then(raw => {
      const clean = (raw||'').replace(/^"|"$/g, '')
      setToken(clean)
    })
  }, [])

  const dotCount = (token.match(/\./g) || []).length

  return (
    <View style={{ padding: 16, backgroundColor: '#fee', margin: 16, borderRadius: 8 }}>
      <Text selectable style={{ fontWeight:'bold' }}>Stored JWT:</Text>
      <Text selectable>{token || '<empty>'}</Text>
      <Text style={{ marginTop: 8 }}>Dot count: {dotCount}</Text>
    </View>
  )
}
