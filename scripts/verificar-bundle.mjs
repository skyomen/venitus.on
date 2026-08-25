// O navegador não recebe credencial de banco (blueprint AD-3, §4.1 V2/V3).
//
// Esta verificação lê o que foi realmente entregue ao cliente, não o que o código
// pretendia entregar. Roda depois do build.
import { globSync, readFileSync } from 'node:fs';

function ler(nome) {
  const valor = process.env[nome];
  return valor === undefined || valor === '' ? null : valor;
}

const SEGREDOS = [
  ['SUPABASE_SERVICE_ROLE_KEY', ler('SUPABASE_SERVICE_ROLE_KEY')],
  ['SUPABASE_ANON_KEY', ler('SUPABASE_ANON_KEY')],
  ['SUPABASE_DB_URL', ler('SUPABASE_DB_URL')],
  ['CHAVE_CRIPTOGRAFIA_CREDENCIAIS', ler('CHAVE_CRIPTOGRAFIA_CREDENCIAIS')],
].filter(([, valor]) => valor !== null && valor.length >= 12);

const arquivos = globSync('.next/static/**/*.{js,css,map}');

if (arquivos.length === 0) {
  console.error('Nenhum arquivo estático encontrado. Rode `npm run build` antes.');
  process.exit(1);
}

const achados = [];
for (const arquivo of arquivos) {
  const conteudo = readFileSync(arquivo, 'utf8');
  for (const [nome, valor] of SEGREDOS) {
    if (conteudo.includes(valor)) achados.push(`${arquivo}: contém ${nome}`);
  }
  // O papel de serviço nunca deve ser mencionado no cliente, nem por engano.
  if (conteudo.includes('service_role')) achados.push(`${arquivo}: menciona service_role`);
}

if (achados.length > 0) {
  console.error(`Credencial no bundle do navegador:\n${achados.join('\n')}`);
  process.exit(1);
}

const verificados = SEGREDOS.map(([nome]) => nome).join(', ');
console.log(
  `bundle: ok (${arquivos.length} arquivos, ${SEGREDOS.length} segredos verificados: ${verificados || 'nenhum no ambiente'})`,
);
