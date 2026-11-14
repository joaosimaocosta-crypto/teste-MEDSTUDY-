// Arquivo de inicialização (CommonJS) para o "Setup Node.js App" do cPanel (Phusion Passenger).
// O Passenger carrega este arquivo com require(); o resto da app é ESM, por isso
// é importado dinamicamente.
import('./src/server.mjs').catch((err) => {
  console.error('Falha ao iniciar a aplicação:', err);
  process.exit(1);
});
