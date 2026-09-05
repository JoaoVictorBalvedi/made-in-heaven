# Plan: Tocar junto com uma música

**Source PRD**: `.claude/prds/acordes-em-tempo-real.prd.md`
**Selected Milestone**: 1 — Tocar junto com uma música (arquivo local ou YouTube)
**Complexity**: Large (repositório vazio: é bootstrap de stack + o núcleo do produto)

## Summary
Trazer uma música para dentro do aplicativo — buscando pelo nome no YouTube ou
abrindo um arquivo do computador —, detectar seus acordes com timestamps rodando
um modelo local, e exibi-los numa timeline rolante sincronizada com a reprodução.
O repositório está vazio, então este marco também levanta a stack. A estratégia é
atacar primeiro a peça de maior risco — o worker de detecção — como um CLI isolado,
e só depois construir o aplicativo em volta de um contrato já comprovado.

## Forma do aplicativo

Aplicativo desktop nativo: `.app` no macOS, `.exe` no Windows. Abre pelo ícone,
roda offline, sem servidor e sem navegador. O processo Rust é dono da janela, dos
menus, do acesso a arquivos e dos subprocessos; a interface é desenhada pelo motor
de renderização que já vem no sistema operacional (WebKit no macOS, WebView2 no
Windows). Mesmo modelo do SonArcan, do VS Code e do Discord.

## Divergências deliberadas em relação ao SonArcan

O PRD escolheu "do zero, inspirado nele". Dois pontos onde vou deliberadamente
**não** copiar a prior art, com o motivo:

| Ponto | SonArcan | Aqui | Por quê |
|---|---|---|---|
| Motor de áudio | Rust com CPAL/Symphonia, time-stretch, loops sem emenda | API de áudio da webview | O escopo do PRD não tem time-stretch nem loops. A API de áudio do sistema toca stems em sincronia por construção (Marco 3) e é código nativo, não interpretado. Um motor Rust é semanas que o PRD não pede. |
| Detecção rítmica | LV-Chordia **e** Beat This! | Só LV-Chordia | Beats e BPM não estão no escopo. Beat This! arrasta `madmom`, que exige `no-build-isolation` e compilação via Cython — o maior ponto de atrito de instalação do projeto, removido por completo. |

A camada Rust fica fina de propósito — janela, diálogos, supervisão de
subprocesso, validação e cache — em vez do núcleo de domínio testável sem webview
que o SonArcan mantém. Uso pessoal, um usuário. A regra "lógica de negócio fora dos
handlers de comando" continua valendo.

Tauri + Svelte permanecem porque o objetivo declarado é poder abrir o SonArcan e
ler a solução dele quando travar — isso só funciona se as formas coincidirem.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Estrutura frontend | `sonarcan/docs/ARCHITECTURE.md` | `App.svelte` é casca de composição; componentes visuais em `src/lib/*.svelte`; contratos serializados em `src/lib/types.ts`; chamadas IPC isoladas em `src/lib/backend.ts`; cálculo puro em módulos tipados |
| Contrato do worker | `sonarcan/tools/sonarcan-chord-worker/.../worker.py:104` | Processo Python de vida curta: JSON limitado em stdout, diagnóstico em stderr, código de saída como sinal. Sem PCM cruzando o IPC |
| Forma do segmento | `worker.py:_timed` | `{label, sourceLabel, startSeconds, endSeconds, strength}` — rótulo compacto para exibição, Harte original preservado |
| Supervisão de subprocesso | `sonarcan/src-tauri/src/youtube_search.rs:22-27` | Tetos explícitos: 2 buscas simultâneas, consulta de 180 bytes, stdout de 512 KiB, stderr de 32 KiB, timeout de 12s, contador de geração para descartar resultado obsoleto |
| Busca no YouTube | `youtube_search.rs:99` | `yt-dlp "ytsearch10:consulta"` só com metadados — busca rápida, sem baixar nada |
| Importação | `sonarcan/src-tauri/src/importer.rs:630` | Entrada que não é URL vira `ytsearch1:`; download é job separado da busca |
| Erros acionáveis | `importer.rs:818-833` | Cada falha vira mensagem com o que fazer a seguir, com a saída técnica disponível à parte |
| Erros do worker | `worker.py:_analysis_warning` | Sanitizado para caracteres imprimíveis, truncado em 240 chars, prefixado pelo componente que falhou |
| Fronteira de confiança | `docs/ARCHITECTURE.md` | Rust valida forma, ordem e limites, e rejeita saída malformada ou obsoleta — **nunca altera um rótulo de acorde** |
| Testes TS | `sonarcan/src/lib/chordViews.test.ts` | `*.test.ts` colocado ao lado do módulo, rodando em Node, sobre lógica pura |
| Testes Python | `sonarcan/tools/sonarcan-chord-worker/tests/` | `tests/` dentro do pacote do worker |
| Fixação de versões | `sonarcan/tools/.../pyproject.toml` | Dependências de pesquisa fixadas em revisão git auditada, nunca seguindo `main` |

