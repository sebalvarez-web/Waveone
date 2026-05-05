export type UserRol = "admin" | "entrenador";
export type CorredorEstado = "activo" | "pausado" | "inactivo";
export type TransaccionTipo = "ingreso" | "gasto";
export type TransaccionMetodo = "stripe" | "paypal" | "transferencia" | "efectivo";
export type TransaccionEstado = "pagado" | "pendiente" | "vencido" | "reembolsado";
export type PagoFuente = "stripe" | "paypal";

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: UserRol;
  created_at: string;
}

export interface Plan {
  id: string;
  nombre: string;
  precio_mensual: number;
  descripcion: string;
}

export interface Corredor {
  id: string;
  nombre: string;
  email: string;
  telefono_emergencia: string | null;
  fecha_ingreso: string;
  fecha_salida: string | null;
  entrenador_id: string;
  plan_id: string | null;
  estado: CorredorEstado;
  uniforme_entregado: boolean;
  proxima_carrera: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  paypal_payer_id: string | null;
  paypal_subscription_id: string | null;
  created_at: string;
  // joins opcionales
  plan?: Plan;
  entrenador?: Coach;
}

export interface Coach {
  id: string;
  nombre: string;
  telefono: string | null;
  auth_user_id: string | null;
  created_at: string;
}

export interface Pausa {
  id: string;
  corredor_id: string;
  mes: number;
  año: number;
  tarifa_mantenimiento: number;
}

export interface Transaccion {
  id: string;
  tipo: TransaccionTipo;
  descripcion: string;
  monto: number;
  comision: number;
  comision_impuesto: number;
  monto_neto: number;
  fecha: string;
  categoria: string;
  metodo: TransaccionMetodo;
  estado: TransaccionEstado;
  corredor_id: string | null;
  pagado_a: string | null;
  stripe_payment_id: string | null;
  paypal_order_id: string | null;
  created_at: string;
  // joins opcionales
  corredor?: Pick<Corredor, "id" | "nombre">;
  pagos_aplicados?: PagoAplicado[];
}

export interface PagoAplicado {
  id: string;
  transaccion_id: string;
  corredor_id: string;
  año: number;
  mes: number;
  monto: number;
  aplicado_automatico: boolean;
  created_at: string;
}

export interface PagoSinAsignar {
  id: string;
  fuente: PagoFuente;
  payload: Record<string, unknown>;
  monto: number;
  fecha: string;
  resuelto: boolean;
  created_at: string;
}

export interface CorredorEmail {
  id: string;
  corredor_id: string;
  email: string;
  etiqueta: string | null;
  es_principal: boolean;
  created_at: string;
}

export type HistorialTipo = "cambio_plan" | "cambio_estado" | "pausa" | "nota";

/** Entrada unificada para el timeline del corredor (historial + pausas) */
export interface HistorialItem {
  id: string;
  corredor_id: string;
  fecha: string; // ISO string
  tipo: HistorialTipo;
  // cambio_plan
  plan_anterior: { id: string; nombre: string } | null;
  plan_nuevo: { id: string; nombre: string } | null;
  // cambio_estado
  estado_anterior: CorredorEstado | null;
  estado_nuevo: CorredorEstado | null;
  // pausa
  mes: number | null;
  año: number | null;
  tarifa_mantenimiento: number | null;
  // nota / manual
  nota: string | null;
  creado_por_user: { id: string; nombre: string } | null;
}
