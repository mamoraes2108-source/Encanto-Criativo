# Validação da versão 3.0

Base exata: `8c3d715a3356214b7b251d89797128cfb5b1927a`, branch `correcao-limpeza-colecoes`. Implementação em `versao-3-gestao`, preservando os commits anteriores.

Ambiente de validação: Linux, Node.js 24 e Chromium. Nenhum banco real ou Excel comercial foi aberto. A referência PDF foi inspecionada localmente; apenas o logotipo foi extraído, sem copiar cliente, Pix ou contatos para os testes ou configurações padrão.

## Resultado

- `npm test`: **39 testes aprovados**.
- `npm run test:e2e`: **9 testes aprovados**.
- Revalidação dos três fluxos novos de navegador após a atualização automática da agenda: **3 aprovados**.
- Verificação do conteúdo do PDF com parser JavaScript, inclusive ausência de custos, lucro e margem; acesso ao documento exige sessão local válida.
- Inspeção visual de um PDF com dados fictícios e fontes incorporadas.
- Verificação de sintaxe, formatação e `git diff --check`.

## Proteções verificadas

O teste de integração da V3 cria 43 pedidos fictícios com IDs originais e totais de R$ 3.446,30 em vendas, R$ 1.754,01 em custos e R$ 1.692,29 em lucro bruto. Compara os registros completos de pedidos, clientes, pagamentos e anexos antes e depois de importar catálogo, arquivar demonstrações, editar/cancelar despesas, configurar informações comerciais e salvar a personalização de um PDF. Esses registros permanecem idênticos. A personalização do documento usa um ID próprio e não substitui o pedido.

Outros casos incluem backup válido antes da gravação, falha de backup impedindo a inicialização sem tocar no banco, restauração em nova pasta, prévia expirada/desatualizada, duplicidades, vigências, fotografia histórica de custos, compra de dez unidades com consumo de uma, despesas incorporadas sem segundo desconto, despesas adicionais por competência, pendências, estornos, cancelamentos, filtros e centavos.

Os testes de navegador cobrem regressões da V2, navegação móvel, importação de pedidos fictícios, importação exclusiva de materiais, confirmação de arquivamento, relatório com 43 pedidos fictícios e demonstrações excluídas, agenda após edição de data e status, alerta de margem, ranking de clientes, comparação anual de campanhas e download do PDF.

## Limitações declaradas

- Os atalhos BAT foram revisados, mas não executados em Windows neste ambiente. O instalador mantém os testes técnicos automáticos.
- A planilha comercial de custos não foi fornecida; o importador foi validado com planilhas fictícias, categorias mapeadas e diferentes vigências. A conferência real ocorrerá localmente na prévia.
- Sem estoque, depreciação, saldo bancário inicial ou recebimentos presumidos. O lucro gerencial é uma estimativa.
- Cancelar despesa paga não representa reembolso; a saída comprovada permanece no caixa. Devoluções de fornecedores não são automatizadas nesta versão.
- Campanhas anuais são comparadas pelo mesmo nome de coleção e pelas datas efetivamente disponíveis no período. Não há associação automática de nomes semelhantes.
- O PDF comercial não é nota fiscal. Documentos longos podem ocupar mais de uma página.

Não houve implantação pública, envio de mensagens ou merge na `main`. A entrega é feita por arquivos para instalação local e histórico Git separado.
