import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changePassword } from '../services/authService';

export default function PasswordManagerScreen({ navigation }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow]       = useState(false);

  const handleChange = async () => {
    if (newPw.length < 6 || newPw.length > 20) {
      return Alert.alert(t('invalid_password_title'), t('password_manager.password_length_error'));
    }
    if (newPw !== confirm) {
      return Alert.alert(t('error'), t('passwords_do_not_match'));
    }
    try {
      await changePassword({ oldPassword: current, newPassword: newPw });
      Alert.alert('Success', t('password_manager.password_changed_success'), [
        { text: 'OK', onPress: () => navigation.navigate('Appointments') }
      ]);
    } catch (err) {
      Alert.alert(t('error'), err.message || t('error_unknown'));
    }
  };

  return (
    <SafeAreaView style={p.wrapper}>
      {/* Header */}
      <View style={p.header}>
        <Ionicons
          name="chevron-back"
          size={28}
          color="#2A7D8F"
          onPress={() => navigation.navigate('Appointments')}
        />
        <Text style={p.title}>{t('password_manager.title')}</Text>
        <View style={{ width:28 }} />
      </View>

      {/* Fields */}
      {[
        { label:t('password_manager.current_password'), value:current, setter:setCurrent, forgot:true },
        { label:t('password_manager.new_password'), value:newPw, setter:setNewPw },
        { label:t('password_manager.confirm_new_password'), value:confirm, setter:setConfirm },
      ].map((f,i) => (
        <View key={i} style={p.field}>
          <Text style={p.label}>{f.label}</Text>
          <View style={p.inputRow}>
            <TextInput
              style={p.input}
              secureTextEntry={!show}
              value={f.value}
              onChangeText={f.setter}
            />
            <TouchableOpacity onPress={() => setShow(v=>!v)}>
              <Ionicons name={show?'eye':'eye-off'} size={20} color="#2A7D8F" />
            </TouchableOpacity>
          </View>
          {f.forgot && (
            <TouchableOpacity onPress={() => {/* TODO: forgot */}}>
              <Text style={p.forgot}>{t('password_manager.forgot_password')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <TouchableOpacity style={p.button} onPress={handleChange}>
        <Text style={p.buttonText}>{t('password_manager.change_password')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const p = StyleSheet.create({
  wrapper:{ flex:1, backgroundColor:'#fff' },
  header:{
    flexDirection:'row',
    alignItems:'center',
    padding:20
  },
  title: { flex:1, textAlign:'center', fontSize:20, color:'#2A7D8F', fontWeight:'600' },
  field:{ paddingHorizontal:20, marginBottom:16 },
  label:{ color:'#2A7D8F', marginBottom:6 },
  inputRow:{
    flexDirection:'row',
    alignItems:'center',
    backgroundColor:'#AEDAE9',
    borderRadius:25,
    paddingHorizontal:16,
    height:50
  },
  input:{ flex:1 },
  forgot:{
    alignSelf:'flex-end',
    color:'#2A7D8F',
    marginTop:4
  },
  button:{
    backgroundColor:'#4A6C82',
    borderRadius:25,
    paddingVertical:14,
    alignItems:'center',
    margin:20
  },
  buttonText:{ color:'#fff', fontSize:16 }
});
