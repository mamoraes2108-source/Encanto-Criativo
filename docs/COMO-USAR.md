# Seu ateliê digital — primeira versão

> Este documento registra a primeira versão. Para a versão 2.0 e instruções de Windows, consulte [VERSAO-2-WINDOWS.md](VERSAO-2-WINDOWS.md).

O README original foi preservado. Este guia é a documentação da aplicação.

## Para abrir no seu computador

Você precisa do **Node.js 24** (com npm). Ele pode ser instalado pelo site oficial do Node.js. Baixe a pasta deste projeto e abra um terminal dentro dela. Se precisar de ajuda para esse primeiro passo, informe se usa Windows ou Mac.

Na primeira vez, copie e execute:

```sh
npm ci
npm start
```

Mantenha o terminal aberto. No navegador do **mesmo computador**, digite `http://127.0.0.1:3000`. Para encerrar, pressione **Ctrl+C** no terminal. Nas próximas vezes, basta `npm start`. O navegador da sua máquina não acessa automaticamente o servidor que está nesta máquina na nuvem; para testar no seu computador, execute os comandos nele. Esta versão não foi publicada na internet.

## Um roteiro de teste de 10 minutos

1. Abra **Painel inicial**: os três pedidos e dois clientes iniciais são fictícios. Os indicadores excluem pedidos cancelados. Use filtros para período e origem dos dados; faturamento é o valor das vendas, não o dinheiro recebido.
2. Em **Clientes**, clique em **Novo cliente** e crie um nome fictício. A busca encontra nomes; **Histórico** mostra as compras.
3. Em **Custos e preços**, veja os materiais iniciais e seus preços fictícios. Use **Novo item** para seus próprios exemplos. Informe a data real de vigência conhecida, sem adivinhar.
4. Em **Pedidos**, clique em **Novo pedido**. Escolha o cliente fictício, as datas, o tema e a coleção. Escolha Peças ou Kits. Para 2 kits com 2 peças, a quantidade total é 4 peças: os modelos precisam somar 4 unidades. Embalagens e complementos têm suas próprias quantidades totais. Há limite de oito tipos de complemento. Descreva a arte nas observações; esta versão não armazena arquivos de arte.
5. Informe venda, impressão e outros custos totais. **Calcular custos** mostra custo, lucro bruto e margem; **Salvar pedido** registra a fotografia dos custos. Abra **Ver** para mudar produção ou pagamento. Esta versão permite alterar apenas os status de pedidos salvos; não há edição financeira, exclusão ou cálculo de saldo do pagamento parcial.
6. Experimente **Simulador**: os cálculos não criam vendas nem guardam orçamentos.
7. Cadastre uma **Nova vigência** para um modelo. Reabra o pedido antigo: seu custo e seu lucro devem permanecer iguais. Preços com a mesma data não são substituídos; outra vigência precisa ser criada.
8. Confira **Relatórios** e clique em **Exportar base completa · Excel**. O arquivo exporta todos os pedidos, clientes e o histórico de custos; os pedidos fictícios iniciais estão identificados. O arquivo é uma exportação para análise, não um backup completo para restauração.

Os dados digitados por você não recebem automaticamente a marca de demonstração: use nomes e observações que indiquem seus testes. Só os registros iniciais recebem essa marca.

## Teste a importação sem usar sua planilha real

Use o arquivo **examples/Vendas_Encanto_DEMO.xlsx**, que contém somente dados fictícios e as abas Resumo, Pedidos e Custos. Ele não é sua planilha original.

1. Vá a **Importar Excel**, selecione o arquivo fictício e clique em **Ler e pré-visualizar**.
2. Examine as abas. Escolha **Pedidos**, com cabeçalho na linha 1.
3. Associe cada campo à coluna correspondente. As colunas Tema, Coleção e Observações são opcionais; as demais são obrigatórias.
4. Clique em **Conferir todos os registros**. Leia todas as linhas, valores e datas apresentados. Erros impedem a confirmação.
5. Somente se estiver de acordo, marque **Conferi os registros e autorizo…** e clique em **Confirmar importação local**. Antes disso, nada é inserido no banco. Reimportações potencialmente duplicadas são bloqueadas.

