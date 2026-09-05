"""Transformações puras sobre os rótulos que o LV-Chordia produz.

Deliberadamente não há aqui nenhum prior tonal, restrição de compasso, regra de
vizinhança entre acordes ou limiar por família. Este módulo só reescreve a grafia
Harte do modelo (`A:min7`) na grafia compacta de exibição (`Am7`), preservando o
rótulo original. Nenhuma decisão do modelo é reinterpretada.

Lógica espelhada de SonArcan (MIT), `sonarcan_chord_worker/core.py`.
"""

from __future__ import annotations

from dataclasses import dataclass

PITCH_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
FLAT_PITCH_NAMES = ("C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B")
FLAT_PITCH_CLASS = {"Cb": 11, "Db": 1, "Eb": 3, "Fb": 4, "Gb": 6, "Ab": 8, "Bb": 10}

QUALITY_SUFFIX = {
    "Major": "",
    "Minor": "m",
    "Diminished": "dim",
    "Augmented": "aug",
    "Sus2": "sus2",
    "Sus4": "sus4",
}

# Grafias compactas para as qualidades que o dicionário do modelo emite.
COMPACT_ALIASES = {
    "maj": "",
    "min": "m",
    "hdim7": "m7b5",
    "hdim": "m7b5",
    "min7": "m7",
    "min6": "m6",
    "min9": "m9",
    "min11": "m11",
    "min13": "m13",
    "minmaj7": "mmaj7",
}

DEGREE_SEMITONES = {
    "1": 0, "b2": 1, "2": 2, "#2": 3, "b3": 3, "3": 4,
    "4": 5, "#4": 6, "b5": 6, "5": 7, "#5": 8, "b6": 8,
    "6": 9, "#6": 10, "b7": 10, "7": 11,
}

# Ordem das qualidades na matriz de probabilidade de tríade do LV-Chordia.
TRIAD_QUALITY_ORDER = ("Major", "Minor", "Sus4", "Sus2", "Diminished", "Augmented")

NO_CHORD_LABELS = {"N", "X"}


@dataclass(frozen=True)
class FrameLabel:
    """Rótulo reduzido à tríade, usado para localizar a linha da probabilidade."""

    label: str
    family: str
    root: str | None


def pitch_class(note: str) -> int:
    """Índice cromático de uma nota, aceitando grafia com bemol."""
    if note in FLAT_PITCH_CLASS:
        return FLAT_PITCH_CLASS[note]
    try:
        return PITCH_NAMES.index(note)
    except ValueError as error:
        raise ValueError(f"tônica de acorde inválida: {note}") from error


def reduced_label(raw_label: str) -> FrameLabel:
    """Descarta extensões sem alterar a tônica nem a tríade."""
    if raw_label in NO_CHORD_LABELS:
        return FrameLabel("N", "N", None)
    root, separator, suffix = raw_label.partition(":")
    if not separator:
        raise ValueError(f"rótulo LV-Chordia inválido: {raw_label}")
    quality = suffix.split("/")[0]
    # "hdim" vem antes de "dim" e de "min": meia-diminuta tem tríade diminuta,
    # e o dicionário a soletra "hdim7" — que não casa com nenhum dos outros ramos.
    if quality.startswith(("hdim", "dim")):
        family = "Diminished"
    elif quality.startswith("min") or quality == "m":
        family = "Minor"
    elif quality.startswith("aug"):
        family = "Augmented"
    elif quality.startswith("sus2"):
        family = "Sus2"
    elif quality.startswith("sus4") or quality == "sus":
        family = "Sus4"
    else:
        family = "Major"
    return FrameLabel(f"{root}{QUALITY_SUFFIX[family]}", family, root)


def compact_label(raw_label: str) -> str:
    """Converte a grafia Harte do LV-Chordia na grafia compacta de exibição.

    `A:min7` vira `Am7`; `C:maj/3` vira `C/E`. Ausência de acorde continua `N`,
    legível por máquina — a decisão de exibi-la como `-` é da interface.
    """
    if raw_label in NO_CHORD_LABELS:
        return "N"
    root, separator, suffix = raw_label.partition(":")
    if not separator:
        raise ValueError(f"rótulo LV-Chordia inválido: {raw_label}")
    pitch_class(root)  # tônica inválida vira erro, não texto na interface
    quality, slash, bass_degree = suffix.partition("/")
    compact = COMPACT_ALIASES.get(quality, quality)
    if not slash:
        return f"{root}{compact}"
    if bass_degree not in DEGREE_SEMITONES:
        raise ValueError(f"grau de baixo não suportado: {raw_label}")
    spellings = FLAT_PITCH_NAMES if "b" in root else PITCH_NAMES
    bass = spellings[(pitch_class(root) + DEGREE_SEMITONES[bass_degree]) % 12]
    return f"{root}{compact}/{bass}"
