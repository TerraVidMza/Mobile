/**
 * Tests unitarios para los esquemas Zod (espejos del Backend).
 */

import {
  loginSchema,
  registroLaborSchema,
  pesajeVendimiaSchema,
} from './validators';

describe('Zod Validators (Client vs Backend Constraints)', () => {
  describe('loginSchema', () => {
    it('valida email y password correctos', () => {
      const result = loginSchema.safeParse({
        email: 'capataz@terravid.com',
        password: 'Password123',
      });
      expect(result.success).toBe(true);
    });

    it('falla con email inválido', () => {
      const result = loginSchema.safeParse({
        email: 'invalido',
        password: 'Password123',
      });
      expect(result.success).toBe(false);
    });

    it('falla con password vacío', () => {
      const result = loginSchema.safeParse({
        email: 'capataz@terravid.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('registroLaborSchema (HU-12, HU-13)', () => {
    it('valida un registro de labor correcto con insumos', () => {
      const result = registroLaborSchema.safeParse({
        cuartelId: '11111111-1111-1111-1111-111111111111',
        tipoLaborId: '22222222-2222-2222-2222-222222222222',
        fecha: '2026-08-25',
        cantidad: 5.5,
        insumos: [
          {
            insumoId: '33333333-3333-3333-3333-333333333333',
            cantidad: 2.0,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('falla si cantidad <= 0', () => {
      const result = registroLaborSchema.safeParse({
        cuartelId: '11111111-1111-1111-1111-111111111111',
        tipoLaborId: '22222222-2222-2222-2222-222222222222',
        fecha: '2026-08-25',
        cantidad: 0,
        insumos: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('pesajeVendimiaSchema (HU-24)', () => {
    it('valida un pesaje con peso positivo', () => {
      const result = pesajeVendimiaSchema.safeParse({
        cuadrillaId: '11111111-1111-1111-1111-111111111111',
        cuartelId: '22222222-2222-2222-2222-222222222222',
        fecha: '2026-08-25',
        pesoKg: 1250.75,
      });
      expect(result.success).toBe(true);
    });

    it('falla con peso 0 o negativo', () => {
      const result = pesajeVendimiaSchema.safeParse({
        cuadrillaId: '11111111-1111-1111-1111-111111111111',
        cuartelId: '22222222-2222-2222-2222-222222222222',
        fecha: '2026-08-25',
        pesoKg: 0,
      });
      expect(result.success).toBe(false);
    });
  });
});
