// Arquivo de inicialização (CommonJS), usado pelo cPanel (Passenger) e pela Lunes (Pterodactyl).
// Se as dependências ainda não estiverem instaladas, instala-as antes de iniciar.
const { execSync } = require('node:child_process');

try {
  require.resolve('express', { paths: [__dirname] });
  require.resolve('baileys', { paths: [__dirname] });
} catch {
  console.log('[inicio] Instalando dependências (só na primeira vez, pode levar alguns minutos)...');
  execSync('npm install --omit=dev --no-audit --no-fund', { cwd: __dirname, stdio: 'inherit' });
}

// O resto da app é ESM, por isso é importado dinamicamente.
import('./src/server.mjs').catch((err) => {
  console.error('Falha ao iniciar a aplicação:', err);
  process.exit(1);
});
