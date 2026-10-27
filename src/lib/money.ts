const ARS_NUMBER_FORMAT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

// Pesos enteros, sin decimales ni espacio especial: "$37.000"
export function formatArs(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`Monto inválido: ${amount}`);
  }
  return `$${ARS_NUMBER_FORMAT.format(amount)}`;
}
