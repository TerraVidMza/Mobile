/**
 * Dibuja los bloques de una sección del manual — M-022.
 */

import { Fragment, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type { Bloque, Fragmento } from '../../manual/markdown';
import { IMAGENES } from '../../manual/imagenes';

function Texto({ fragmentos }: { fragmentos: Fragmento[] }) {
  return (
    <>
      {fragmentos.map((f, i) =>
        f.negrita ? (
          <Text key={i} style={styles.negrita}>
            {f.texto}
          </Text>
        ) : (
          <Fragment key={i}>{f.texto}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Una captura a la proporción del archivo. El alto se calcula con el ancho
 * medido: react-native-web ignora `aspectRatio` en `Image` y la dibujaba con su
 * alto natural, con una franja vacía arriba y abajo.
 */
function Captura({ archivo, texto }: { archivo: string; texto: string }) {
  const theme = useTheme();
  const [ancho, setAncho] = useState(0);
  const imagen = IMAGENES[archivo];
  if (!imagen) return null;
  return (
    <View style={styles.marcoImagen} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      {ancho > 0 && (
        <Image
          source={imagen.fuente}
          accessibilityLabel={texto}
          resizeMode="contain"
          style={[
            styles.imagen,
            { width: ancho, height: (ancho * imagen.alto) / imagen.ancho, borderColor: theme.colors.outline },
          ]}
        />
      )}
    </View>
  );
}

export function ContenidoManual({ bloques }: { bloques: Bloque[] }) {
  const theme = useTheme();

  return (
    <View>
      {bloques.map((bloque, i) => {
        switch (bloque.tipo) {
          case 'subtitulo':
            return (
              <Text key={i} variant="titleSmall" style={[styles.subtitulo, { color: theme.colors.primary }]}>
                {bloque.texto}
              </Text>
            );
          case 'parrafo':
            return (
              <Text key={i} variant="bodyMedium" style={styles.parrafo}>
                <Texto fragmentos={bloque.fragmentos} />
              </Text>
            );
          case 'lista':
            return (
              <View key={i} style={styles.lista}>
                {bloque.items.map((item, j) => (
                  <View key={j} style={styles.item}>
                    <Text variant="bodyMedium" style={styles.vinieta}>
                      {bloque.numerada ? `${j + 1}.` : '•'}
                    </Text>
                    <Text variant="bodyMedium" style={styles.itemTexto}>
                      <Texto fragmentos={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'nota':
            return (
              <View
                key={i}
                style={[
                  styles.nota,
                  { backgroundColor: theme.colors.surfaceVariant, borderLeftColor: theme.colors.primary },
                ]}
              >
                <Text variant="bodyMedium">
                  <Texto fragmentos={bloque.fragmentos} />
                </Text>
              </View>
            );
          case 'imagen':
            return <Captura key={i} archivo={bloque.archivo} texto={bloque.texto} />;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitulo: { marginTop: 16, marginBottom: 4, fontWeight: '700' },
  parrafo: { marginTop: 8, lineHeight: 22 },
  negrita: { fontWeight: '700' },
  lista: { marginTop: 8 },
  item: { flexDirection: 'row', marginTop: 4 },
  vinieta: { width: 24, lineHeight: 22 },
  itemTexto: { flex: 1, lineHeight: 22 },
  nota: { marginTop: 12, padding: 12, borderRadius: 8, borderLeftWidth: 4 },
  // Las capturas son de un teléfono: a todo el ancho quedarían más altas que la pantalla.
  marcoImagen: { marginTop: 12, width: '70%', alignSelf: 'center' },
  imagen: { borderWidth: 1, borderRadius: 8 },
});
