# Encanto Criativo 2.0 — guia para Windows

Esta versão amplia a primeira; não substitui a identidade visual nem altera o README original. A referência da primeira versão continua na branch `primeira-versao-gestao`, commit `77e3d3f`. O desenvolvimento da segunda versão está na branch `versao-2-gestao`, sem merge ou publicação.

## Para começar, sem conhecimentos de programação

1. Instale o **Node.js 24** pelo site oficial `https://nodejs.org`. Mantenha as opções padrão do instalador.
2. Guarde o projeto em uma pasta privada do seu Windows. Não coloque o banco ou as artes em repositório público ou pasta compartilhada.
3. Na pasta do projeto, dê dois cliques em **Atualizar-Dependencias.bat** para instalar os componentes. Se já existe banco local, o programa tenta fazer um backup antes; qualquer falha interrompe a atualização. Se uma instalação anterior estiver incompleta e impedir o backup, não apague nada: peça ajuda para instalar as dependências e fazer a cópia antes de continuar.
4. Dê dois cliques em **Iniciar-Encanto.bat**. Mantenha a janela aberta.
5. Abra Edge, Chrome ou Firefox e digite `http://127.0.0.1:3000` na barra de endereços. Esse endereço funciona somente no computador em que você iniciou o sistema.
6. Para encerrar, volte à janela do sistema e pressione **Ctrl+C**. Os dados permanecem salvos.

Na primeira inicialização de um banco novo, são criados exemplos fictícios. Um banco existente não é apagado, reinicializado nem convertido automaticamente. Não há prévia privada disponível pela interface deste ambiente Codex; o roteiro acima é para o seu computador.

Os arquivos BAT foram preparados para Windows, mas não foram executados em Windows nesta entrega. O servidor e os fluxos foram testados em Linux com Node.js 24 e Chromium. Se houver uma mensagem de erro, mantenha a janela aberta e informe o texto, sem compartilhar informações pessoais ou credenciais.

## Atualizar uma instalação que já tem dados

**Nunca extraia uma nova versão sobre a única cópia dos seus dados.**

1. Encerre o sistema antigo. Mantenha sua pasta original intacta.
2. Faça uma cópia privada da pasta `data` inteira, incluindo quaisquer arquivos auxiliares do SQLite e as artes. Se sua versão tiver o menu **Backup e restauração**, crie e baixe também o ZIP verificado.
3. Baixe a versão nova em **outra pasta**, sem apagar a antiga.
4. Copie a pasta `data` antiga inteira para a pasta nova. Não mescle dois bancos diferentes.
5. Abra **Atualizar-Dependencias.bat** e depois **Iniciar-Encanto.bat** na pasta nova. Confira pedidos, histórico e totais. Não execute as duas versões simultaneamente sobre o mesmo banco.
6. Guarde a instalação antiga e o backup até terminar a conferência. Não volte a usar a versão 1 para editar um banco que já recebeu operações da versão 2: a versão antiga não conhece o novo histórico financeiro.

A versão 2 lê registros da primeira sem reescrever o banco ao iniciar. Só operações que você confirmar gravam novos dados ou revisões. Uma futura migração estrutural deverá usar backup e restauração testados antes de converter qualquer dado.

## Pedidos e revisão financeira

- Em **Novo pedido**, escolha cliente, datas, personalização, modelos, embalagens e até oito tipos de complemento. A entrega pode ficar sem data.
- Informe Peças ou Kits; a soma das quantidades dos modelos precisa ser igual ao total de peças.
- Para cada modelo, informe a coleção e a **venda atribuída à linha inteira**, antes do desconto geral. Pode repetir o mesmo modelo em coleções distintas.
- Separe impressão, taxas, frete e outras despesas. Cada outra despesa precisa de descrição e valor.
- Clique em **Conferir custos e rateio**. Leia o detalhamento e confirme antes de salvar.
- Para editar, abra **Ver → Editar pedido**. Inicialmente, apenas campos cadastrais e produção estão habilitados. Informe um motivo.
- Para modificar valores, quantidades, itens, kits ou coleções, marque **Revisar composição, valores ou coleções**. Confira o resultado e confirme a revisão financeira. O servidor exige essa confirmação.
- Itens já registrados partem de seus custos unitários históricos, mesmo que a data ou os preços do catálogo mudem. Quantidades alteradas usam esses custos originais. Um item novo usa a vigência na data escolhida, não o preço de hoje.
- Para trocar um custo conhecido, marque **Revisar explicitamente custo unitário**, preencha o valor correto e marque a autorização dos custos revisados. Um custo desconhecido exige revisão explícita; não o preenchemos com o catálogo atual.
- Pedidos antigos importados com custo total, mas sem composição unitária, podem ter dados cadastrais corrigidos sem alterar seu custo. Para reconstruir a composição financeira, forneça os valores conhecidos e confirme expressamente; não há reconstrução automática.
- Em **Histórico de alterações**, abra cada registro para ver data/hora, motivo, fotografia anterior e nova. Duas janelas não podem sobrescrever revisões do mesmo pedido silenciosamente: reabra o pedido se houver aviso de conflito.

