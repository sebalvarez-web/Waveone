-- Añade columna "pagado_a" a la tabla transacciones para registrar
-- el destinatario del gasto. Permite null para no romper data existente.
ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS pagado_a TEXT;

-- Index para acelerar el autocomplete por destinatario en gastos.
CREATE INDEX IF NOT EXISTS idx_transacciones_pagado_a
  ON transacciones (pagado_a)
  WHERE pagado_a IS NOT NULL;
