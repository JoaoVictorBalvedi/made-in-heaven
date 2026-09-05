"""Testes da conversão de rótulo. Rodam em segundos, sem carregar o modelo."""

from __future__ import annotations

import pytest

from chord_worker.labels import compact_label, pitch_class, reduced_label


class TestCompactLabel:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("C:maj", "C"),
            ("A:min", "Am"),
            ("G:min7", "Gm7"),
            ("F:maj7", "Fmaj7"),
            ("B:hdim7", "Bm7b5"),
            ("D:minmaj7", "Dmmaj7"),
            ("E:sus4", "Esus4"),
            ("Bb:maj", "Bb"),
        ],
    )
    def test_converte_grafia_harte(self, raw: str, expected: str) -> None:
        assert compact_label(raw) == expected

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("C:maj/3", "C/E"),
            ("C:maj/5", "C/G"),
            ("A:min/b3", "Am/C"),
            ("G:maj/b7", "G/F"),
            ("Bb:maj/3", "Bb/D"),
        ],
    )
    def test_converte_grau_de_baixo_em_nota(self, raw: str, expected: str) -> None:
        assert compact_label(raw) == expected

    def test_grafia_do_baixo_segue_a_tonica(self) -> None:
        # Tônica com bemol mantém a família de bemóis no baixo.
        assert compact_label("Eb:maj/3") == "Eb/G"
        assert compact_label("D:maj/b3") == "D/F"

    @pytest.mark.parametrize("raw", ["N", "X"])
    def test_ausencia_de_acorde_permanece_legivel_por_maquina(self, raw: str) -> None:
        # A interface decide exibir como "-"; o worker não decide isso.
        assert compact_label(raw) == "N"

    @pytest.mark.parametrize("raw", ["Cmaj", "", "H:maj"])
    def test_rejeita_rotulo_invalido(self, raw: str) -> None:
        with pytest.raises(ValueError):
            compact_label(raw)

    def test_rejeita_grau_de_baixo_desconhecido(self) -> None:
        with pytest.raises(ValueError, match="grau de baixo"):
            compact_label("C:maj/9")


class TestReducedLabel:
    @pytest.mark.parametrize(
        ("raw", "label", "family"),
        [
            ("C:maj7", "C", "Major"),
            ("A:min7", "Am", "Minor"),
            ("B:hdim7", "Bdim", "Diminished"),
            ("C:dim7", "Cdim", "Diminished"),
            ("G:aug", "Gaug", "Augmented"),
            ("D:sus2", "Dsus2", "Sus2"),
            ("E:sus4", "Esus4", "Sus4"),
            ("F:sus", "Fsus4", "Sus4"),
        ],
    )
    def test_descarta_extensao_preservando_triade(self, raw: str, label: str, family: str) -> None:
        reduced = reduced_label(raw)
        assert (reduced.label, reduced.family) == (label, family)

    def test_ausencia_de_acorde_nao_tem_tonica(self) -> None:
        assert reduced_label("N").root is None

    def test_barra_nao_muda_a_triade(self) -> None:
        assert reduced_label("C:maj/3").label == "C"


class TestPitchClass:
    @pytest.mark.parametrize(
        ("note", "expected"),
        [("C", 0), ("C#", 1), ("Db", 1), ("E", 4), ("Bb", 10), ("B", 11)],
    )
    def test_indice_cromatico(self, note: str, expected: int) -> None:
        assert pitch_class(note) == expected

    def test_enarmonicos_coincidem(self) -> None:
        assert pitch_class("C#") == pitch_class("Db")

    def test_rejeita_nota_invalida(self) -> None:
        with pytest.raises(ValueError, match="tônica"):
            pitch_class("H")
