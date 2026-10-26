# Finalização da Encanto Criativo 2.0 — Windows

Esta atualização parte da correção do importador (`de2ae90`) e está na branch `correcao-limpeza-colecoes`. Não reimporta pedidos nem executa limpeza ao iniciar o sistema. A aplicação da limpeza depende da prévia e da confirmação local.

## Atualizar preservando a versão anterior

1. Pare o sistema com **Ctrl+C** e feche as páginas abertas. Não execute duas versões ao mesmo tempo.
2. Copie a pasta atual inteira para uma pasta de segurança, incluindo `data`, banco, anexos e backups. Preserve também seus atalhos e configurações locais.
3. Baixe o ZIP: https://github.com/mamoraes2108-source/Encanto-Criativo/archive/refs/heads/correcao-limpeza-colecoes.zip . Extraia em uma **pasta nova**, sem substituir a versão anterior.
4. Copie a pasta `data` inteira da instalação atual para a nova pasta. O arquivo `data\encanto.sqlite` deve existir antes de iniciar. A versão anterior deve conservar seu próprio banco. Se usa `DATA_DIR` personalizado, copie esse diretório para um novo local e ajuste a variável/atalho para a cópia; não aponte as duas versões para o mesmo banco. Arquivos `.env` não são carregados automaticamente pelo Node.
5. Com Node.js 24 instalado, execute **Atualizar-Dependencias.bat** na nova pasta. O backup, a instalação e os testes com dados fictícios são automáticos. Se ocorrer erro, interrompa e conserve a pasta anterior.

## Gerar a prévia e aplicar somente se estiver correta

6. Mantenha o sistema parado e abra **Limpar-Demonstracao.bat** na nova pasta.
7. Informe o caminho completo da sua planilha original `Vendas_Encanto.xlsx`. Ela será lida somente para obter os IDs originais, os temas e conferir os valores. Não será alterada nem importada. Nenhum pedido novo será criado.
8. A janela informa o caminho do banco selecionado e salva uma prévia JSON em `data\previas-limpeza`. Mostra os pedidos de demonstração a excluir, os movimentos financeiros vinculados e cada mudança de coleção, com o tema que será preservado. A prévia também lista os 43 IDs reais preservados. Você pode abrir o JSON no Bloco de Notas enquanto a janela aguarda. Este arquivo contém informações locais: não o publique.
9. Se a prévia estiver correta, digite exatamente **EXCLUIR SOMENTE DEMONSTRACAO E CORRIGIR COLECOES**. Pressionar Enter sem a frase cancela. A rotina cria e verifica um backup em `data\backups\antes-limpeza-*.zip` antes de qualquer exclusão ou mudança de coleção. Se o backup falhar, nada é alterado no banco.
10. Aguarde a mensagem **Concluído** e guarde o caminho do backup. Depois abra **Iniciar-Encanto.bat** e use `http://127.0.0.1:3000`. Não é preciso reimportar a planilha nem executar testes manuais.

## Regras de preservação

- O banco deve conter exatamente os 43 pedidos identificados pelos IDs originais da planilha, mais os pedidos explicitamente marcados como demonstração. IDs ausentes, duplicados, pedidos desconhecidos ou classificações conflitantes bloqueiam a operação inteira.
- Os reais devem ser importados com os IDs originais já gravados. A rotina não tenta adivinhar IDs por cliente, datas ou valores, pois existem vendas legítimas iguais. Se uma versão antiga não gravou os IDs, ela interrompe com uma mensagem, sem exigir reimportação e sem excluir dados.
- Os totais dos reais devem conferir tanto com a planilha quanto com o esperado: **43 pedidos; faturamento R$ 3.446,30; custos R$ 1.754,01; lucro bruto R$ 1.692,29**. Valores divergentes não são corrigidos automaticamente.
- Somente pedidos com `demo: true`, sem ID original e sem marca de importação são candidatos à exclusão. Os movimentos de recebimento/estorno são excluídos somente quando vinculados diretamente a esses pedidos. Todo candidato aparece na prévia.
- As coleções dos pedidos reais recebem o texto de **Tema / arte** da planilha. O campo tema do banco permanece exatamente como estava; valores, lucro, quantidades, IDs, status, recebimentos reais e demais campos também permanecem.
- Clientes, catálogo, anexos e histórico de auditoria permanecem intactos, inclusive quando compartilhados. Não há limpeza de cadastros nem remoção de arquivos nesta atualização.
- Antes de gravar, a rotina compara o banco com a prévia. Se houve alteração, ela interrompe. Exclusões e coleções são aplicadas em uma transação; erro desfaz tudo. Ao final, os 43 IDs, todos os valores e os demais registros são verificados novamente antes do commit.
- Reexecutar a rotina depois de concluída mostra que não há mais exclusões ou coleções a corrigir; não duplica pedidos.

## Relatórios e Criações favoritas

Painel, relatórios, caixa, ranking e exportação de pedidos consideram somente pedidos sem marca de demonstração. Pedidos cancelados continuam fora dos indicadores de vendas, conforme a regra já existente. A tela Pedidos mantém o filtro de demonstrações para permitir conferência antes da limpeza.

Os relatórios de coleções passam a respeitar a coleção registrada em pedidos importados. Não há rateio inventado nem reconstrução dos custos históricos. A planilha exportada preserva os IDs originais. Exportação de relatórios não substitui backup.

## Voltar atrás

Pare o sistema. A pasta anterior mantém a versão e o banco anteriores à atualização: abra o atalho dessa pasta com seu próprio `data`. Não copie um banco sobre o outro. Se houve lançamentos novos depois, preserve também a pasta atual, pois a cópia anterior não contém esses lançamentos.

Para recuperar o momento imediatamente anterior à limpeza, restaure o ZIP indicado pela rotina em **uma nova pasta** usando a função de restauração já existente. Na linha de comando da instalação, por exemplo:

```bat
node scripts\backup.js restore "C:\caminho\antes-limpeza-....zip" "C:\caminho\dados-recuperados"
```

A restauração recusa sobrescrever uma pasta existente. O arquivo contém banco e anexos; a pasta anterior preservada contém o código da versão anterior.

## Verificação técnica

29 testes técnicos e 6 testes de navegador com dados fictícios: prévia sem mutação; confirmação; backup íntegro e restauração; falha de backup; prévia desatualizada; rollback; IDs ausentes/repetidos; valores divergentes; proteção de pedidos desconhecidos; preservação dos 43 pedidos, temas e movimentos reais; coleções e ranking; totais esperados. Executados em Linux com Node.js 24 e Chromium. O BAT foi revisado, mas não executado em Windows neste ambiente.

Nenhum banco real foi acessado nesta entrega. A planilha real e dados de clientes não integram o repositório.