## Files to Change
Repositório vazio — tudo é CREATE.

| File | Action | Why |
|---|---|---|
| `tools/chord-worker/pyproject.toml` | CREATE | Worker Python isolado, deps fixadas, Python 3.13 |
| `tools/chord-worker/src/chord_worker/worker.py` | CREATE | CLI: caminho de áudio → JSON de acordes em stdout |
| `tools/chord-worker/src/chord_worker/labels.py` | CREATE | Harte (`C:maj7`) → compacto (`Cmaj7`); lógica pura, testável |
| `tools/chord-worker/tests/test_labels.py` | CREATE | Conversão de rótulo sem carregar modelo |
| `package.json`, `vite.config.ts`, `tsconfig.json`, `svelte.config.js` | CREATE | Frontend Svelte 5 + TS |
| `src/App.svelte` | CREATE | Casca: buscar, importar, tocar, exibir |
| `src/lib/types.ts` | CREATE | DTOs espelhando o que o Rust serializa |
| `src/lib/backend.ts` | CREATE | Único lugar que chama `invoke` |
| `src/lib/audioPlayer.ts` | CREATE | Carregar, tocar, pausar, buscar, tempo atual |
| `src/lib/chordTimeline.ts` (+ `.test.ts`) | CREATE | Puro: tempo → acorde atual, próximos, deslocamento da timeline |
| `src/lib/ChordTimeline.svelte` | CREATE | Timeline rolante |
| `src/lib/SearchResults.svelte` | CREATE | Lista de candidatos do YouTube |
| `src-tauri/src/lib.rs` | CREATE | Registro dos comandos |
| `src-tauri/src/process.rs` | CREATE | Supervisão genérica de subprocesso: tetos, timeout, cancelamento |
| `src-tauri/src/analysis.rs` | CREATE | Worker de acordes sobre `process.rs`; validação e cache |
| `src-tauri/src/youtube.rs` | CREATE | Busca e importação via `yt-dlp`, sobre `process.rs` |
| `docs/ARCHITECTURE.md` | CREATE | Registrar as divergências acima antes de esquecer o porquê |

## Tasks

### Task 1: Worker de acordes como CLI isolado
- **Action**: Criar `tools/chord-worker` com `uv`, Python 3.13, dependências
  `lv-chordia` (revisão git fixada), `torch`, `numpy`. Sem `beat-this`, sem `madmom`.
  Entrada: caminho absoluto de áudio. Saída: `{modelVersion, chords: [...], warnings: []}`
  em stdout. Device `auto` → `mps` no Apple Silicon, com fallback para `cpu`.
- **Mirror**: `worker.py:main()` — argparse, `json.dumps` em stdout, erro em stderr, `return 1`.
- **Validate**: `uv run chord-worker /caminho/musica.mp3 | jq '.chords | length'`
  devolve um número plausível, e os primeiros segmentos batem com uma música cuja
  cifra você conhece. **Nenhuma linha de UI antes disto funcionar.**

### Task 2: Rótulos de acorde como módulo puro e testado
- **Action**: Isolar a conversão Harte → compacto em `labels.py`, sem dependência
  de modelo. Preservar `sourceLabel`. `N` (sem acorde) vira `-` na exibição.
- **Mirror**: `sonarcan/tools/sonarcan-chord-worker/.../core.py`.
- **Validate**: `uv run pytest tools/chord-worker/tests/` — roda em segundos, sem torch.

### Task 3: Esqueleto Tauri + reprodução de áudio local
- **Action**: `npm create tauri-app` (Svelte + TS). Comando Rust abre o seletor de
  arquivos nativo e devolve o caminho; frontend carrega e toca. Transporte: play,
  pause, buscar, tempo decorrido.
- **Mirror**: `backend.ts` como único ponto de `invoke`; `App.svelte` só compõe.
- **Validate**: `npm run tauri dev` → escolher um MP3 → ouvir o som → a posição
  avança na tela.

### Task 4: Supervisão de subprocesso + ponte para o worker
- **Action**: `process.rs` com o padrão reutilizável: spawn, leitura limitada de
  stdout/stderr, timeout, cancelamento, contador de geração. Sobre ele,
  `analyze_track(path)`: desserializa, **valida** (finito, ordenado, dentro da
  duração, sem sobreposição) e rejeita saída malformada com erro tipado. Cache
  indexado por identidade do arquivo (hash de conteúdo), no diretório de dados
  do aplicativo — análise roda uma vez por música.
