/**
 * Point d'entrée de l'application
 */

import { greet } from './utils/greet';

function main(): void {
  const message = greet('BAVINI');
  console.log(message);
}

main();
