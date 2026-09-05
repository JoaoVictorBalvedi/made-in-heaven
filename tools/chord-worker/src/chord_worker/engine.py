"""Inferência LV-Chordia fixada, usada pelo worker.

O modelo é a única autoridade sobre qual acorde soa em cada trecho. Este módulo
carrega o ensemble, roda a inferência e decodifica a sequência — sem corrigir,
suavizar ou reinterpretar nenhuma saída.
"""

from __future__ import annotations

import hashlib
import importlib.resources
from pathlib import Path

import numpy as np

from .labels import TRIAD_QUALITY_ORDER, pitch_class, reduced_label

SOURCE_REVISION = "9d7de7bbf45efa6731ec8dc62d35280f141c0702"

# O LV-Chordia publica três dicionários de decodificação. O `submission` é o
# padrão recomendado pelos autores; o `full` é declarado não testado por eles.
# O MVP expõe apenas um — escolher dicionário não é uma decisão do usuário aqui.
DICTIONARY = "submission"

FACTOR_COUNT = 6  # triad, bass, seventh, ninth, eleventh, thirteenth

# SHA-256 dos checkpoints que esta revisão baixa. Divergência não impede a
# análise: vira aviso, porque um checkpoint novo publicado a montante é bem mais
# provável que corrupção, e travar o worker por isso não ajuda em nada.
CHECKPOINT_SHA256 = {
    "s0": "921b42d5d1cf9ce1c0c0e45a74d409b8066e0acec46058ef74e24ee0fb540761",
    "s1": "bcb75859e0efa256696cf5da396b320093317b9b1d9560c304f46c25fe1f8b17",
    "s2": "acddf85c3fff29954c4877021177d72e2cba9f729ce80c1010f054c477bf3f61",
    "s3": "65d81a3ab73435aaaade586981b4cabdf57b8953d76052703e6968c32ef8421c",
    "s4": "5ff6b0ec85640e17a09a9b3de68c93fdd45adc24488e8fa9be5715c28d561122",
}

MAX_BOUNDARY_ROUNDING_OVERLAP_SECONDS = 0.001


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def check_checkpoints() -> list[str]:
    """Confere os checkpoints baixados. Devolve avisos em vez de levantar erro."""
    from lv_chordia.config import model_names
    from lv_chordia.mir.common import CACHE_DATA_PATH

    warnings: list[str] = []
    for index, model_name in enumerate(model_names()):
        checkpoint = Path(CACHE_DATA_PATH) / f"{model_name}.sdict"
        if not checkpoint.is_file():
            warnings.append(f"checkpoint s{index} ausente em {checkpoint}")
            continue
        if _file_sha256(checkpoint) != CHECKPOINT_SHA256[f"s{index}"]:
            warnings.append(f"checkpoint s{index} não confere com o SHA-256 esperado")
    return warnings


def resolve_device(requested: str) -> object:
    """Resolve o dispositivo de inferência, preferindo o acelerador da Apple."""
    import torch
    from lv_chordia.device_utils import resolve_device as lv_resolve_device

    if requested == "auto":
        requested = "mps" if torch.backends.mps.is_available() else "cpu"
    return lv_resolve_device(requested)


def infer(audio_path: Path, device) -> tuple[list[dict], float]:
    """Roda o ensemble e devolve os segmentos decodificados e a duração analisada."""
    from lv_chordia.chord_recognition import load_ensemble
    from lv_chordia.extractors.cqt import CQTV2
    from lv_chordia.mir import DataEntry, io
    from lv_chordia.settings import DEFAULT_HOP_LENGTH, DEFAULT_SR

    ensemble = load_ensemble(False, device=device)
    entry = DataEntry()
    entry.prop.set("sr", DEFAULT_SR)
    entry.prop.set("hop_length", DEFAULT_HOP_LENGTH)
    entry.append_file(str(audio_path), io.MusicIO, "music")
    entry.append_extractor(CQTV2, "cqt")

    members = [network.inference(entry.cqt) for network in ensemble]
    probabilities = [
        np.mean([member[index] for member in members], axis=0)
        for index in range(FACTOR_COUNT)
    ]
    frame_seconds = DEFAULT_HOP_LENGTH / DEFAULT_SR
    duration = float(probabilities[0].shape[0] * frame_seconds)
    return _decode(entry, probabilities), duration


def _decode(entry, probabilities) -> list[dict]:
    from lv_chordia.extractors.xhmm_ismir import XHMMDecoder

    template = importlib.resources.files("lv_chordia.data").joinpath(
        f"{DICTIONARY}_chord_list.txt"
    )
    with importlib.resources.as_file(template) as template_path:
        decoder = XHMMDecoder(template_file=str(template_path))
    decoded = decoder.decode_to_chordlab(entry, probabilities, False, use_beats=False)

    frame_seconds = entry.prop.hop_length / entry.prop.sr
    triad = probabilities[0]
    segments = []
    for start, end, raw_label in decoded:
        segments.append(
            {
                "rawLabel": str(raw_label),
                "startSeconds": round(float(start), 6),
                "endSeconds": round(float(end), 6),
                "strength": _segment_strength(triad, frame_seconds, start, end, str(raw_label)),
            }
        )
    return _normalize_boundaries(segments)


def _segment_strength(triad, frame_seconds: float, start: float, end: float, raw_label: str) -> float:
    """Confiança média do modelo na tríade, ao longo dos quadros do segmento."""
    first = max(0, int(round(start / frame_seconds)))
    last = min(triad.shape[0], max(first + 1, int(round(end / frame_seconds))))
    reduced = reduced_label(raw_label)
    if reduced.family == "N":
        return float(np.mean(triad[first:last, 0]))
    quality = TRIAD_QUALITY_ORDER.index(reduced.family)
    column = 1 + quality * 12 + pitch_class(reduced.root)
    return float(np.mean(triad[first:last, column]))


def _normalize_boundaries(segments: list[dict]) -> list[dict]:
    """Apara sobreposições de arredondamento para a fronteira ficar ordenada."""
    for previous, current in zip(segments, segments[1:]):
        overlap = previous["endSeconds"] - current["startSeconds"]
        if 0 < overlap <= MAX_BOUNDARY_ROUNDING_OVERLAP_SECONDS + 1e-9:
            previous["endSeconds"] = current["startSeconds"]
    return segments
