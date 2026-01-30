import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsMenuScreen({ navigation }) {
  const [notifyOn, setNotifyOn] = useState(true);
  const { t } = useTranslation();

  return (
    <SafeAreaView style={s.wrapper}>
      {/* existing header… */}
      <View style={s.header}>
        {/* back button + title */}
      </View>

      {/* Toggle row */}
      <View style={s.row}>
        <Ionicons name="notifications-outline" size={20} color="#2A7D8F" />
        <Text style={s.label}>{t('settings.general_notification')}</Text>
        <Switch
          value={notifyOn}
          onValueChange={setNotifyOn}
          thumbColor={notifyOn ? "#4A6C82" : "#fff"}
          trackColor={{ false: "#AEDAE9", true: "#2A7D8F" }}
        />
      </View>

      {/* Password manager row */}
      <TouchableOpacity style={s.row} onPress={() => navigation.navigate('PasswordManager')}>
        <Ionicons name="key-outline" size={20} color="#2A7D8F" />
        <Text style={s.label}>{t('settings.password_manager')}</Text>
        <Ionicons name="chevron-forward" size={20} color="#2A7D8F" />
      </TouchableOpacity>

      {/* ...other rows */}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrapper:{flex:1,backgroundColor:'#fff'},
  header:{/* your existing header style */},
  row:{
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'space-between',
    paddingHorizontal:20,
    paddingVertical:16,
    borderBottomWidth:1,
    borderColor:'#EEE'
  },
  label:{flex:1,marginLeft:12,color:'#000'}
});