## Dinheiro recebido e cancelamentos

**Faturamento** é a soma das vendas não canceladas pela data do pedido. **Lucro bruto** é faturamento menos custos registrados. **Recebimentos** são entradas efetivamente lançadas, pela data do pagamento. Não são a mesma coisa.

1. Em **Ver → Recebimentos / estornos**, informe sinal ou complemento, valor, data efetiva, forma e identificação. Confirme o movimento.
2. O pagamento muda automaticamente para Pendente, Parcial ou Pago. Não existe edição manual desse status.
3. Valores negativos, zero ou acima do saldo são bloqueados. Se o valor da venda estava errado, revise o pedido primeiro. Não existe crédito excedente nesta versão.
4. Para corrigir um recebimento, registre um estorno ligado ao original e, se necessário, um novo recebimento correto. Não apagamos o lançamento antigo. Estornos podem ser parciais, mas não podem ultrapassar o que resta do recebimento original.
5. Ao cancelar, informe o motivo e confirme. O pedido e seus registros são preservados. A venda e os custos deixam de compor os indicadores comerciais, mas o dinheiro recebido continua no caixa e fica **a devolver**.
6. Só registre o estorno quando devolver o dinheiro de fato. A data do estorno não pode ser anterior ao recebimento. Depois do estorno integral, a devolução pendente fica zerada. Um pedido cancelado não é reaberto nem recebe novas entradas; registre novo pedido se necessário.
7. Para reduzir uma venda abaixo do dinheiro já recebido, estorne a diferença antes. Não ajustamos recebimentos silenciosamente.

Pedidos da primeira versão marcados Pago ou Parcial **não comprovam valor, data ou forma**. Aparecem como **A conferir** até você registrar os comprovantes conhecidos. São excluídos da soma de saldo conhecido, e não viram entradas fictícias. Uma correção cadastral não apaga essa pendência de conferência.

Os filtros de período usam data do pedido para vendas e data do movimento para caixa. Recebimentos e estornos de pedidos cancelados continuam no relatório financeiro. Valores a devolver consideram o saldo atual, não um balanço retroativo.

## Coleções e rateio: regra desta versão

Cada modelo tem sua coleção, sua quantidade, seu custo próprio e seu valor de venda atribuído. O total das vendas atribuídas menos o desconto geral precisa ser igual ao total do pedido.

O faturamento líquido e os custos comuns — embalagens, complementos, impressão, taxas, frete e despesas identificadas — são distribuídos **proporcionalmente à venda atribuída antes do desconto**. Se todas as vendas forem zero, os custos comuns são distribuídos pelo número de peças. Os custos próprios dos modelos permanecem em suas linhas. Um kit com várias coleções segue a mesma regra por item.

O rateio é calculado em centavos; diferenças de arredondamento usam os maiores restos, com desempate pela ordem dos itens. Assim, os totais por coleção fecham com os totais dos pedidos, sem dupla contagem. Margem e participação são percentuais arredondados para exibição e podem não somar visualmente 100,00%.

No **Painel** e em **Relatórios**, **Desempenho das coleções** mostra faturamento, lucro, margem, peças, participação e evolução mensal. O seletor alterna faturamento, lucro e peças nos gráficos. Pedidos cancelados ficam fora. Prejuízo é mostrado com sinal negativo e barra rosada proporcional à sua magnitude.

Pedidos antigos com uma coleção mantêm o enquadramento histórico integral. Pedidos importados sem distribuição suficiente aparecem em **Não classificado / conferir**, ainda que a planilha tenha um rótulo de coleção. Não inventamos a distribuição dos valores.

## Simular preços

O simulador original continua disponível. A nova área **Preço por margem desejada** usa custo unitário dos materiais, quantidade, custos adicionais e margem desejada.

Fórmula: **preço = custo ÷ (1 − margem/100)**. Por exemplo, custo de R$ 60 com margem de 40% resulta em preço de R$ 100, não R$ 84. O preço sugerido arredonda para cima ao centavo. Margens de 100% ou mais, negativas ou inválidas são rejeitadas. Custo zero resulta em preço zero e margem percentual indefinida. Simulações não criam pedidos.

## Artes privadas e entregas

Nos detalhes do pedido, anexe PNG, JPG ou WebP de até 8 MB e 16 milhões de pixels, sem animação. O conteúdo é decodificado e regravado, e a extensão precisa corresponder ao formato. SVG, executáveis e arquivos disfarçados não são aceitos.

Cada upload é preservado como arquivo próprio, fora da pasta pública. Para uma nova versão, anexe o novo arquivo e marque a anterior como **Substituída**. Você pode marcar Em elaboração, Enviada, Aprovada (com data explícita), Substituída ou Removida (com motivo e confirmação). Remoção é lógica: o arquivo e o histórico permanecem para conferência e backup.

Miniaturas e downloads exigem sessão local do navegador e vínculo com o pedido correto. O nome de armazenamento é gerado pelo sistema, e caminhos arbitrários não são aceitos. Essa sessão não é um login e não protege contra outra pessoa ou processo com acesso ao seu computador. A preparação para armazenamento em nuvem é a separação entre os arquivos privados e seus metadados por ID; autenticação e um adaptador de nuvem ainda precisarão ser implementados antes de uso remoto.

