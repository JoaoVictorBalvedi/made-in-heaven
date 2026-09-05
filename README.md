# Musica

Aplicativo desktop para estudar música na guitarra. Roda no macOS e no Windows,
sem servidor e sem navegador: toda a análise acontece na própria máquina.

## O que faz

**Tocar junto** — busque uma música pelo nome no YouTube ou abra um arquivo do
computador. Os acordes são detectados localmente e correm numa timeline
sincronizada com o som, com o desenho de cada um no braço da guitarra. O que
entra fica guardado no repertório e reabre sem reimportar.

**Escalas** — as escalas principais em qualquer tônica, no braço inteiro. Dá
para escolher a escala diretamente ou escolher um tom e ver tudo que serve
sobre ele: os sete modos, as pentatônicas e o blues.

**Progressões** — monte sequências de acordes ouvindo cada um entrar. O
aplicativo deduz a tonalidade do que você montou e sugere o que costuma vir
depois, com o motivo. Doze padrões conhecidos podem ser carregados em qualquer
tom, e progressões podem ser salvas e recarregadas.

## Rodar

```bash
# uma vez
brew install ffmpeg yt-dlp
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
npm install
uv sync --directory tools/chord-worker

# desenvolvimento
npm run tauri dev

# gerar o aplicativo
npm run tauri build
cp -R src-tauri/target/release/bundle/macos/Musica.app /Applications/
xattr -dr com.apple.quarantine /Applications/Musica.app
```

> O aplicativo instalado depende deste repositório continuar onde está: o
> pacote traz apenas o lançador do worker de acordes, que aponta para o
> ambiente Python em `tools/chord-worker/.venv`. O motivo está em
> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Verificar

```bash
npm test          # lógica pura do frontend
npm run check     # tipos
cargo test --manifest-path src-tauri/Cargo.toml
uv run --directory tools/chord-worker pytest
```

## Construído sobre

Detecção de acordes por [LV-Chordia](https://github.com/openmirlab/lv-chordia),
formas de acorde do [chords-db](https://github.com/tombatossals/chords-db),
importação por [yt-dlp](https://github.com/yt-dlp/yt-dlp), casca desktop em
[Tauri](https://tauri.app/) com [Svelte](https://svelte.dev/).

Arquitetura inspirada no [SonArcan](https://github.com/), com as divergências
deliberadas registradas em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
