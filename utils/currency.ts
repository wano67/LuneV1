export function safeCurrency(currency?: string | null): string {
  if (!currency) return 'EUR';
  if (currency.trim() === '') return 'EUR';
  try {
    // Validate currency code; Intl will throw for invalid codes
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(1);
    return currency;
  } catch {
    return 'EUR';
  }
}
