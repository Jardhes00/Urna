# Urna Online

Votação anônima por link, com painel administrativo e geração automática de **PowerPoint (.pptx)** e **Excel (.xlsx)** a partir do resultado oficial.

- Participantes votam pelo celular ou computador, **sem cadastro, e-mail ou login**.
- O organizador cria a votação, compartilha o link, acompanha o ranking ao vivo, finaliza e baixa os arquivos.
- Votos em **várias categorias**, voto **em branco** opcional e **modo apresentação** com revelação por suspense (recursos da versão original, preservada em `legacy/index.html`).

---

## Executar localmente

Requisito: **Node.js 22.13 ou superior** (testado no 24). O banco é o SQLite embutido no Node (`node:sqlite`), sem compilação nativa nem serviço externo.

```bash
npm install
cp .env.example .env        # defina ADMIN_PASSWORD
npm start                   # http://localhost:3000
```

| Endereço | Para quem |
|---|---|
| `http://localhost:3000/admin` | Organizador (pede a senha `ADMIN_PASSWORD`) |
| `http://localhost:3000/v/<id>` | Participantes (link gerado pelo painel) |

Sem `ADMIN_PASSWORD` em desenvolvimento, uma senha temporária é exibida no terminal.

O painel sempre traz em **rascunho** a **urna pronta**, definida pela lista no início de `server/db/seed.js`. Se ela for excluída, volta de duas formas:

- automaticamente, ao reiniciar o servidor;
- na hora, pelo botão **Criar urna pronta** do painel.

Edições feitas só pelo painel não ficam nessa lista e não são recuperadas: o que não pode se perder, escreva em `seed.js`. Para não criar a urna automaticamente, use `SEED_LEGACY_POLL=0`; o botão continua disponível.

Para testar no celular na mesma rede Wi-Fi, abra o painel pelo IP do computador (ex.: `http://192.168.0.10:3000/admin`), assim o link copiado já usa esse endereço.

## Referências da cultura pop

As frases sorteadas nas telas ficam em `public/js/shared/quips.js`, separadas por momento (categorias, confirmação, voto registrado, "já votou", apresentação…). Para acrescentar uma, inclua `{ emoji, text, source }` na lista. Não precisa reiniciar o servidor: basta recarregar a página. Elas nunca substituem instruções nem mensagens de erro.

Não há página inicial: o endereço principal leva à votação aberta ou, se não houver, ao painel.

## Imagens das alternativas

> **Desativadas por padrão.** Para usar, defina `OPTION_IMAGES=1` no `.env` e reinicie o servidor. Desativadas, elas não aparecem em nenhuma tela nem no PowerPoint, mas as já salvas continuam no banco.

- **Pelo painel:** Editar → "Imagens das alternativas" → **Anexar** em cada alternativa → **Salvar alterações**.
  - A foto é cortada no centro em quadrado e reduzida no próprio navegador, para JPG de 640px (~100 KB).
  - Só funciona com a votação em rascunho.
- **Pelo código:** em `server/db/seed.js`, use `{ nome: 'Brahma', imagem: 'bebida-cerveja.png' }`, com o arquivo em `server/db/seed-images/`.
- **Ilustrações prontas:** as de bebidas, Brasil x Marrocos e Nulo têm o código-fonte SVG em `server/db/seed-images/fontes/`. Para regerar os PNG: `node scripts/render-seed-images.mjs`.
- **Onde aparecem:**
  - na cédula, em 64px, ao lado do nome;
  - na revisão do voto;
  - no ranking do painel;
  - no modo apresentação, com a foto do vencedor;
  - no **PowerPoint**, no espaço da foto dos colocados e do campeão (imagem comum, que dá para trocar). Alternativas sem imagem mantêm o espaço "INSIRA A FOTO".
- **Segurança:**
  - o servidor só aceita PNG/JPG verdadeiros, conferidos pelo conteúdo do arquivo; SVG é recusado;
  - as imagens ficam no próprio banco e são servidas em `/img/<id aleatório>`.
- **Duplicar como rascunho:** cria uma votação nova com as mesmas categorias, alternativas e imagens, sem votos nem códigos. Serve para reaproveitar uma votação já aberta ou encerrada.

## Fluxo de uso

1. **Painel → Nova votação:**
   - informe título, categorias e opções (uma por linha, podendo colar uma lista);
   - escolha a forma de participação;
   - opcionalmente, defina um horário de encerramento automático.
