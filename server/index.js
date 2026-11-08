import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const { app } = createApp(config);

app.listen(config.port, config.host, () => {
  const url = `http://localhost:${config.port}`;
  console.log(`Urna Online rodando em ${url}`);
  console.log(`Painel administrativo: ${url}/admin`);
  if (config.generatedPassword) {
    console.log('\nADMIN_PASSWORD não definida — senha temporária gerada para esta execução:');
    console.log(`  ${config.adminPassword}`);
    console.log('Defina ADMIN_PASSWORD para uma senha fixa (obrigatório em produção).\n');
  }
});
