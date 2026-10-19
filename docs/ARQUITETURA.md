# Estrutura e decisões da versão 0.1

- `server.js`: API Express, persistência SQLite, importação e exportação Excel.
- `domain.js`: regras de vigência, quantidades, custos, lucro e margem.
- `public/`: interface em português, responsiva, sem fontes ou serviços externos.
- `test/`: regras financeiras e fluxo integrado usando banco temporário.
- `e2e/`: fluxo de navegador, incluindo viewport móvel.
- `examples/`: planilha exclusivamente fictícia para testar o importador.

## Modelo financeiro

Valores monetários são arredondados ao centavo. Cada item do pedido preserva ID, nome, categoria, custo unitário, quantidade e subtotal. Custos são escolhidos pela última vigência menor ou igual à data do pedido; a ausência de vigência impede registro. Impressão e outros custos são totais explícitos do pedido. Custo = soma dos materiais + impressão + outros. Lucro bruto = venda − custo; margem = lucro bruto / venda × 100. Venda zero tem margem indefinida. Não existe cálculo implícito de tributos, fretes, taxas ou despesas fixas: devem ser incluídos em outros custos quando conhecidos.

Pedidos usam IDs estáveis e fotografias financeiras independentes do catálogo. Kits guardam quantidade de kits, peças por kit e total de peças. A soma dos modelos deve corresponder ao total de peças. Cancelados permanecem no histórico, mas são excluídos dos indicadores. Relatórios usam data do pedido, não data de recebimento. O status Parcial é apenas informativo; contas a receber detalhadas são uma etapa futura.

## Persistência e expansão

SQLite mantém documentos JSON em tabela `records`, separados por tipo e identificados por UUID. A inicialização de demonstração acontece apenas uma vez. Transações protegem o lote importado e o início do banco. Esta estrutura é adequada ao protótipo local; uma próxima versão deverá normalizar tabelas, criar restrições e migrações de esquema, preservar os IDs e validar os totais ao migrar para PostgreSQL.

A API `/api` separa a interface da persistência. Futuras integrações com Canva, redes sociais e marketplaces devem ser adaptadores no servidor, com credenciais fora do código, autorização própria, idempotência e rastreamento de origem. Nenhuma integração externa é ativa nesta versão.

O importador usa tokens temporários, valida o lote novamente ao confirmar e bloqueia possíveis duplicatas com cliente, datas, peças, valores, modelo, tema e coleção iguais. Isso não substitui uma reconciliação real com identificadores da planilha. Pedidos idênticos legítimos precisam de análise antes de importar. Datas e custos faltantes não são preenchidos silenciosamente. A prévia da planilha mostra 12 linhas, enquanto a conferência apresenta todos os registros convertidos.

## Segurança e escopo

Servidor vinculado ao loopback por padrão, sem CORS liberado, com verificação de Origin para gravações, tamanho máximo de upload e dados locais ignorados pelo Git. O arquivo do banco é criado com permissão 0600 e diretório novo com 0700. Não há autenticação, criptografia em repouso ou isolamento entre usuários: não é um serviço pronto para publicação. `npm audit` deve ser executado antes de novas entregas. ExcelJS usa somente uuid v4; a dependência uuid foi atualizada por override para a versão corrigida 11.1.1, compatível com seu uso CommonJS.
