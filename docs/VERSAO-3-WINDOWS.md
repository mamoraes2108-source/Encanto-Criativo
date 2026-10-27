# Encanto Criativo 3.0 — atualização no Windows

Esta versão parte de `correcao-limpeza-colecoes`, commit `8c3d715a3356214b7b251d89797128cfb5b1927a`, na branch `versao-3-gestao`. O histórico da versão 2.0 permanece na ancestralidade. Não há reimportação ou limpeza automática dos pedidos.

## Atualizar uma vez, preservando a instalação anterior

1. Pare a instalação atual com **Ctrl+C** na janela do sistema. Feche as páginas abertas.
2. Guarde a pasta atual inteira como sua **versão anterior**. Ela contém o programa, seu banco e anexos. Mantenha essa pasta intacta.
3. Extraia o ZIP da versão 3.0 em **uma pasta nova**, por exemplo `Encanto-Criativo-3`. Não extraia sobre a pasta anterior.
4. Copie a pasta **data inteira** da instalação anterior para a pasta nova. Antes de iniciar, confira que existe `data\encanto.sqlite` na pasta nova. Não copie somente o arquivo SQLite: anexos e arquivos auxiliares também devem acompanhar a cópia.
5. Se utiliza um `DATA_DIR` personalizado, copie esse diretório inteiro para um novo local e ajuste o atalho/configuração para a cópia. As duas versões precisam ter seus próprios dados. O Node não carrega `.env` automaticamente.
6. Com **Node.js 24** instalado, abra **Atualizar-Dependencias.bat** na pasta nova. A primeira preparação precisa de internet para baixar bibliotecas. Ela não importa pedidos nem limpa dados. Os testes técnicos usam dados fictícios temporários. Se a janela informar falha, conserve a instalação anterior e não prossiga.
7. Abra **Iniciar-Encanto.bat** na pasta nova e acesse **http://127.0.0.1:3000**. Mantenha a janela aberta durante o uso.

O assistente instala bibliotecas antes de criar o ZIP de backup, pois a criação do ZIP depende delas; instalar bibliotecas não abre o banco. O sistema cria outro backup consistente e verificável **antes de abrir um banco existente para gravação**. Uma falha de backup interrompe a inicialização. Os backups ficam em `data\backups`, ou no diretório de dados personalizado. Nenhuma rotina desta atualização acessou seu banco real.

Não execute duas versões ao mesmo tempo. Não aponte as duas para o mesmo banco. Não reimporte os 43 pedidos.

## Recuperar a versão anterior

Pare a versão 3.0 e abra **Iniciar-Encanto.bat na pasta anterior**, usando os dados preservados naquela pasta. Isso recupera o momento da cópia anterior. Se já houve lançamentos na versão 3.0, guarde também sua pasta: esses lançamentos posteriores não existem na cópia antiga.

Para recuperar um backup verificado, o menu **Backup e restauração** restaura em uma pasta nova e não substitui o banco ativo. Preserve também a pasta do programa correspondente. Nunca copie um banco recuperado por cima de outro sem conservar ambos.

## Importar somente o catálogo real

1. Abra **Importar Excel**, selecione sua planilha e clique em **Ler e pré-visualizar**. O arquivo é apenas lido; não é alterado.
2. Escolha a aba **Custos** e a linha do cabeçalho.
3. Use a seção **Materiais e histórico de custos**. Associe **Nome**, **Categoria**, **Custo** e **Vigência** às colunas corretas. Não use os botões de importação de pedidos.
4. Quando necessário, relacione cada categoria da planilha ao grupo **Modelo**, **Embalagem** ou **Complemento**. Canecas e xícaras são modelos; chocolates e outros materiais podem ser complementos. A categoria original também fica registrada. Uma categoria não reconhecida precisa dessa associação explícita.
5. Clique em **Conferir materiais**. Confira todas as linhas, custos e datas. Datas reais do Excel, `AAAA-MM-DD` e `DD/MM/AAAA` são aceitas. Fórmulas usam o resultado armazenado pelo Excel; o sistema não calcula a planilha.
6. Duplicidades de nome e vigência ou categorias incompatíveis bloqueiam a confirmação. Um nome fictício ativo também bloqueia a mistura com um produto real: primeiro confira e arquive o fictício na tela de custos.
7. Marque a autorização e confirme **somente a importação de materiais**. Um backup é criado e verificado antes da transação. Vigências novas são acrescentadas, sem substituir preços anteriores. Os custos dos pedidos salvos não são recalculados.

