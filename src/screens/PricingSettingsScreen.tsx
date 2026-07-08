import React, { useState } from 'react';
import {
     View,
     Text,
     TouchableOpacity,
     StyleSheet,
     ScrollView,
     TextInput,
     ActivityIndicator,
     Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../utils/api';
import Icon from 'react-native-vector-icons/Ionicons';

const PricingSettingsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
     const { colors, isDark } = useTheme();
     const { user, token, setAuth, logout } = useAuth();
     const { t } = useLanguage();
     const [rate, setRate] = useState<string>(user?.vehicle?.rate_per_km?.toString() || '5');
     const [loading, setLoading] = useState(false);

     const handleSave = async () => {
          if (!rate.trim() || !user?.vehicle) {
               Alert.alert(t('common.error'), 'Please enter a valid rate');
               return;
          }

          setLoading(true);
          try {
               const updatedVehicle = {
                    ...user.vehicle,
                    rate_per_km: parseFloat(rate)
               };

               const response = await apiRequest('/api/user/profile', {
                    method: 'PUT',
                    body: JSON.stringify({
                         name: user?.name,
                         role: user?.role,
                         vehicle: updatedVehicle
                    }),
               }, logout);

               if (response.ok) {
                    await setAuth(token!, null, { ...user!, vehicle: updatedVehicle });
                    Alert.alert('Success', 'Pricing rate updated successfully');
                    onBack();
               } else {
                    const data = await response.json();
                    Alert.alert(t('common.error'), data.error || 'Failed to update rate');
               }
          } catch (err) {
               console.error('Update rate error:', err);
               Alert.alert(t('common.error'), 'Connection error. Please try again.');
          } finally {
               setLoading(false);
          }
     };

     return (
          <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
               <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                         <Icon name="chevron-back" size={28} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textColor }]}>{t('account.pricingSettings')}</Text>
               </View>

               <View style={styles.content}>
                    <View style={[styles.card, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                         <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(91, 79, 255, 0.1)' : 'rgba(91, 79, 255, 0.05)' }]}>
                              <Icon name="cash-outline" size={48} color={colors.primary} />
                         </View>

                         <Text style={[styles.description, { color: colors.subtextColor }]}>
                              {t('account.pricingDesc')}
                         </Text>

                         <View style={styles.inputGroup}>
                              <Text style={[styles.label, { color: colors.primary }]}>{t('home.ratePerKm').toUpperCase()}</Text>
                              <View style={[styles.inputWrapper, { backgroundColor: colors.inputFillColor, borderColor: colors.inputBorderColor }]}>
                                   <Text style={[styles.currency, { color: colors.textColor }]}>₹</Text>
                                   <TextInput
                                        style={[styles.input, { color: colors.textColor }]}
                                        value={rate}
                                        onChangeText={setRate}
                                        keyboardType="numeric"
                                        placeholder="5.0"
                                        placeholderTextColor={colors.subtextColor}
                                   />
                              </View>
                         </View>

                         <View style={styles.infoBox}>
                              <Text style={styles.infoText}>
                                   {t('account.pricingTip')}
                              </Text>
                         </View>
                    </View>

                    <TouchableOpacity
                         style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
                         onPress={handleSave}
                         disabled={loading}>
                         {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{t('account.savePricing')}</Text>}
                    </TouchableOpacity>
               </View>
          </ScrollView>
     );
};

const styles = StyleSheet.create({
     container: { flex: 1 },
     header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 40 },
     backButton: { marginRight: 16 },
     title: { fontSize: 24, fontWeight: 'bold' },
     content: { padding: 20 },
     card: { borderRadius: 24, borderWidth: 1, padding: 24, alignItems: 'center' },
     iconContainer: { marginBottom: 20, width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
     description: { textAlign: 'center', fontSize: 14, lineHeight: 20, marginBottom: 30 },
     inputGroup: { width: '100%', marginBottom: 20 },
     label: { fontSize: 11, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 },
     inputWrapper: {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 14,
          borderWidth: 1,
          paddingHorizontal: 16,
          height: 56,
     },
     currency: { fontSize: 18, fontWeight: 'bold', marginRight: 8 },
     input: { flex: 1, fontSize: 18, fontWeight: 'bold' },
     infoBox: {
          backgroundColor: 'rgba(91, 79, 255, 0.05)',
          padding: 16,
          borderRadius: 14,
          width: '100%'
     },
     infoText: { fontSize: 12, color: '#5B4FFF', fontWeight: '500', textAlign: 'center' },
     saveBtn: {
          marginTop: 30,
          height: 56,
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#5B4FFF',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 5,
     },
     saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
});

export default PricingSettingsScreen;