2. **Abrir votação:** pede confirmação. Depois de aberta, a estrutura da votação fica travada.
3. **Copiar link / Compartilhar** e enviar aos participantes. No modo por códigos, gere os códigos, imprima ou copie os links individuais.
4. **Acompanhar:** totais e ranking atualizam a cada 5 s. Só o administrador vê os resultados.
5. **Finalizar votação e gerar apresentação:**
   - exige confirmação explícita, marcando uma caixa;
   - encerra a votação e grava o **snapshot oficial**;
   - baixa o `.pptx` automaticamente.
6. **Arquivos do resultado:** baixe a apresentação, a planilha ou os dois em `.zip`. O **Modo apresentação** revela os vencedores na tela.
7. **Excluir votação** (opcional): apaga todos os dados depois de baixar os arquivos.

## Voto único sem login: estratégia e limitações

Há dois modos, escolhidos por votação:

| | **Link aberto** (padrão) | **Códigos individuais** |
|---|---|---|
| Como funciona | O navegador gera uma chave aleatória de 256 bits, guardada no `localStorage` e exclusiva daquela votação. O servidor registra só o **hash** dela. | O admin gera códigos `XXXX-XXXX` aleatórios. Cada um vale para **um** voto, e o servidor marca o uso. |
| Impede | Recarregar a página, clique duplo, voltar e votar de novo, envios simultâneos. | Tudo isso, mais votar de novo em outro navegador ou aparelho. |
| **Não impede** | Quem limpa os dados do navegador, usa aba anônima ou outro aparelho consegue votar de novo. | Uma pessoa que receba dois códigos vota duas vezes; a distribuição é responsabilidade do organizador. |
| Indicado para | Grupos de confiança, enquetes informais. | Premiações e decisões em que repetir o voto importa. |

Para ~20 participantes com resultado relevante, **recomenda-se o modo por códigos**.

Garantias técnicas, comuns aos dois modos:

- **Registro atômico.** Numa única transação SQLite (`BEGIN IMMEDIATE`), o servidor:
  1. confere se a votação está aberta;
  2. insere a participação (chave primária `(votação, hash)`);
  3. soma os votos.

  Se o hash já existe, nada é gravado e a resposta é `409 ALREADY_VOTED`. Testado com 30 envios simultâneos da mesma chave: só 1 é aceito.
- **O IP não decide quem vota**, porque muitas pessoas compartilham o mesmo IP no Wi-Fi ou no 4G. Ele é usado apenas num limitador de taxa folgado (`VOTE_RATE_LIMIT`, 120 envios/min por IP), contra scripts.
- **Não usamos CAPTCHA.** Ele envia dados do visitante a terceiros (Google/Cloudflare) e atrapalha a votação no celular. Para ~20 pessoas, o limitador de taxa mais o modo por códigos é a proteção proporcional.

> **Não existe forma de garantir "uma pessoa = um voto" com anonimato total e sem nenhum mecanismo de identificação.** O modo por códigos chega o mais perto possível: garante um voto por código, e a distribuição dos códigos fica fora do sistema.

## Como o anonimato é protegido

- **Não existe registro individual de voto.**
  - Cada voto apenas incrementa contadores (`options.votes`, `categories.blank_votes`).
  - Não há tabela de cédulas, nem horário, nem ordem que permita reconstruir o que alguém escolheu.
- **Participação e conteúdo estão separados.**
  - A tabela `participations` guarda só `(votação, hash)`, sem horário, e é `WITHOUT ROWID`. Com isso, as linhas ficam ordenadas pelo hash, e não pela ordem de chegada.
  - Nenhuma coluna liga essa tabela aos contadores.
- **Nenhum dado pessoal é coletado:** sem nome, e-mail, senha de eleitor, IP gravado, cookies de rastreamento, fontes ou scripts de terceiros. A página do eleitor só carrega arquivos do próprio servidor (CSP `default-src 'self'`).
- **O painel mostra quantos códigos foram usados, nunca quais.**

**Limitações honestas:**

