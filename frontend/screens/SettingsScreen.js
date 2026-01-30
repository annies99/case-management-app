import React from 'react';
import { View, Text, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import Button from '../components/common/Button';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const [pushEnabled, setPush] = React.useState(true);

  return (
    <View style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:20, marginBottom:12 }}>{t('settings')}</Text>
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:24 }}>
        <Text>{t('language')}</Text>
        <Button
          title={i18n.language==='en'?'Español':'English'}
          onPress={()=>i18n.changeLanguage(i18n.language==='en'?'es':'en')}
        />
      </View>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
        <Text>{t('pushNotifications')}</Text>
        <Switch value={pushEnabled} onValueChange={setPush}/>
      </View>
    </View>
  );
}
