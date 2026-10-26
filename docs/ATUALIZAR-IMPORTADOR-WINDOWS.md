# Atualizar a versão 2.0 no Windows

Correção na branch `correcao-importador-excel-ids`, baseada em `versao-2-gestao`. Não é necessário mesclar com main.

1. Pare o sistema na janela preta com **Ctrl+C** e feche as janelas do sistema. Não mantenha duas versões abertas.
2. Copie a pasta inteira da versão atual para uma pasta de segurança, por exemplo `Encanto-anterior-2026-10-26`. Inclua a pasta `data`, com banco, anexos e backups. Guarde essa cópia sem alterações.
3. Baixe o ZIP da branch corrigida: https://github.com/mamoraes2108-source/Encanto-Criativo/archive/refs/heads/correcao-importador-excel-ids.zip . Extraia em uma **nova pasta**, por exemplo `Encanto-2-corrigido`. Não extraia sobre a versão anterior.
4. Copie a pasta `data` inteira da instalação anterior para dentro da nova pasta, antes de iniciar. Se você usa `.env`, guarde também sua cópia; o Node não carrega esse arquivo automaticamente. Se configurou `DATA_DIR` no Windows ou em um atalho, copie os dados dessa localização para uma nova pasta e ajuste o atalho para a cópia. As duas versões não devem apontar para o mesmo banco. Na configuração padrão, os dados ficam em `data` ao lado de `server.js`.
5. Com Node.js 24 instalado, abra **Atualizar-Dependencias.bat** na nova pasta. Ele cria e verifica um backup, instala dependências e executa os testes automaticamente com dados fictícios. Se houver erro, não inicie: a pasta anterior continua preservada.
6. Abra **Iniciar-Encanto.bat** na nova pasta e acesse `http://127.0.0.1:3000`. A atualização não importa planilhas nem apaga pedidos. Não use a nova instalação se esqueceu de copiar o banco: sem banco, o sistema cria uma demonstração.

## Voltar à versão anterior

Pare a nova versão com Ctrl+C. Abra `Iniciar-Encanto.bat` na pasta anterior preservada, com seu próprio banco. Essa cópia representa o momento anterior à atualização; lançamentos feitos depois na versão nova não estarão nela. Preserve também a nova pasta se houver novos lançamentos.

## Conferir o Excel quando desejar

A atualização não importa dados automaticamente. Para pré-visualizar, escolha a aba Pedidos, cabeçalho na linha 6 e associe as colunas:

| Campo                       | Coluna                  |
| --------------------------- | ----------------------- |
| ID original                 | AC — ID original        |
| Cliente                     | D                       |
| Data do pedido              | A                       |
| Entrega                     | C                       |
| Modelo                      | F                       |
| Peças                       | G                       |
| Venda                       | Q                       |
| Custo histórico             | X                       |
| Produção                    | B                       |
| Pagamento                   | R                       |
| Tema                        | E                       |
| Observações                 | AB — Detalhes originais |
| Lucro da planilha, opcional | Y                       |

Deixe Coleção sem associação se não houver uma coluna própria. A conferência não grava pedidos. A confirmação da importação continua sendo uma ação explícita do usuário.

IDs são tratados como texto, com espaços externos removidos, preservando zeros iniciais e diferenças de maiúsculas. Vendas iguais com IDs distintos são aceitas. ID ausente ou repetido no arquivo gera pendência em todas as ocorrências; IDs já cadastrados bloqueiam reimportação. Nenhum pedido é escolhido ou descartado silenciosamente.

Datas brasileiras são validadas e normalizadas, inclusive separadores `/` repetidos; o valor original e o aviso ficam preservados. Agendado é convertido em Aberto com aviso e status original preservado. Fórmulas usam somente resultados armazenados pelo Excel; não são recalculadas. Linhas só formatadas, em branco ou contendo apenas fórmulas vazias/zeradas são ignoradas. Uma linha com conteúdo real incompleto continua sendo sinalizada.

Registros importados por versões antigas, que não gravavam o ID original, permanecem intactos. Não é possível reconhecer seus IDs retroativamente com segurança: confira esse histórico antes de uma futura importação. Esta atualização não atribui IDs nem remove registros antigos.

## Verificação da entrega

23 testes técnicos e 5 testes de navegador aprovados em Linux com Node.js 24 e Chromium. Incluem 43 pedidos fictícios, dados iguais com IDs distintos, IDs ausentes/repetidos, reimportação após reinício, preservação financeira, banco anterior e backups. O procedimento Windows foi revisado, mas não executado em Windows neste ambiente. Nenhum dado de cliente nem a planilha real integra esta branch.