- **Logs de acesso:** quem administra o servidor tem acesso aos logs de acesso do provedor de hospedagem (IP e horário de requisições). Cruzando o horário de um voto com a variação dos contadores, em votações com poucos votantes simultâneos, seria teoricamente possível inferir um voto. Isso vale para qualquer sistema online sem criptografia de ponta a ponta.
- **Votos unânimes:** em categorias com resultado unânime, o próprio total revela o voto de todos. Isso é inerente à divulgação do resultado.
- **Códigos:** no modo por códigos, o banco sabe **quais** códigos foram usados. Se o organizador anotar quem recebeu cada código, saberá **quem votou**, mas **não em quem**. Para evitar isso, distribua os códigos sem registrar a quem foram entregues (ex.: sorteio de papeis impressos).

## Painel administrativo e segurança

- **Login:** por senha (`ADMIN_PASSWORD`, apenas no servidor).
  - Sessão em cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` em produção), com validade configurável.
  - O banco guarda só o hash da sessão.
  - Login limitado a 10 tentativas a cada 15 min por IP.
  - Senha comparada em tempo constante.
- **Autorização no servidor:** toda rota `/api/admin/*` exige a sessão. Esconder a rota no front-end não é a proteção.
- **API pública:** apenas lê a cédula e envia o voto. Não expõe contagens e não permite alterar nem apagar votos.
- **Proteções do navegador:**
  - **CSRF:** exige `application/json` e verifica a origem.
  - **XSS:** nenhum `innerHTML` com dados; o texto entra via `textContent`, e o CSP é estrito, sem scripts inline.
- **Validação dupla:** no navegador, para retorno imediato, e sempre de novo no servidor.
- **Integridade dos arquivos:**
  - Ao encerrar, o resultado é gravado como snapshot com hash SHA-256.
  - Antes de gerar qualquer arquivo, o sistema confere o hash e a aritmética: a soma de cada categoria deve ser igual ao total de cédulas.
  - Arquivos só são gerados com a votação **encerrada**, quando não podem mais chegar votos.
  - O "código de verificação" impresso no último slide e na planilha identifica o snapshot.

## Arquivos gerados

**PowerPoint** (16:9, todo editável: textos, formas, tabelas e **gráficos nativos** com "Editar dados"):

- **Capa:** título, descrição e data.
- **Resumo:** indicadores, período e forma de participação.
- **Panorama:** vencedor de cada categoria.
- **Por categoria:**
  - abertura com estatísticas (válidos, brancos, opções);
  - gráfico de barras, com o 1º em dourado;
  - **ranking completo** paginado em 10 linhas por slide;
  - slides do 3º e do 2º colocados;
  - slide do **campeão**;
  - slide "Sobre o campeão", com campos de descrição, curiosidades e observações.
- **Encerramento.**
- **Espaços para fotos:**
  - São **placeholders reais de imagem** do PowerPoint, com a instrução "INSIRA A FOTO DO CAMPEÃO AQUI". Basta clicar no ícone e escolher a foto.
  - Legendas e descrições também são placeholders. Se ficarem vazios, não aparecem na apresentação.
- **Empates:** todos os empatados aparecem como 1º lugar, cada um com seu slide de campeão. Nenhum critério de desempate é aplicado.

**Excel:**

- **Resumo:**
  - dados da votação;
  - tabela por categoria: válidos, brancos, total, % brancos, 1º lugar e %;
  - **total geral**;
  - linha de conferência.
- **Ranking completo:** categoria, posição, opção, votos, % dos válidos e empate.
  - Posição, percentual e empate são **fórmulas** (`COUNTIFS`/`SUMIFS`), com o valor oficial já gravado.
  - Formatação de números e percentuais, filtro e cabeçalho fixo.

Percentuais são sobre **votos válidos**: votos em branco não entram no ranking.

## Estrutura do código

```
server/
  index.js              inicialização
  app.js                composição (repositórios → serviços → rotas)
  config.js             variáveis de ambiente
  db/                   conexão SQLite, transações e migrações SQL
  repositories/         acesso a dados (votações, cédulas, códigos, sessões)
  services/             regras: votação, apuração/ranking, snapshot, exportação
  exporters/pptx/       masters/layouts, slides gerais, slides por categoria, pós-processamento
  exporters/xlsx.js     planilha
  middleware/           autenticação, segurança, limite de taxa, erros
  routes/               API pública, autenticação, API administrativa
public/
  css/                  tokens (design system), base, componentes, páginas
  js/shared/            DOM seguro, ícones, cliente HTTP, avisos/diálogos, formatação
  js/vote/              cédula: armazenamento local, telas, controlador
  js/admin/             painel: roteador, telas e componentes
test/unit, test/api     testes de regras e de API (servidor real, banco em memória)
test/e2e                teste em navegador real (Edge/Chrome)
legacy/index.html       versão original, mantida para referência
```

O PptxGenJS 4.0.1 tem dois defeitos no XML gerado, corrigidos em `server/exporters/pptx/postprocess.js`:

- placeholders de imagem saem sem `type="pic"`;
- `<a:pPr>` sai repetido no meio de parágrafos, o que pode disparar o aviso "reparar arquivo".

Os testes verificam as duas correções.

## Testes

```bash
npm test            # 31 testes de unidade e API
npm run test:e2e    # 9 testes em navegador real (usa o Microsoft Edge instalado)
# BROWSER_CHANNEL=chrome npm run test:e2e   → usa o Google Chrome
# SCREENSHOT_DIR=./capturas npm run test:e2e → salva capturas de cada tela
```

## Publicar na internet

O sistema é **um único serviço Node.js com um arquivo SQLite**. Precisa de um host com **disco persistente**.

> Plataformas serverless (Vercel, Netlify Functions) **não servem**: o sistema de arquivos delas é temporário e os votos se perderiam.

**Render (com o `render.yaml` incluso):**

1. Envie o projeto para um repositório no GitHub.
2. No Render: *New → Blueprint* → selecione o repositório.
3. Defina `ADMIN_PASSWORD` (12+ caracteres) e, se quiser, `PUBLIC_BASE_URL` com o domínio final.
4. O disco persistente (`/data`) exige plano pago. O HTTPS é automático.

**Qualquer VPS ou servidor com Docker:**

```bash
docker build -t urna-online .
docker run -d -p 3000:3000 -v urna-data:/data \
  -e ADMIN_PASSWORD='uma-senha-longa-e-forte' \
  -e PUBLIC_BASE_URL='https://urna.seudominio.com.br' \
  urna-online
```

**Use HTTPS na frente**, com um proxy reverso (Caddy ou Nginx) ou com o próprio provedor. Em produção, o cookie de sessão é `Secure` e só funciona com HTTPS.

**Backup:** copie o arquivo `urna.db` com o serviço parado, ou use `sqlite3 urna.db ".backup copia.db"`.

**Escala:** o SQLite em um único processo atende com folga centenas de votos por minuto. Não rode várias instâncias apontando para o mesmo arquivo em discos de rede.

## Política de retenção de dados

| Dado | Guardado | Por quanto tempo |
|---|---|---|
| Configuração da votação, contadores e snapshot oficial | Sim | Até o administrador **excluir a votação** |
| Hash da chave do navegador ou do código usado | Sim, sem horário | Até excluir a votação |
| Códigos de participação (texto) | Sim, para reimpressão | Até excluir a votação |
| Votos individuais, nomes, e-mails, IPs | **Não são gravados** pela aplicação | — |
| Sessões do administrador | Hash da sessão | Expiram em `SESSION_TTL_HOURS` e são limpas a cada login |

Recomendação: **baixe os arquivos e exclua a votação** quando ela não for mais necessária. Logs de acesso do provedor de hospedagem seguem a política do provedor.

## Dependências

| Pacote | Uso |
|---|---|
| `express` 5 | servidor HTTP |
| `pptxgenjs` 4 | geração do PowerPoint |
| `exceljs` 4 | geração do Excel |
| `jszip` | pós-processamento do .pptx e pacote .zip |
| `playwright-core` (dev) | teste em navegador real usando o Edge ou Chrome já instalado |

As fontes Fraunces e Figtree (licença SIL Open Font, textos em `public/fonts/`) ficam no próprio projeto: as páginas não fazem nenhuma requisição a terceiros. A identidade visual está em `public/css/tokens.css`; a classe `theme-night` aplica o tema escuro a qualquer trecho da interface.

O `npm audit` aponta alertas em dependências internas:

- **`image-size`**, usada pelo PptxGenJS **só ao inserir imagens**. O sistema não insere imagens, só placeholders.
- **`uuid`**, usada pelo ExcelJS: o alerta vale só quando um *buffer* é passado como parâmetro, o que a biblioteca não faz.

Nenhum dos dois caminhos é alcançável por entrada de usuários.
