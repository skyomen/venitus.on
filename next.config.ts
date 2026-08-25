import type { NextConfig } from 'next';

// Cabeçalhos de segurança da seção 4.5 do blueprint, definidos em um lugar só.
const cabecalhosSeguranca = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // O `next dev` acrescenta um bloco próprio ao AGENTS.md a cada execução, o que
  // deixaria a worktree suja e contraria a regra do portão. O aviso dele é útil e
  // está reescrito na seção "Como trabalhar aqui" do nosso AGENTS.md.
  agentRules: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: cabecalhosSeguranca }];
  },
};

export default nextConfig;
