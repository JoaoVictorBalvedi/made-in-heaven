"""CLI de detecção de acordes: JSON limitado em stdout, diagnóstico em stderr.

Processo de vida curta, invocado com o caminho absoluto de um áudio. O contrato
com quem chama é o código de saída mais um único objeto JSON em stdout. Nenhum
dado de áudio atravessa essa fronteira — só a sequência de acordes com tempos.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .engine import DICTIONARY, SOURCE_REVISION, check_checkpoints, infer, resolve_device
from .labels import compact_label


def analyze(audio_path: Path, requested_device: str = "auto") -> dict:
    audio_path = audio_path.resolve(strict=True)
    if not audio_path.is_file():
        raise ValueError("o caminho de áudio precisa ser um arquivo comum")

    warnings = check_checkpoints()
    device = resolve_device(requested_device)
    segments, duration = infer(audio_path, device)

    return {
        "modelVersion": f"lv-chordia@{SOURCE_REVISION}",
        "dictionary": DICTIONARY,
        "durationSeconds": round(duration, 6),
        "chords": [_timed(segment) for segment in segments],
        "warnings": warnings,
    }


def _timed(segment: dict) -> dict:
    """Rótulo compacto para exibição; grafia original preservada ao lado dele."""
    return {
        "label": compact_label(segment["rawLabel"]),
        "sourceLabel": segment["rawLabel"],
        "startSeconds": segment["startSeconds"],
        "endSeconds": segment["endSeconds"],
        "strength": segment["strength"],
    }


def _diagnostic(error: Exception) -> str:
    """Mensagem de uma linha, sem caractere de controle, com tamanho limitado."""
    printable = "".join(character if character.isprintable() else " " for character in str(error))
    return (" ".join(printable.split()) or error.__class__.__name__)[:240]


def main() -> int:
    parser = argparse.ArgumentParser(description="Detecção de acordes com timestamps")
    parser.add_argument("audio", nargs="?", type=Path, help="caminho do arquivo de áudio")
    parser.add_argument("--device", choices=("auto", "cpu", "mps"), default="auto")
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="verifica os checkpoints e sai, sem analisar áudio",
    )
    args = parser.parse_args()

    try:
        if args.self_test:
            warnings = check_checkpoints()
            print(json.dumps({
                "ok": not warnings,
                "modelVersion": f"lv-chordia@{SOURCE_REVISION}",
                "dictionary": DICTIONARY,
                "warnings": warnings,
            }))
            return 0
        if args.audio is None:
            parser.error("o caminho do áudio é obrigatório, exceto com --self-test")
        print(json.dumps(analyze(args.audio, args.device), separators=(",", ":")))
        return 0
    except Exception as error:
        print(f"Análise de acordes falhou: {_diagnostic(error)}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
