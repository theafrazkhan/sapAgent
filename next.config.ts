import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  experimental: { useTypeScriptCli: false },
  turbopack: { root: process.cwd() },
  serverExternalPackages: ['pg', 'exceljs', 'minio'],
  async rewrites(){return [{source:'/backend/:path*',destination:`${process.env.FASTAPI_URL||'http://127.0.0.1:8000'}/:path*`}];},
  async headers() { return [{ source: '/:path*', headers: [
    {key: 'X-Content-Type-Options', value: 'nosniff'},
    {key: 'X-Frame-Options', value: 'DENY'},
    {key: 'Referrer-Policy', value: 'same-origin'},
    {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'}
  ]}]; }
};
export default config;
