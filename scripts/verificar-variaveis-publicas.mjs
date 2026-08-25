// Blueprint §4.1 (V2/V3): nada que seja segredo pode viajar em variavel publica.
// `NEXT_PUBLIC_` vai inteiro para o bundle do navegador.
import { globSync, readFileSync } from 'node:fs';

const PROIBIDOS = /NEXT_PUBLIC_[A-Z0-9_]*(SUPABASE|SERVICE_ROLE|SECRET|SEGREDO|TOKEN|KEY|SENHA)/;

const arquivos = [
  ...globSync('src/**/*.{ts,tsx}'),
  ...globSync('*.{ts,mts,mjs}'),
  ...globSync('.env.example'),
];

const achados = [];
for (const arquivo of arquivos) {
  readFileSync(arquivo, 'utf8')
    .split('\n')
    .forEach((linha, indice) => {
      if (PROIBIDOS.test(linha)) achados.push(`${arquivo}:${indice + 1}  ${linha.trim()}`);
    });
}

if (achados.length > 0) {
  console.error(`Variavel publica carregando segredo:\n${achados.join('\n')}`);
  process.exit(1);
}
console.log(`variaveis publicas: ok (${arquivos.length} arquivos)`);
