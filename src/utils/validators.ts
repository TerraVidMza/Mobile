/**
 * Esquemas de validación Zod que espejan las reglas del backend.
 *
 * El backend usa class-validator con las mismas restricciones; esto garantiza
 * que el formulario local rechace datos que el servidor también rechazaría,
 * sin necesidad de red.
 */

import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es obligatorio')
    .email('Formato de email inválido'),
  password: z
    .string()
    .min(1, 'La contraseña es obligatoria'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es obligatorio')
    .email('Formato de email inválido'),
});

/** Política de contraseñas del backend: mínimo 8, al menos una letra y un número, máximo 72 (bcrypt). */
const passwordPolicy = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[a-zA-Z]/, 'Debe contener al menos una letra')
  .regex(/\d/, 'Debe contener al menos un número');

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordPolicy,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
  newPassword: passwordPolicy,
});

// ─── Registro de labor (HU-12, HU-13) ────────────────────────────────────────

export const detalleInsumoSchema = z.object({
  insumoId: z.string().uuid('ID de insumo inválido'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
});

export const registroLaborSchema = z.object({
  cuartelId: z.string().uuid('Seleccioná un cuartel'),
  tipoLaborId: z.string().uuid('Seleccioná un tipo de labor'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  cantidad: z.number().min(0.01, 'La cantidad debe ser mayor a 0'),
  insumos: z
    .array(detalleInsumoSchema)
    .max(20, 'Máximo 20 insumos por labor'),
});

// ─── Pesaje de vendimia (HU-24) ──────────────────────────────────────────────

export const pesajeVendimiaSchema = z.object({
  cuadrillaId: z.string().uuid('Seleccioná una cuadrilla'),
  cuartelId: z.string().uuid('Seleccioná un cuartel'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  pesoKg: z.number().positive('El peso debe ser mayor a 0 kg'),
});
