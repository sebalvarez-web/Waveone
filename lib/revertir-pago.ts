import type { createServerClient } from "@/lib/supabase-server";

type Supabase = ReturnType<typeof createServerClient>;

/**
 * Marks a transaction as reembolsado and inserts negative pagos_aplicados
 * records to reverse the debt reduction on the corredor.
 */
export async function revertirPago(
  supabase: Supabase,
  where: { stripe_payment_id?: string; paypal_order_id?: string }
): Promise<void> {
  const column = where.stripe_payment_id ? "stripe_payment_id" : "paypal_order_id";
  const value  = where.stripe_payment_id ?? where.paypal_order_id;
  if (!value) return;

  // 1. Mark transaction as reembolsado and get its id
  const { data: tx } = await supabase
    .from("transacciones")
    .update({ estado: "reembolsado" })
    .eq(column, value)
    .select("id, corredor_id")
    .maybeSingle();

  if (!tx) return; // transaction not found — nothing to reverse

  // 2. Fetch existing pagos_aplicados for this transaction
  const { data: aplicados } = await supabase
    .from("pagos_aplicados")
    .select("corredor_id, año, mes, monto, aplicado_automatico")
    .eq("transaccion_id", tx.id) as unknown as {
      data: { corredor_id: string; año: number; mes: number; monto: number; aplicado_automatico: boolean }[] | null;
    };

  if (!aplicados?.length) return;

  // 3. Insert one negative record per pago_aplicado to cancel it out
  const negativos = aplicados.map((p) => ({
    transaccion_id: tx.id,
    corredor_id: p.corredor_id,
    año: p.año,
    mes: p.mes,
    monto: -Math.abs(p.monto),
    aplicado_automatico: true,
  }));

  const { error } = await supabase.from("pagos_aplicados").insert(negativos);
  if (error) console.error("revertirPago insert error:", error.message);
}
