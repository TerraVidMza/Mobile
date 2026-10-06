/**
 * Pruebas del envío en lotes con reintento (HU-14, M-003) sobre una fuente en
 * memoria: cubre cada rama sin depender de la base ni del backend.
 */

import { AxiosError, AxiosHeaders } from 'axios';
import { sincronizarEnLotes, mensajeDeError, type FuenteSync } from './sync-lotes';
import { EstadoSync, type SyncResultItem } from '../types/api.types';

interface Reg {
  localUuid: string;
}

function errorHttp(status: number, message?: string | string[]): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, {
    status,
    statusText: '',
    headers: {},
    config,
    data: message === undefined ? {} : { message },
  });
}

function errorDeRed(): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK', { headers: new AxiosHeaders() });
}

const ok = (localUuid: string): SyncResultItem => ({
  localUuid,
  estado: EstadoSync.SINCRONIZADO,
  registroId: `srv-${localUuid}`,
});

const rechazado = (localUuid: string, errorMessage = 'Cuartel dado de baja'): SyncResultItem => ({
  localUuid,
  estado: EstadoSync.ERROR,
  errorMessage,
});

/** Fuente en memoria que se comporta como el repositorio real (orden + offset). */
function crearFuente(cantidad: number) {
  const pendientes = Array.from({ length: cantidad }, (_, i) => ({
    localUuid: `r-${String(i + 1).padStart(2, '0')}`,
  }));
  const sincronizados = new Map<string, string | undefined>();
  const fallos = new Map<string, string[]>();

  const fuente: FuenteSync<Reg> & {
    enviarLote: jest.Mock;
    enviarUno: jest.Mock;
  } = {
    contarPendientes: async () => pendientes.length,
    obtenerPendientes: async (limit, offset) => pendientes.slice(offset, offset + limit),
    enviarLote: jest.fn(async (lote: Reg[]) => lote.map((r) => ok(r.localUuid))),
    enviarUno: jest.fn(async (r: Reg) => ok(r.localUuid)),
    marcarSincronizado: async (uuid, serverId) => {
      sincronizados.set(uuid, serverId);
      pendientes.splice(pendientes.findIndex((p) => p.localUuid === uuid), 1);
    },
    registrarIntentoFallido: async (uuid, msg) => {
      fallos.set(uuid, [...(fallos.get(uuid) ?? []), msg]);
    },
    idServidor: (res) => res.registroId,
  };

  return { fuente, pendientes, sincronizados, fallos };
}

