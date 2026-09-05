# Plan: Ter um repertório que persiste

**Source PRD**: `.claude/prds/acordes-em-tempo-real.prd.md`
**Selected Milestone**: 3 — Ter um repertório que persiste
**Complexity**: Medium

## Summary
Tudo que entra no aplicativo — arquivo aberto do disco ou vídeo baixado do
YouTube — passa a ser copiado para a pasta de dados e registrado num índice.
Uma tela lista o repertório, permite buscar dentro dele e reabrir qualquer
música sem reimportar nem rebaixar.

## A decisão que organiza o resto

A análise já é indexada pelo **SHA-256 do conteúdo do áudio**. A biblioteca usa
a mesma identidade. Com isso, tudo sobre uma música — o arquivo, a análise, a
entrada no índice — vive sob a mesma chave, e três coisas saem de graça:

- Importar duas vezes o mesmo arquivo não duplica nada.
- Uma música que volta para a biblioteca **já chega analisada**, porque o cache
  de acordes está indexado pela mesma chave.
- Apagar uma música é apagar tudo que leva aquela chave.

Para o YouTube há uma segunda chave, o identificador do vídeo, conferida
**antes** de baixar: rebaixar o mesmo vídeo é instantâneo em vez de custar
minutos. As duas chaves servem a momentos diferentes e ambas são necessárias.

## Layout em disco

```text
<dados do app>/
  library/
    index.json            entradas, escrita atômica
    audio/<sha256>.<ext>  o arquivo
  analysis/chords/<sha256>.json
```

## Files to Change
| File | Action | Why |
|---|---|---|
| `src-tauri/src/library.rs` | CREATE | Índice, cópia para a pasta de dados, remoção |
| `src-tauri/src/youtube.rs` | UPDATE | Consultar o índice por vídeo antes de baixar; capturar o título |
| `src-tauri/src/lib.rs` | UPDATE | Comandos de listar, adicionar e remover |
| `src/lib/Library.svelte` | CREATE | Lista do repertório com busca local |
| `src/lib/types.ts`, `backend.ts`, `App.svelte` | UPDATE | Contrato e composição |

## Tasks

### Task 1: Índice da biblioteca
- **Action**: `library.rs` com `list`, `add_file`, `adopt`, `remove`. Escrita do
  índice por arquivo temporário e renomeação, para uma interrupção no meio não
  deixar índice truncado. Índice ilegível não é erro fatal: vira biblioteca
  vazia, e a música pode ser reimportada.
- **Validate**: testes de serialização, deduplicação por hash e remoção.

### Task 2: YouTube consulta o índice antes de baixar
- **Action**: `import` recebe o índice; se o `videoId` já estiver lá, devolve a
  entrada existente sem tocar na rede. Captura o título do vídeo junto do
  caminho, para o repertório não mostrar identificadores crus.
- **Validate**: baixar o mesmo vídeo duas vezes; a segunda é instantânea.

### Task 3: Adotar o que já foi baixado
- **Action**: migração única — o que estiver em `imports/` entra na biblioteca
  em vez de ser abandonado.
- **Validate**: o vídeo já baixado aparece no repertório na primeira abertura.

### Task 4: Tela do repertório
- **Action**: `Library.svelte` — lista com título, origem e duração, busca por
  texto sobre o que está guardado, e remoção. Abrir uma entrada carrega e toca.
- **Validate**: `npm test` cobre o filtro de busca; em uso, fechar e reabrir o
  aplicativo mantém o repertório.

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Cópia duplica disco para quem já tem uma biblioteca grande em MP3 | Média | É o que o usuário pediu explicitamente; remoção pela própria tela |
| Índice corrompido por escrita interrompida | Baixa | Escrita atômica por rename |
| Título do YouTube com quebra de linha atrapalhando a leitura da saída | Baixa | O caminho é a última linha; o que vem antes é o título |

## Acceptance
- [ ] Arquivo aberto do disco é copiado e aparece no repertório
- [ ] Vídeo baixado aparece no repertório com o título, não com o identificador
- [ ] Rebaixar o mesmo vídeo não acessa a rede
- [ ] Música que volta do repertório já vem analisada
- [ ] Fechar e reabrir o aplicativo mantém tudo
- [ ] O que já estava em `imports/` não se perde