Use a linha do cabeçalho e o campo **Última linha de materiais** para delimitar a tabela, deixando totais e notas de rodapé fora da importação sem editar a planilha. Linhas não vazias com dados inválidos dentro desse intervalo bloqueiam a confirmação. Não invente vigências para liberar a importação. Limites: arquivo XLSX de até 8 MB, até 10.000 linhas e 80 colunas por aba.

## Retirar os cinco itens fictícios

Em **Custos e preços → Conferir itens fictícios**, selecione somente os itens conferidos. A prévia mostra o número de pedidos vinculados e a consequência: **arquivamento**, preservando IDs, preços e vínculos antigos. Só entram na lista os cinco nomes conhecidos que ainda têm a marca explícita de demonstração.

Digite **ARQUIVAR SOMENTE ITENS FICTÍCIOS** e confirme. O sistema verifica um backup antes de arquivar. Se os dados mudarem desde a prévia, a operação é bloqueada para nova conferência. Arquivados deixam de aparecer em novos pedidos e no simulador; continuam disponíveis para a leitura dos pedidos antigos. Nenhum produto real é excluído por semelhança de nome.

## Despesas, compras e finanças

Abra **Despesas e compras → Novo lançamento**. Informe data, descrição, tipo, categoria e valor. Escolha **Pago** apenas quando houver pagamento efetivo, informando sua data e forma. Para gastos ainda não pagos, use **Pendente**. O vínculo a um pedido é opcional.

| Tipo                              | Resultado gerencial                                                                                   | Caixa                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Materiais comprados               | Não desconta novamente a compra integral. O custo consumido já está salvo nos pedidos.                | Registra a compra integral na data em que foi paga. |
| Operacional adicional             | Reduz o lucro estimado uma vez. Se vinculada, acompanha a data da venda; se geral, a data da despesa. | Registra a saída quando paga.                       |
| Operacional já incluída no pedido | Não reduz outra vez o lucro.                                                                          | Registra o pagamento efetivo.                       |
| Equipamentos                      | Não deduz o investimento do lucro operacional; não calcula depreciação.                               | Registra a saída quando paga.                       |

**Exemplo:** compra de dez canecas por R$ 80 e venda de uma por R$ 30, com custo unitário de R$ 8. Sem outros custos, lucro bruto e gerencial de R$ 22. Se compra e recebimento ocorrerem no período, caixa de **R$ 30 − R$ 80 = −R$ 50**. Utilizar a caneca não cria outro desembolso.

**Uber específico do pedido:** se ele ainda não foi contabilizado no pedido, registre como **Operacional / Adicional**, vinculando o pedido. Se já aparece em **Outras despesas identificadas** daquele pedido, escolha **Já incluída no custo do pedido** e selecione a linha. Descrição e valor precisam coincidir; o sistema impede uma segunda vinculação à mesma linha. Não cadastre o mesmo gasto nas duas classificações. A revisão financeira do pedido protege linhas com pagamentos vinculados.

Lançamentos podem ser editados com motivo e controle de versão. Cancelar um lançamento não recalcula um pedido antigo; correções de custos de um pedido exigem a revisão financeira explícita já existente. Cancelamentos preservam o histórico. **Cancelar um lançamento pago não comprova estorno do fornecedor:** sua saída real permanece no caixa. Esta versão não automatiza devoluções de fornecedores; não use cancelamento para simular dinheiro devolvido.

No painel, filtre por período e categoria de despesas. A categoria restringe despesas e suas saídas, mantendo o faturamento geral. Na lista de despesas, o período usa a data do lançamento; no caixa, usa a data efetiva do pagamento. Recebimentos e estornos de clientes usam seus movimentos efetivamente registrados. Pagamentos históricos **a conferir** não recebem valores ou datas presumidos.

O **lucro líquido gerencial estimado** corresponde ao faturamento menos custos históricos dos pedidos e despesas operacionais adicionais. Ele não é saldo bancário. O **saldo de caixa do período** é a diferença entre entradas e saídas comprovadas naquele período, sem saldo inicial presumido. Não há estoque, avaliação automática de materiais disponíveis, conciliação bancária, depreciação ou apuração fiscal.

