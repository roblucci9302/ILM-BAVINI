/**
 * Génère un message de salutation
 * @param name - Le nom à saluer
 * @returns Le message de salutation formaté
 */
export function greet(name: string): string {
  if (!name.trim()) {
    throw new Error('Le nom ne peut pas être vide');
  }
  return `Bonjour, ${name} ! 👋`;
}
