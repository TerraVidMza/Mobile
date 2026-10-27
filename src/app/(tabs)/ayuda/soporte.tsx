/**
 * Pedir ayuda — formulario de soporte (HU-36, M-022).
 *
 * A diferencia de labores y pesajes, el pedido no se guarda para después: es
 * para hablar con alguien, y si no sale en el momento conviene saberlo.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSyncStore } from '../../../stores/sync.store';
import { ayudaService, MODULOS_AYUDA, type ModuloAyuda } from '../../../services/ayuda.service';
import { avisar } from '../../../utils/dialogos';

/** `@Length(10, 1000)` del backend. */
const MINIMO = 10;
const MAXIMO = 1000;

export default function SoporteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const isConnected = useSyncStore((s) => s.isConnected);
  const [modulo, setModulo] = useState<ModuloAyuda>('operaciones');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const corta = descripcion.trim().length < MINIMO;

  async function enviar() {
    if (corta) {
      setError(`Contá qué pasó con al menos ${MINIMO} caracteres.`);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const ticket = await ayudaService.crearTicket(modulo, descripcion.trim());
      await avisar(
        'Pedido enviado',
        ticket.emailEnviado
          ? 'Te van a contactar por correo.'
          : 'Tu pedido quedó registrado, pero el aviso por correo no salió. Si es urgente, avisale al Propietario.',
      );
      router.back();
    } catch {
      setError('No se pudo enviar el pedido. Revisá la conexión y volvé a intentar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      contentContainerStyle={styles.contenido}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        El pedido llega al correo de soporte de tu empresa.
      </Text>

      {!isConnected && (
        <HelperText type="error" visible style={styles.sinConexion}>
          Sin conexión: el pedido se puede enviar cuando vuelva la señal.
        </HelperText>
      )}

      <Text variant="titleSmall" style={styles.etiqueta}>
        ¿En qué parte?
      </Text>
      <View style={styles.chips}>
        {MODULOS_AYUDA.map((m) => (
          <Chip
            key={m.valor}
            testID={`modulo-${m.valor}`}
            selected={modulo === m.valor}
            showSelectedCheck
            onPress={() => setModulo(m.valor)}
            style={styles.chip}
          >
            {m.etiqueta}
          </Chip>
        ))}
      </View>

      <TextInput
        testID="input-descripcion-ayuda"
        label="¿Qué pasó?"
        mode="outlined"
        multiline
        numberOfLines={6}
        maxLength={MAXIMO}
        value={descripcion}
        onChangeText={setDescripcion}
        style={styles.descripcion}
      />
      <HelperText type={error ? 'error' : 'info'} visible>
        {error ?? `Qué estabas haciendo, qué esperabas y qué pasó. ${descripcion.length}/${MAXIMO}`}
      </HelperText>

      <Button
        testID="boton-enviar-ayuda"
        mode="contained"
        icon="send"
        onPress={enviar}
        loading={enviando}
        disabled={enviando || !isConnected}
        style={styles.boton}
      >
        Enviar pedido
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contenido: { padding: 16, paddingBottom: 32 },
  sinConexion: { paddingHorizontal: 0 },
  etiqueta: { marginTop: 16, marginBottom: 8, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { marginBottom: 4 },
  descripcion: { marginTop: 16 },
  boton: { marginTop: 8, borderRadius: 12 },
});
