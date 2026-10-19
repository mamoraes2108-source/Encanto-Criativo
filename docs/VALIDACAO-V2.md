# Verificação da versão 2.0

Data: 19/10/2026. Base: `primeira-versao-gestao`, commit `77e3d3f`. Branch de desenvolvimento: `versao-2-gestao`.

- Instalação reproduzível com `npm ci`: aprovada em Node.js 24, Linux.
- `npm test`: 22 testes aprovados, nenhum ignorado ou falho.
- `npm run test:e2e`: 5 testes aprovados em Chromium, incluindo viewport móvel.
- `npm audit`: nenhuma vulnerabilidade conhecida reportada nesta execução.
- Backup nativo do banco original criado e restaurado em outra pasta, com verificação de integridade. Banco original e seus arquivos auxiliares conferidos por SHA-256 e preservados sem alteração.
- Testes de restauração recusam destino existente e backup corrompido. Backup e artes usam diretórios privados ignorados pelo Git.
- Testes de integração cobrem recebimentos parciais, excesso de saldo, revisão financeira com confirmação, histórico anterior e novo, conflito entre revisões, cancelamento, devolução, duplicidade de clientes, anexos falsificados, acesso privado, aprovações e importação fictícia de materiais.
- Testes de domínio verificam fechamento em centavos do rateio, custos históricos, coleções, desconto, despesas comuns e a diferença entre margem e markup.
- Navegador verifica cadastro e edição de pedido, preservação do custo apesar de reajuste, sinal, arte aprovada, cancelamento e estorno, backup/restauração pela tela, simulação por margem e calendário local próximo à meia-noite em São Paulo.
- O README original, a primeira versão e as sete capturas anteriores foram preservados.

Não foram importados dados reais, aplicadas migrações ao banco original, enviados dados ao GitHub, feitos merges ou publicada a aplicação. A planilha real `Vendas_Encanto.xlsx` não está disponível; seu mapeamento específico continua dependente de conferência privada do arquivo ou de uma amostra anonimizada.

Os scripts BAT estão preparados para Windows, mas a execução nativa em Windows ainda não foi testada. Esta versão permanece um protótipo local, sem autenticação por usuário, criptografia em repouso ou proteção para publicação pública. Veja as regras financeiras, o procedimento de atualização e as limitações em [VERSAO-2-WINDOWS.md](VERSAO-2-WINDOWS.md).
