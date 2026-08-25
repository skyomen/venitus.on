// Recusa marcador pendente sem issue vinculada (AGENTS.md, regras de spec).
// Sensível a maiúsculas de propósito: "todo" em português é palavra comum.
import { globSync, readFileSync } from 'node:fs';

const MARCADOR = /\b(TODO|FIXME|XXX|HACK)\b/;
const COM_ISSUE = /\b(TODO|FIXME|XXX|HACK)\b[^\n]*#\d+/;

const arquivos = globSync('src/**/*.{ts,tsx}');
const achados = [];

for (const arquivo of arquivos) {
  readFileSync(arquivo, 'utf8')
    .split('\n')
    .forEach((linha, indice) => {
      if (MARCADOR.test(linha) && !COM_ISSUE.test(linha)) {
        achados.push(`${arquivo}:${indice + 1}  ${linha.trim()}`);
      }
    });
}

if (achados.length > 0) {
  console.error(`Marcadores pendentes sem issue vinculada:\n${achados.join('\n')}`);
  process.exit(1);
}

console.log(`marcadores: ok (${arquivos.length} arquivos)`);