## Conferir pedidos e configurar o alerta

Em **Configurações**, defina o **Limite de margem baixa (%)**. O padrão é 25% e pode ser alterado.

Antes de salvar, use **Conferir custos e rateio** para visualizar produtos, quantidades, custos, venda, despesas e resultado gerencial. O salvamento apresenta os valores e pede confirmação; margens abaixo do limite recebem alerta. Você pode cancelar a confirmação e revisar os valores. Pedidos novos começam como reais; marque “Pedido fictício de teste” somente para uma demonstração deliberada.

As despesas vinculadas adicionais aparecem no resultado gerencial; as já incorporadas ao custo não são descontadas novamente. A fotografia financeira dos pedidos antigos continua intacta até uma revisão financeira expressamente confirmada.

## Agenda, coleções e clientes

- **Agenda:** escolha o mês e o status. O calendário usa a previsão de entrega, destaca atrasos e próximos três dias, e abre o pedido ao clicar. Datas e status acompanham o pedido após salvá-lo; reabrir a agenda apresenta os dados atualizados. Pedidos sem data aparecem abaixo. O filtro de período usa a data de entrega.
- **Coleções favoritas:** cinco coleções ordenadas por faturamento, peças ou lucro bruto, somente com pedidos reais ativos e respeitando o período. Prejuízos aparecem em barras rosadas e valores negativos.
- **Desempenho das coleções:** filtro por coleção e período; ordenação por faturamento, lucro, margem ou peças; participação no faturamento geral e edições anuais. A comparação usa o mesmo nome de coleção em anos diferentes e os dados do período escolhido. Não presume que meses sem campanha tiveram queda. A evolução mensal geral continua disponível.
- **Clientes:** a tela existente agora mostra posição, compras, peças, valor e última compra. Use o período e a ordenação para consultar o ranking sem duplicar cadastros. Demonstrações e cancelamentos ficam fora dos totais.

## Gerar o Pedido de Compra em PDF

1. Em **Configurações**, informe nome comercial, Pix, dados da empresa, Instagram, telefone e agradecimento padrão. Esses valores ficam no banco local, não no código.
2. Abra um pedido e clique em **Gerar Pedido de Compra (PDF)**.
3. Se desejar, personalize o agradecimento, arte ou embalagem para aquele pedido. Em branco, os campos usam os dados do pedido salvo e das configurações.
4. Clique em **Gerar Pedido de Compra (PDF)** e depois em **Baixar Pedido de Compra (PDF)**.

O layout segue a referência fornecida: logotipo, cabeçalho em três áreas, agradecimento, títulos em rosa queimado, detalhes, valores, Pix e entrega. As fontes acompanham o programa. A coleção é obtida do pedido de maneira consistente no cabeçalho e nos detalhes; pedidos com mais de uma coleção listam as coleções salvas.

O documento utiliza dados atuais do pedido. Gere novamente depois de uma revisão. Custos, lucro, margem e observações internas não aparecem. Quando faltam os valores unitários históricos, o documento informa a limitação sem inventá-los. Sinal e saldo são informados somente a partir dos recebimentos conhecidos; históricos não conciliados mostram **a conferir**.

**Preparar mensagem de WhatsApp** apenas coloca o texto em uma caixa para copiar. Não envia mensagens nem anexos. O PDF é confirmação comercial da encomenda, **não é nota fiscal**.

## Validação e privacidade

Os testes técnicos e de navegador foram executados com dados fictícios. Os casos incluem os 43 IDs, preservação de registros históricos, backup e restauração, compras em quantidade, despesas incorporadas e adicionais, filtros, agenda, importação de materiais, PDF e revisão de custos. O banco e a planilha reais não foram utilizados. O PDF de referência foi consultado localmente; seus dados pessoais e comerciais não foram copiados para código ou testes. Apenas o logotipo foi extraído para reproduzir a identidade solicitada.

O programa continua restrito a localhost. Não foi implantado em hospedagem pública. A validação ocorreu em Linux com Node.js 24 e Chromium; os atalhos Windows foram revisados, mas não executados em um Windows real neste ambiente. O assistente executa os testes técnicos automaticamente, sem exigir testes manuais da proprietária. Resultado desta entrega: **39 testes técnicos e 9 testes de navegador aprovados**.
