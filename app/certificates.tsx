import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Platform, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useFinancials } from '@/state/FinancialsProvider';
import { Award, Plus, Save, X, Calendar as CalendarIcon, Link2, CheckCircle2 } from 'lucide-react-native';

interface EditingState {
  id?: string;
  type: 'FCC' | 'NEXT_CRUISE' | 'OTHER';
  valueUSD: string;
  code?: string;
  earnedDate?: string;
  expiresOn?: string;
  notes?: string;
  linkedCruiseId?: string;
}

export default function CertificatesScreen() {
  const { certificates, addCertificate, updateCertificate, removeCertificate } = useFinancials();
  const [editing, setEditing] = React.useState<EditingState | null>(null);
  const [filter, setFilter] = React.useState<'ALL' | 'ACTIVE' | 'USED' | 'EXPIRING_SOON'>('ALL');

  const list = React.useMemo(() => {
    const now = Date.now();
    const soon = now + 1000 * 60 * 60 * 24 * 60;
    const data = certificates.map(c => ({
      ...c,
      isExpiringSoon: c.expiresOn ? new Date(c.expiresOn).getTime() <= soon && (c.isUsed ?? false) === false : false,
    }));
    if (filter === 'ACTIVE') return data.filter(c => !(c.isUsed ?? false));
    if (filter === 'USED') return data.filter(c => c.isUsed);
    if (filter === 'EXPIRING_SOON') return data.filter(c => c.isExpiringSoon && !(c.isUsed ?? false));
    return data;
  }, [certificates, filter]);

  const startNew = React.useCallback(() => {
    setEditing({ type: 'NEXT_CRUISE', valueUSD: '0' });
  }, []);

  const submit = React.useCallback(async () => {
    if (!editing) return;
    const value = Math.max(0, parseInt(editing.valueUSD.replace(/[^0-9]/g, ''), 10) || 0);
    const payload = {
      id: editing.id ?? `cert_${Date.now()}`,
      type: editing.type,
      valueUSD: value,
      code: editing.code?.trim() || undefined,
      earnedDate: editing.earnedDate?.trim() || undefined,
      expiresOn: editing.expiresOn?.trim() || undefined,
      notes: editing.notes?.trim() || undefined,
      linkedCruiseId: editing.linkedCruiseId?.trim() || undefined,
      isUsed: false,
    } as const;
    try {
      if (editing.id) {
        await updateCertificate(editing.id, payload as any);
      } else {
        await addCertificate(payload as any);
      }
      setEditing(null);
    } catch (e: any) {
      if (Platform.OS !== 'web') Alert.alert('Error', e?.message ?? 'Failed to save certificate');
      else console.error('Failed to save certificate', e);
    }
  }, [editing, addCertificate, updateCertificate]);

  const askRemove = React.useCallback((id: string) => {
    if (Platform.OS !== 'web') {
      Alert.alert('Remove Certificate', 'This cannot be undone. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => { await removeCertificate(id); } },
      ]);
    } else {
      removeCertificate(id);
    }
  }, [removeCertificate]);

  const renderItem = React.useCallback(({ item }: { item: any }) => {
    const expSoon = item.isExpiringSoon;
    return (
      <View style={[styles.card, (item.isUsed ? styles.usedCard : undefined)]}>
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}><Award size={16} color={item.isUsed ? '#6B7280' : '#10B981'} /></View>
          <Text style={styles.cardTitle}>{item.type}</Text>
          <View style={styles.spacer} />
          {expSoon && <Text style={styles.expiringChip}>Expiring</Text>}
          <Text style={styles.valueChip}>${Number(item.valueUSD || 0).toLocaleString()}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.metaText}>{item.code ?? '—'}</Text>
          <Text style={styles.metaText}>{item.expiresOn ? new Date(item.expiresOn).toLocaleDateString() : 'No expiry'}</Text>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.linkBtn} onPress={() => setEditing({ id: item.id, type: item.type, valueUSD: String(item.valueUSD ?? 0), code: item.code, earnedDate: item.earnedDate, expiresOn: item.expiresOn, notes: item.notes, linkedCruiseId: item.linkedCruiseId })} testID={`edit-${item.id}`}>
            <Text style={styles.linkText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={async () => { await updateCertificate(item.id, { isUsed: !(item.isUsed ?? false), usedOnCruiseId: !(item.isUsed ?? false) ? (item.linkedCruiseId ?? item.redeemedOnCruiseId) : undefined }); }} testID={`toggle-used-${item.id}`}>
            <Text style={[styles.linkText, item.isUsed ? styles.warnText : styles.successText]}>{item.isUsed ? 'Mark Unused' : 'Mark Used'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => askRemove(item.id)} testID={`remove-${item.id}`}>
            <Text style={[styles.linkText, styles.dangerText]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [askRemove]);

  return (
    <View style={styles.container} testID="certificates-screen">
      <Stack.Screen options={{ title: 'Certificates', headerStyle: { backgroundColor: '#FFFFFF' } }} />
      <View style={styles.toolbar}>
        <View style={styles.filterRow}>
          {(['ALL','ACTIVE','USED','EXPIRING_SOON'] as const).map(key => (
            <TouchableOpacity key={key} style={[styles.filterChip, filter === key && styles.filterChipActive]} onPress={() => setFilter(key)} testID={`filter-${key.toLowerCase()}`}>
              <Text style={[styles.filterChipText, filter === key && styles.filterChipTextActive]}>{key.replace('_',' ')}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.spacer} />
          <TouchableOpacity style={styles.primaryBtn} onPress={startNew} testID="add-certificate">
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No certificates</Text>}
      />

      {editing && (
        <View style={styles.editor} testID="cert-editor">
          <View style={styles.editorHeader}>
            <Text style={styles.editorTitle}>{editing.id ? 'Edit Certificate' : 'New Certificate'}</Text>
            <TouchableOpacity onPress={() => setEditing(null)} style={styles.iconBtn} testID="editor-cancel">
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {(['NEXT_CRUISE','FCC','OTHER'] as const).map(t => (
                <TouchableOpacity key={t} style={[styles.typeChip, editing.type === t && styles.typeChipActive]} onPress={() => setEditing({ ...editing, type: t })} testID={`type-${t.toLowerCase()}`}>
                  <Text style={[styles.typeChipText, editing.type === t && styles.typeChipTextActive]}>{t.replace('_',' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Value</Text>
            <TextInput
              value={editing.valueUSD}
              onChangeText={(t: string) => setEditing({ ...editing, valueUSD: t.replace(/[^0-9]/g,'').slice(0,6) })}
              keyboardType="numeric"
              style={styles.input}
              placeholder="0"
              testID="value-input"
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Code</Text>
            <TextInput
              value={editing.code ?? ''}
              onChangeText={(t: string) => setEditing({ ...editing, code: t })}
              style={styles.input}
              placeholder="Optional code"
              testID="code-input"
            />
          </View>
          <View style={styles.rowTwo}>
            <View style={[styles.inputRow, styles.half]}>
              <Text style={styles.label}>Earned</Text>
              <View style={styles.inputWithIcon}>
                <CalendarIcon size={16} color="#6B7280" />
                <TextInput
                  value={editing.earnedDate ?? ''}
                  onChangeText={(t: string) => setEditing({ ...editing, earnedDate: t })}
                  style={styles.inputBare}
                  placeholder="YYYY-MM-DD"
                  testID="earned-input"
                />
              </View>
            </View>
            <View style={[styles.inputRow, styles.half]}>
              <Text style={styles.label}>Expires</Text>
              <View style={styles.inputWithIcon}>
                <CalendarIcon size={16} color="#6B7280" />
                <TextInput
                  value={editing.expiresOn ?? ''}
                  onChangeText={(t: string) => setEditing({ ...editing, expiresOn: t })}
                  style={styles.inputBare}
                  placeholder="YYYY-MM-DD"
                  testID="expires-input"
                />
              </View>
            </View>
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Link Cruise ID</Text>
            <View style={styles.inputWithIcon}>
              <Link2 size={16} color="#6B7280" />
              <TextInput
                value={editing.linkedCruiseId ?? ''}
                onChangeText={(t: string) => setEditing({ ...editing, linkedCruiseId: t })}
                style={styles.inputBare}
                placeholder="e.g. 2665774"
                testID="link-input"
              />
            </View>
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              value={editing.notes ?? ''}
              onChangeText={(t: string) => setEditing({ ...editing, notes: t })}
              style={[styles.input, styles.multiline]}
              placeholder="Optional notes"
              multiline
              numberOfLines={3}
              testID="notes-input"
            />
          </View>
          {!!editing.id && (
            <TouchableOpacity onPress={async () => { await updateCertificate(editing.id!, { isUsed: true, usedOnCruiseId: editing.linkedCruiseId ?? undefined }); setEditing(null); }} style={styles.markUsedBtn} testID="editor-mark-used">
              <CheckCircle2 size={16} color="#FFFFFF" />
              <Text style={styles.markUsedText}>Mark Used</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={submit} style={styles.saveBtn} testID="editor-save">
            <Save size={16} color="#FFFFFF" />
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  toolbar: { padding: 16 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChip: { backgroundColor: '#E5E7EB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  filterChipActive: { backgroundColor: '#111827' },
  filterChipText: { color: '#111827', fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#FFFFFF' },
  spacer: { flex: 1 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  listContent: { padding: 16, paddingBottom: 120, gap: 12 },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  usedCard: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  iconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  valueChip: { marginLeft: 8, backgroundColor: '#10B9811A', color: '#065F46', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12 },
  expiringChip: { backgroundColor: '#FEE2E2', color: '#B91C1C', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metaText: { fontSize: 12, color: '#6B7280' },
  actionsRow: { flexDirection: 'row', gap: 16 },
  linkBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  linkText: { color: '#3B82F6', fontSize: 12, fontWeight: '700' },
  dangerText: { color: '#DC2626' },
  warnText: { color: '#B45309' },
  successText: { color: '#16A34A' },
  editor: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, borderTopWidth: 1, borderColor: '#E5E7EB' },
  editorHeader: { flexDirection: 'row', alignItems: 'center' },
  editorTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  iconBtn: { padding: 8, marginLeft: 'auto' },
  inputRow: { marginTop: 12 },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827' },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  inputBare: { flex: 1, fontSize: 14, color: '#111827' },
  rowTwo: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: { backgroundColor: '#E5E7EB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  typeChipActive: { backgroundColor: '#3B82F6' },
  typeChipText: { color: '#111827', fontSize: 12, fontWeight: '700' },
  typeChipTextActive: { color: '#FFFFFF' },
  saveBtn: { marginTop: 12, backgroundColor: '#111827', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
  markUsedBtn: { marginTop: 8, backgroundColor: '#16A34A', borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  markUsedText: { color: '#FFFFFF', fontWeight: '700' },
});