O arquivo original é somente lido. O envio é mantido temporariamente na memória do processo, por até 30 minutos de validade, e não é gravado como planilha no servidor. Ao reiniciar o servidor, é necessário reenviar. Não use ainda `Vendas_Encanto.xlsx`: seu formato real não foi inspecionado. Antes de uma importação real, precisamos conferir sua estrutura e você precisa autorizar a operação. Nunca envie credenciais ou dados financeiros em um repositório público.

**Limites da primeira versão:** somente pedidos e nomes de clientes são importados. Resumo e Custos podem ser visualizados, mas não são convertidos em cadastros automaticamente. Não inventamos custos ausentes nem reconstruímos custos históricos com os preços atuais. A importação exige o custo histórico total conhecido, modelo, quantidade, status e datas de cada pedido. Custos individuais, embalagens e complementos não presentes no mapeamento não são inferidos; pedidos importados preservam o custo total, mas rankings de embalagens não incluem a composição ausente. Fórmulas são sinalizadas para conferência, não executadas. Datas textuais precisam estar em AAAA-MM-DD; datas armazenadas pelo Excel como datas também funcionam. Máximo: 8 MB, 10.000 linhas e 80 colunas por aba.

## Onde ficam os dados e como cuidar deles

O banco SQLite fica em `data/encanto.sqlite`, fora do controle de versão. Os dados sobrevivem ao fechamento do navegador e à reinicialização do servidor. **Não** ficam no armazenamento do navegador. SQLite mantém o histórico de cada pedido e faz a confirmação da importação em uma transação: se algo falhar, o lote não é salvo pela metade.

Para fazer uma cópia de segurança: encerre o sistema com Ctrl+C e copie a pasta **data inteira** para um local privado e protegido. Para restaurar, com o sistema parado, recoloque a pasta. Quem tiver acesso ao computador ou a essa cópia pode ler os dados: esta versão não possui login nem criptografia do banco. O servidor aceita acesso apenas do próprio computador por padrão; não o exponha à internet. Não altere HOST para abrir acesso externo durante os testes.

No ambiente de nuvem, a persistência depende da retenção do disco; exclusão ou substituição do ambiente pode remover o banco. Faça cópias privadas antes de trocar ou descartar o ambiente. A exportação Excel também contém dados pessoais e deve ser guardada com cuidado.

Antes de uso público, a próxima etapa deverá incluir autenticação, permissões, HTTPS, banco gerenciado, migrações versionadas e backups automáticos testados. Os identificadores únicos e os registros de preços e custos preservados permitem migrar para PostgreSQL sem recalcular o passado. Essa migração será desenvolvida e validada separadamente; não acontece automaticamente. Você será consultada antes de publicar ou importar dados reais.

## Comandos técnicos

```sh
npm ci             # instala as versões do package-lock.json
npm start          # inicia o sistema local na porta 3000
npm run dev        # reinicia o servidor ao editar arquivos
npm test           # testes de cálculo e integração, com banco temporário
npm run test:e2e   # teste de interface em Chromium, banco separado em data/e2e
npm audit          # verifica alertas conhecidos de dependências
```

O teste de interface usa `/usr/bin/chromium` neste ambiente. Em outro computador, instale Chromium e defina `CHROMIUM_PATH` com o caminho do executável, ou ajuste o arquivo `playwright.config.js` para usar o navegador instalado pelo Playwright (`npx playwright install chromium`, removendo `executablePath`). Os testes de integração usam a porta 3198 e os de interface usam 3199; mantenha essas portas livres. Não há etapa de compilação: os arquivos web são servidos diretamente.

Configurações opcionais: `PORT` (padrão 3000), `DATA_DIR` (padrão `./data`) e `HOST` (padrão `127.0.0.1`). Execute os comandos sempre na pasta do projeto. Use Node.js 24 para o módulo SQLite nativo.
