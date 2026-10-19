import { StyleSheet } from 'react-native';
export default StyleSheet.create({
    page: { flexGrow: 1, backgroundColor: '#f8fafc', padding: 24, paddingTop: 30 },
    back: { alignSelf: 'flex-start', padding: 12, backgroundColor: '#fff', borderRadius: 14, marginBottom: 24 },
    title: { fontSize: 26, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
    hint: { color: '#64748b', fontSize: 15, lineHeight: 23, marginBottom: 20 },
    card: { padding: 24, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
    label: { color: '#475569', fontWeight: '600', marginBottom: 8 },
    input: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, fontSize: 16, color: '#0f172a', marginBottom: 20 },
    button: { backgroundColor: '#4f46e5', padding: 16, alignItems: 'center', borderRadius: 16 },
    buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    link: { color: '#4f46e5', fontWeight: '600', textAlign: 'center', paddingVertical: 16 },
    error: { color: '#b91c1c', marginBottom: 14, lineHeight: 21 }
});
