# Arquitetura

## O que este aplicativo é

Aplicativo desktop nativo — `.app` no macOS, `.exe` no Windows. Abre pelo ícone,
roda offline, sem servidor e sem navegador. O processo Rust é dono da janela,
dos diálogos do sistema e dos subprocessos; a interface é desenhada pelo motor
de renderização que já vem no sistema operacional.

```text
Svelte 5 + TypeScript
   │ comandos tipados
fronteira Tauri (Rust)
   ├── diálogos nativos
   ├── supervisão de subprocesso  (process.rs)
   ├── análise de acordes         (analysis.rs)
   └── cache em disco
        │ JSON limitado, uma invocação por música
   worker Python (LV-Chordia + torch)
```

## Origem e divergências deliberadas

Este projeto foi escrito do zero tendo o [SonArcan](https://github.com/) (MIT)
como referência de arquitetura. Onde divergimos, foi de propósito:

| Ponto | SonArcan | Aqui | Por quê |
|---|---|---|---|
| Motor de áudio | Rust com CPAL/Symphonia, time-stretch, loops sem emenda | API de áudio da webview | Não há time-stretch nem loops no escopo. Um motor Rust é semanas que o produto não pede. |
| Detecção rítmica | LV-Chordia **e** Beat This! | Só LV-Chordia | Beats e BPM não estão no escopo. Beat This! arrasta `madmom`, que exige compilação via Cython com `no-build-isolation` — o maior atrito de instalação do projeto, removido por completo. |
| Dicionários | Três, escolhíveis pelo usuário | Um (`submission`) | Escolher dicionário de decodificação não é uma decisão que o usuário deste aplicativo precise tomar. |
| Camada Rust | Núcleo de domínio testável sem webview | Fina: janela, diálogo, subprocesso, validação, cache | Uso pessoal, um usuário. A regra "lógica de negócio fora dos handlers" continua valendo. |
| Checkpoints | Divergência de SHA-256 é erro fatal | Divergência vira aviso | Checkpoint novo publicado a montante é mais provável que corrupção, e travar a análise por isso não ajuda ninguém. |

Duas correções foram feitas sobre a lógica espelhada, ambas apanhadas por teste:
`hdim7` era classificado como tríade maior (a família era decidida por um
conjunto literal que não continha essa grafia), e a tônica não era validada
quando o acorde não tinha baixo invertido.

## Fronteiras

### Interface ↔ Rust

Componentes Svelte nunca chamam `invoke` diretamente: tudo passa por
`src/lib/backend.ts`. Contratos serializados vivem em `src/lib/types.ts` e
espelham exatamente o que o Rust envia. `App.svelte` é casca de composição.

Cálculo puro — qual acorde soa agora, onde a faixa deve estar, como formatar o
tempo — mora em módulos tipados com teste ao lado, fora do DOM. É o que permite
testar a sincronia sem abrir uma janela.

### Rust ↔ worker

O worker é um processo de vida curta. O contrato é o código de saída mais um
único objeto JSON em stdout; diagnóstico vai para stderr. Áudio nunca atravessa
essa fronteira.

**O modelo é a única autoridade sobre qual acorde soa.** O Rust confere se a
saída é bem formada — tempos finitos e ordenados, intervalos não vazios, sem
sobreposição além do arredondamento, nada além do fim da música, confiança entre
0 e 1, rótulo não vazio — e **rejeita** o que não for. Nunca reescreve, suaviza
ou corrige um rótulo.

Todo subprocesso passa por `process.rs`, que impõe teto de tempo e de bytes de
fora. Dois cuidados que não são opcionais:

- Os canos são drenados em threads separadas. Um cano cheio bloqueia o processo
  filho, e ele nunca terminaria sozinho.
- Estouro de teto é erro, não truncamento. JSON cortado pela metade que ainda
  desserializa é pior do que falha.

## Cache

Análise é cara na primeira vez (~30 s de carga de modelo, depois ~30× tempo
real) e determinística. O resultado é guardado em
`<dados do app>/analysis/chords/<sha256 do áudio>.json`.

A identidade é o **conteúdo** do arquivo, não o caminho: renomear ou mover uma
música não força reprocessar. Cache ilegível ou de versão antiga é ignorado em
silêncio — reanalisar é sempre seguro, então falha de cache degrada para
lentidão, nunca para erro na tela.

`CACHE_VERSION`, em `analysis.rs`, precisa ser incrementado à mão sempre que o
worker mudar de modelo, de dicionário ou de formato de saída. Sem isso, análises
antigas continuariam válidas depois de uma troca de modelo.

## Onde o worker é encontrado

Em desenvolvimento, pelo caminho relativo ao crate:
`tools/chord-worker/.venv/bin/chord-worker`. O ambiente virtual gera um
executável próprio, então o aplicativo não precisa de `uv` em tempo de execução
— só na hora de montar o ambiente. `MUSICA_CHORD_WORKER` sobrescreve o caminho.
Empacotado, o worker é procurado ao lado do executável.

## Dependências fixadas

O `lv-chordia` é fixado numa revisão git auditada, nunca seguindo `main`: é um
projeto de pesquisa, e uma mudança silenciosa a montante alteraria os acordes
que o aplicativo mostra sem nenhum aviso.
