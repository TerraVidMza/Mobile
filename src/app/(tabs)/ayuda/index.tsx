/**
 * Ayuda — manual de la app (HU-36, M-022).
 *
 * El manual viaja dentro de la app: se lee sin señal, que es justo cuando el
 * capataz está en el cuartel y no tiene a quién preguntarle. Cada usuario ve
 * solo las secciones de lo que su rol puede hacer.
 */

import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, List, Searchbar, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../stores/auth.store';
import { MANUAL_APP, VERSION_MANUAL } from '../../../manual/contenido';
import { buscar, parsearManual, seccionesPara } from '../../../manual/markdown';
import { ContenidoManual } from '../../../components/ayuda/ContenidoManual';

const SECCIONES = parsearManual(MANUAL_APP);

export default function AyudaScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [consulta, setConsulta] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);

  const propias = useMemo(() => seccionesPara(SECCIONES, user?.permisos ?? []), [user?.permisos]);
  const visibles = useMemo(() => buscar(propias, consulta), [propias, consulta]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      contentContainerStyle={styles.contenido}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="titleLarge" style={styles.titulo}>
        Manual de la app
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
        Versión del manual: {VERSION_MANUAL}. Se puede leer sin conexión.
      </Text>

      <Searchbar
        testID="buscar-manual"
        placeholder="Buscar en el manual..."
        value={consulta}
        onChangeText={setConsulta}
        style={styles.buscador}
      />

      {visibles.length === 0 && (
        <Text variant="bodyMedium" style={[styles.vacio, { color: theme.colors.onSurfaceVariant }]}>
          Ninguna sección menciona «{consulta}». Probá con otra palabra, por ejemplo «pesaje» o «sincronizar».
        </Text>
      )}

      <List.Section>
        {visibles.map((seccion) => (
          <List.Accordion
            key={seccion.id}
            testID={`seccion-${seccion.id}`}
            title={seccion.titulo}
            titleNumberOfLines={2}
            // Con una búsqueda activa las secciones encontradas se abren solas.
            expanded={consulta.trim() ? true : abierta === seccion.id}
            onPress={() => setAbierta((actual) => (actual === seccion.id ? null : seccion.id))}
            style={[styles.acordeon, { backgroundColor: theme.colors.surfaceVariant }]}
          >
            <View style={styles.cuerpo}>
              <ContenidoManual bloques={seccion.bloques} />
            </View>
          </List.Accordion>
        ))}
      </List.Section>

      <Card style={styles.tarjeta}>
        <Card.Content>
          <Text variant="titleMedium">¿No encontrás lo que buscás?</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            Contanos qué pasó y te contacta el equipo de soporte. Necesita conexión.
          </Text>
        </Card.Content>
        <Card.Actions>
          <Button
            testID="boton-pedir-ayuda"
            mode="contained"
            icon="lifebuoy"
            onPress={() => router.push('/(tabs)/ayuda/soporte')}
          >
            Pedir ayuda
          </Button>
        </Card.Actions>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contenido: { padding: 16, paddingBottom: 32 },
  titulo: { fontWeight: '700' },
  buscador: { marginBottom: 8 },
  vacio: { marginTop: 16, textAlign: 'center' },
  acordeon: { marginTop: 8, borderRadius: 12 },
  cuerpo: { paddingHorizontal: 16, paddingBottom: 16 },
  tarjeta: { marginTop: 16, borderRadius: 12 },
});