- **Mirror**: os tetos de `youtube_search.rs:22-27`; a regra de fronteira do
  `ARCHITECTURE.md` — Rust valida e rejeita, nunca reescreve um rótulo.
- **Validate**: analisar a mesma música duas vezes; a segunda volta do cache
  instantaneamente. Corromper o JSON do worker de propósito e verificar que
  aparece erro claro em vez de tela quebrada.

### Task 5: Busca e importação do YouTube
- **Action**: Reutilizar `process.rs`. Busca: `yt-dlp "ytsearch10:consulta"` só com
  metadados, devolvendo título, canal, duração e miniatura; descartar resposta de
  geração antiga enquanto o usuário digita. Importação: job separado que baixa o
  áudio do candidato escolhido para a pasta de dados do aplicativo e entrega um
  caminho local — do qual a Task 4 segue igual, sem saber a origem. Mapear as
  falhas conhecidas (`yt-dlp` desatualizado, vídeo indisponível) para mensagens
  com próximo passo.
- **Mirror**: `youtube_search.rs` para a busca, `importer.rs:630` para
  `ytsearch1:`, `importer.rs:818-833` para os erros acionáveis.
- **Validate**: buscar uma música pelo nome, ver os candidatos em menos de ~2s,
  escolher um, e chegar ao mesmo estado da Task 3 — tocando, com caminho local.
  Testar sem rede e com `yt-dlp` ausente: erro legível nos dois casos.

### Task 6: Timeline rolante sincronizada
- **Action**: `chordTimeline.ts` puro: dado `currentTime` e os segmentos, devolve
  acorde atual, próximos e deslocamento da timeline. `ChordTimeline.svelte`
  renderiza a faixa horizontal com marcador fixo, atualizando via
  `requestAnimationFrame` contra o relógio de áudio (não contra `setInterval`).
- **Mirror**: `chordViews.test.ts` — lógica temporal testada em Node, fora do DOM.
- **Validate**: `npm test` cobre bordas (antes do primeiro acorde, trechos sem
  acorde, fim da música, busca para trás). Em uso: tocar uma música conhecida e
  confirmar que o acorde na tela é o que se ouve.

### Task 7: Registrar a arquitetura
- **Action**: `docs/ARCHITECTURE.md` curto com a tabela de divergências e os
  contratos dos dois subprocessos. É o que impede o projeto de derivar para uma
  cópia do SonArcan sem querer.
- **Validate**: leitura própria.

## Validation
```bash
# Pré-requisitos ausentes na máquina — instalar antes das Tasks 3 e 5
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # cargo
brew install ffmpeg yt-dlp

# Worker isolado (Tasks 1-2)
uv run --directory tools/chord-worker chord-worker ~/Music/teste.mp3 | jq '.chords[:5]'
uv run --directory tools/chord-worker pytest

# Aplicativo (Tasks 3-6)
npm test
npm run check
npm run tauri dev

# Binário nativo
npm run tauri build
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Instalar `lv-chordia` de revisão git com torch falha ou demora muito | Alta | É a Task 1 justamente por isso. Se travar mais de uma sessão, o plano inteiro muda antes de existir código de UI |
| Checkpoints do modelo precisam ser baixados e não estão versionados | Alta | Descobrir na Task 1; ver como o SonArcan resolve em `engine.py:verify_checkpoints` |
| Inferência lenta demais em CPU se MPS não funcionar | Média | Cache por música (Task 4) transforma custo recorrente em custo único |
| `yt-dlp` quebra quando o YouTube muda | Alta ao longo do tempo | Falha isolada num subprocesso: degrada a importação, não derruba o aplicativo. Erro diz para atualizar a ferramenta |
| Precisão dos acordes decepcionar | Média | Task 1 já responde, contra música de cifra conhecida, antes de qualquer investimento em UI |
| Windows não testado até o fim | Alta | Marco assume desenvolvimento no Mac. `tauri build` no Windows é verificação separada, fora deste marco |
| Escopo do marco cresceu com o YouTube | Média | Tasks 4 e 5 compartilham `process.rs`; a segunda é reuso, não construção nova |

## Acceptance
- [ ] Todas as tasks completas
- [ ] `npm test` e `pytest` passam
- [ ] Buscar uma música pelo nome, escolher um resultado, dar play e ver os acordes correndo em sincronia com o som
- [ ] O mesmo, partindo de um arquivo local
- [ ] Segunda abertura da mesma música não reprocessa
- [ ] `npm run tauri build` produz um `.app` que abre pelo ícone
- [ ] Padrões espelhados do SonArcan, com as divergências registradas e justificadas