describe('sincronizarEnLotes', () => {
  it('no hace nada si no hay pendientes', async () => {
    const { fuente } = crearFuente(0);
    expect(await sincronizarEnLotes(fuente)).toEqual({
      totalSynced: 0,
      errorsCount: 0,
      interrumpido: false,
    });
    expect(fuente.enviarLote).not.toHaveBeenCalled();
  });

  it('envía en lotes de 10 y guarda el id del servidor', async () => {
    const { fuente, sincronizados, pendientes } = crearFuente(23);
    const progreso = jest.fn();

    const res = await sincronizarEnLotes(fuente, progreso);

    expect(res).toEqual({ totalSynced: 23, errorsCount: 0, interrumpido: false });
    expect(fuente.enviarLote.mock.calls.map((c) => c[0].length)).toEqual([10, 10, 3]);
    expect(sincronizados.get('r-01')).toBe('srv-r-01');
    expect(pendientes).toEqual([]);
    expect(progreso).toHaveBeenLastCalledWith(23, 23);
  });

  it('deja pendiente lo que el backend rechaza y sigue con el resto sin repetirlo', async () => {
    const { fuente, fallos, pendientes } = crearFuente(15);
    fuente.enviarLote.mockImplementation(async (lote: Reg[]) =>
      lote.map((r) => (r.localUuid === 'r-02' ? rechazado(r.localUuid) : ok(r.localUuid))),
    );

    const res = await sincronizarEnLotes(fuente);

    expect(res).toEqual({ totalSynced: 14, errorsCount: 1, interrumpido: false });
    expect(fallos.get('r-02')).toEqual(['Cuartel dado de baja']);
    expect(pendientes.map((p) => p.localUuid)).toEqual(['r-02']);
    // El segundo lote arranca después del rechazado: nunca se reenvía en la misma ronda.
    expect(fuente.enviarLote.mock.calls[1][0].map((r: Reg) => r.localUuid)).not.toContain('r-02');
  });

  it('un registro sin resultado en la respuesta no se da por sincronizado', async () => {
    const { fuente, fallos } = crearFuente(2);
    fuente.enviarLote.mockResolvedValueOnce([ok('r-01')]);

    const res = await sincronizarEnLotes(fuente);

    expect(res.totalSynced).toBe(1);
    expect(fallos.get('r-02')).toEqual(['El servidor no devolvió resultado para este registro']);
  });

  it.each([
    ['sin conexión', errorDeRed(), 'Sin conexión con el servidor'],
    ['error 500', errorHttp(500), 'El servidor respondió 500'],
    ['sesión vencida (401)', errorHttp(401, 'Unauthorized'), 'Unauthorized'],
    ['límite de requests (429)', errorHttp(429, 'Too Many Requests'), 'Too Many Requests'],
  ])('corta la ronda ante un fallo transitorio: %s', async (_caso, error, mensaje) => {
    const { fuente, fallos, pendientes } = crearFuente(12);
    fuente.enviarLote.mockRejectedValueOnce(error);

    const res = await sincronizarEnLotes(fuente);

    expect(res).toEqual({ totalSynced: 0, errorsCount: 10, interrumpido: true });
    expect(fuente.enviarLote).toHaveBeenCalledTimes(1);
    expect(fuente.enviarUno).not.toHaveBeenCalled();
    expect(fallos.get('r-01')).toEqual([mensaje]);
    expect(pendientes).toHaveLength(12);
  });

  it('si el backend rechaza el lote entero, envía de a uno y aísla al culpable', async () => {
    const { fuente, fallos, pendientes } = crearFuente(3);
    fuente.enviarLote.mockRejectedValueOnce(errorHttp(404, 'Cuartel no encontrado'));
    fuente.enviarUno.mockImplementation(async (r: Reg) => {
      if (r.localUuid === 'r-02') throw errorHttp(404, 'Cuartel no encontrado');
      return ok(r.localUuid);
    });

    const res = await sincronizarEnLotes(fuente);

    expect(res).toEqual({ totalSynced: 2, errorsCount: 1, interrumpido: false });
    expect(fuente.enviarUno).toHaveBeenCalledTimes(3);
    expect(fallos.get('r-02')).toEqual(['Cuartel no encontrado']);
    expect(pendientes.map((p) => p.localUuid)).toEqual(['r-02']);
  });

  it('usa el resultado del envío individual aunque sea un rechazo de negocio', async () => {
    const { fuente, fallos } = crearFuente(1);
    fuente.enviarLote.mockRejectedValueOnce(errorHttp(400, ['cantidad must be positive']));
    fuente.enviarUno.mockResolvedValueOnce(rechazado('r-01', 'No hay costo vigente'));

    const res = await sincronizarEnLotes(fuente);

    expect(res.errorsCount).toBe(1);
    expect(fallos.get('r-01')).toEqual(['No hay costo vigente']);
  });

  it('corta la ronda si se cae la conexión durante el envío individual', async () => {
    const { fuente, fallos } = crearFuente(3);
    fuente.enviarLote.mockRejectedValueOnce(errorHttp(400));
    fuente.enviarUno
      .mockResolvedValueOnce(ok('r-01'))
      .mockRejectedValueOnce(errorDeRed());

    const res = await sincronizarEnLotes(fuente);

    expect(res).toEqual({ totalSynced: 1, errorsCount: 2, interrumpido: true });
    expect(fuente.enviarUno).toHaveBeenCalledTimes(2);
    expect([...fallos.keys()]).toEqual(['r-02', 'r-03']);
  });
});

describe('mensajeDeError', () => {
  it('une los mensajes de validación del backend', () => {
    expect(mensajeDeError(errorHttp(400, ['a', 'b']), 'x')).toBe('a. b');
  });

  it('usa el mensaje de un Error común o el texto por defecto', () => {
    expect(mensajeDeError(new Error('boom'), 'x')).toBe('boom');
    expect(mensajeDeError('raro', 'por defecto')).toBe('por defecto');
  });
});