Em **Pedidos**, use **Alertas de entrega**: até três dias é Entrega próxima; datas anteriores a hoje são Atrasado; ausência de data é Sem data; Entregue é Concluído. Cancelados não são atrasados. Hoje usa o calendário local do navegador do usuário. Não são enviadas notificações externas.

## Clientes e planilha real

O cadastro verifica e-mail sem distinção entre maiúsculas/minúsculas e telefone pelos dígitos. Havendo coincidência, avisa e exige confirmação para criar outro cadastro separado; não apaga nem mescla clientes. A lista mostra compras, total, recorrência, saldo conhecido e última compra. O histórico inclui também pedidos cancelados, sem somá-los ao total comprado.

**`Vendas_Encanto.xlsx` não foi fornecida nem importada.** Para preparar o mapeamento real, será necessário fornecer a planilha por canal privado ou uma cópia anonimizada, mantendo cabeçalhos, tipos de células e fórmulas representativas. Nunca coloque a planilha com dados pessoais no GitHub.

O importador permite selecionar aba e linha de cabeçalho e relacionar colunas. Datas textuais devem estar em AAAA-MM-DD; datas realmente armazenadas como datas no Excel são reconhecidas. Campos obrigatórios ausentes impedem a importação. A conferência mostra todas as linhas convertidas, possíveis duplicidades e, quando você associar a coluna de lucro, a diferença entre o lucro informado e venda menos custo.

Fórmulas não são executadas: usamos apenas seus resultados armazenados quando existem, sinalizando a necessidade de conferência no Excel. Um resultado pode estar desatualizado. Antes de confirmar, você declara que conferiu fórmulas e divergências. Sem resultado armazenado, um campo obrigatório continua inválido.

A seção de materiais permite importar nome, categoria explícita, custo e vigência. Não substitui uma vigência existente. Resumo é somente para conferência, e o formato real será validado quando você fornecer a planilha privadamente. Importações exigem confirmação expressa; nenhuma importação real foi realizada nesta etapa. Faça backup antes de qualquer importação definitiva.

## Backup e restauração verificada

No menu **Backup e restauração**:

1. Clique em **Criar e baixar backup**. Aguarde a confirmação e clique no link de download.
2. Guarde o ZIP em um local privado, preferencialmente também em outro dispositivo. O arquivo contém dados pessoais e artes, sem criptografia.
3. Para testar, escolha esse ZIP em **Testar restauração** e clique em **Conferir backup**. O sistema verifica manifesto, tamanhos e SHA-256.
4. Confirme **Restaurar cópia em pasta nova**. O sistema verifica também a integridade SQLite e os registros JSON. O banco ativo não é substituído.
5. Para usar a cópia restaurada, encerre o servidor e escolha explicitamente a nova pasta de dados. Peça ajuda nesse passo; não renomeie nem misture arquivos enquanto o sistema estiver em execução.

O backup usa a API nativa SQLite para incluir transações confirmadas, mesmo em modo WAL, e inclui todas as artes, inclusive versões removidas logicamente. Arquivos de backups anteriores não são incluídos novamente. A restauração recusa qualquer pasta de destino que já exista. Limites desta versão: arquivo ZIP de até 100 MB, conteúdo total de até 250 MB e até 5.000 arquivos. A integridade detecta corrupção, mas não prova autenticidade contra alguém que possa alterar o ZIP e seu manifesto. O backup não inclui o código da aplicação, que deve ser preservado separadamente.

## Comandos para suporte técnico

```sh
npm ci
npm start
npm test
npm run test:e2e
npm run backup
node scripts/backup.js create data caminho-privado/backup.zip
node scripts/backup.js restore caminho-privado/backup.zip pasta-NOVA
```

Para iniciar usando uma cópia restaurada no Windows, com o sistema parado, em um terminal na pasta do projeto:

```bat
set "DATA_DIR=C:\caminho\pasta-NOVA"
npm start
```

`DATA_DIR` é uma configuração do processo, não uma alteração no banco. O endereço padrão permanece local; configurar HOST externo é rejeitado. Node.js 24 é obrigatório. Os testes usam bancos separados; não use o banco real para testes automatizados. Para os testes de interface, instale Chromium e configure `CHROMIUM_PATH`, conforme o guia técnico anterior.

## Limitações de segurança e expansão

Uso exclusivamente local. Não há contas de usuário, controle de permissões por pessoa, criptografia em repouso, HTTPS, trilha de auditoria resistente à adulteração ou recuperação automática após perda do computador. Quem acessa o disco pode ler ou alterar SQLite, artes e backups. Os checksums detectam corrupção acidental, não substituem assinatura digital ou criptografia. Não exponha o protótipo na rede ou na internet.

Antes de publicar, serão necessárias autenticação, autorização para cada recurso, armazenamento privado de objetos, banco gerenciado com migrações, política de retenção de dados, backups externos criptografados e testes de recuperação. Nenhuma integração externa foi adicionada. A publicação, importação real e merge na `main` dependem de autorização específica.
