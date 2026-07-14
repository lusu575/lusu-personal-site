"""Loopback-only AivisSpeech Engine adapter for reviewed Japanese readings."""

from __future__ import annotations

import copy
import hashlib
import json
import math
import os
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence


PIPELINE_FINGERPRINT = "aivisspeech-1.2.0-aivmx-v3"
ACML_ID = "ACML-1.0"
RATE_ADJUSTMENT_POLICY = "post-synthesis-active-mora-rate-v3"
RATE_ADJUSTMENT_TARGET_MORA_RATE = 6.5
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_CJK_RANGES = (
    (0x3400, 0x4DBF),
    (0x4E00, 0x9FFF),
    (0xF900, 0xFAFF),
    (0x20000, 0x2FA1F),
)
_QUERY_FIELDS = (
    "speedScale",
    "pitchScale",
    "intonationScale",
    "volumeScale",
    "prePhonemeLength",
    "postPhonemeLength",
    "pauseLength",
    "pauseLengthScale",
)
_PUNCTUATION_CANONICAL = {
    "、": "、",
    "，": "、",
    "､": "、",
    "。": "。",
    "．": "。",
    "｡": "。",
    "！": "！",
    "‼": "！！",
    "？": "？",
    "⁇": "？？",
    "⁈": "？！",
    "⁉": "！？",
    "…": "…",
    "⋯": "…",
    "︙": "…",
    "「": "「",
    "」": "」",
    "『": "『",
    "』": "』",
    "“": "「",
    "”": "」",
    "‘": "『",
    "’": "』",
    "（": "（",
    "）": "）",
    "【": "【",
    "】": "】",
    "〈": "〈",
    "〉": "〉",
    "《": "《",
    "》": "》",
    "〔": "〔",
    "〕": "〕",
    "・": "・",
    "：": "：",
    "；": "；",
}


def _canonical_json(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_kana_reading(reading: str) -> str:
    """Require reviewed kana while allowing Japanese punctuation and long vowels."""

    if not isinstance(reading, str) or not reading.strip():
        raise ValueError("reading must be non-empty pure kana")
    value = reading.strip()
    has_kana = False
    for char in value:
        codepoint = ord(char)
        if any(start <= codepoint <= end for start, end in _CJK_RANGES):
            raise ValueError("reading must be pure kana without kanji, ASCII, or digits")
        if char.isascii() or unicodedata.category(char) == "Nd":
            raise ValueError("reading must be pure kana without kanji, ASCII, or digits")
        if 0x3040 <= codepoint <= 0x30FF or 0x31F0 <= codepoint <= 0x31FF:
            has_kana = True
    if not has_kana:
        raise ValueError("reading must contain pure kana")
    return value


def mora_phoneme_sequence(accent_phrases: Sequence[Mapping[str, Any]]) -> tuple[str, ...]:
    """Return an auditable consonant:vowel sequence and reject incomplete moras."""

    if not isinstance(accent_phrases, Sequence) or isinstance(accent_phrases, (str, bytes)):
        raise ValueError("Aivis accent_phrases must be an array")
    result: list[str] = []
    for phrase_index, phrase in enumerate(accent_phrases):
        if not isinstance(phrase, Mapping):
            raise ValueError(f"Aivis accent phrase {phrase_index} is not an object")
        moras = phrase.get("moras")
        if not isinstance(moras, list) or not moras:
            raise ValueError(f"Aivis accent phrase {phrase_index} has no moras")
        for mora_index, mora in enumerate([*moras, *([phrase["pause_mora"]] if phrase.get("pause_mora") else [])]):
            if not isinstance(mora, Mapping):
                raise ValueError(f"Aivis mora {phrase_index}:{mora_index} is not an object")
            vowel = mora.get("vowel")
            consonant = mora.get("consonant")
            if not isinstance(vowel, str) or not vowel.strip():
                raise ValueError(f"Aivis mora phoneme is empty at {phrase_index}:{mora_index}")
            if consonant is not None and (not isinstance(consonant, str) or not consonant.strip()):
                raise ValueError(f"Aivis mora phoneme is empty at {phrase_index}:{mora_index}")
            result.append(f"{consonant}:{vowel}" if consonant else vowel)
    if not result:
        raise ValueError("Aivis returned no mora phonemes")
    return tuple(result)


def _prosody_structure(
    accent_phrases: object,
) -> tuple[tuple[int, bool, bool], ...] | None:
    """Describe only the structure Aivis expects ``kana`` to agree with.

    The reviewed phrases remain authoritative for every mora.  The surface
    text is safe to retain as Aivis' ordinary synthesis text only when its
    accent phrase, pause, and interrogative structure matches the reviewed
    reading.  Mora phonemes intentionally are not compared here because the
    reviewed reading exists specifically to correct the surface analysis.
    """

    if not isinstance(accent_phrases, list) or not accent_phrases:
        return None
    structure: list[tuple[int, bool, bool]] = []
    for phrase in accent_phrases:
        if not isinstance(phrase, Mapping):
            return None
        accent = phrase.get("accent")
        if not isinstance(accent, int) or isinstance(accent, bool):
            return None
        structure.append(
            (
                accent,
                phrase.get("pause_mora") is not None,
                phrase.get("is_interrogative") is True,
            )
        )
    return tuple(structure)


def _punctuation_topology(text: str) -> tuple[str, ...]:
    """Return normalized Japanese sentence punctuation in source order."""

    topology: list[str] = []
    index = 0
    while index < len(text):
        if text.startswith("...", index):
            run_end = index
            while text.startswith("...", run_end):
                topology.append("…")
                run_end += 3
            index = run_end
            continue
        char = text[index]
        if char == ",":
            topology.append("、")
        elif char == ".":
            topology.append("。")
        elif char == "!":
            topology.append("！")
        elif char == "?":
            topology.append("？")
        elif char in {'"', "'"}:
            # ASCII quotes do not encode opening/closing direction, so retain
            # a neutral marker instead of guessing a Japanese quote side.
            topology.append(char)
        else:
            canonical = _PUNCTUATION_CANONICAL.get(char)
            if canonical:
                topology.extend(canonical)
        index += 1
    return tuple(topology)


@dataclass(frozen=True)
class PreparedAivisQuery:
    surface: str
    reading: str
    voice_key: str
    model_uuid: str
    model_version: str
    model_sha256: str
    style_name: str
    style_id: int
    query: dict[str, Any]
    query_parameters: dict[str, Any]
    mora_phonemes: tuple[str, ...]
    mora_sha256: str
    rate_adjustment: dict[str, Any] | None = None

    @property
    def model_voice(self) -> str:
        return f"{self.model_uuid}:{self.style_name}"


def retime_prepared_query(
    prepared: PreparedAivisQuery,
    observed_mora_rate: float,
    *,
    maximum_mora_rate: float = 7.2,
    target_mora_rate: float = RATE_ADJUSTMENT_TARGET_MORA_RATE,
    minimum_speed_scale: float = 0.5,
) -> PreparedAivisQuery:
    """Deterministically slow a prepared query after measuring one baseline render.

    AivisSpeech Engine deliberately exposes zero-valued mora duration fields, so
    an actual baseline render is the only supported duration observation.  A
    query already at or below the calibration target is returned byte-for-byte
    unchanged, preserving its existing query and content hashes.  The lower
    target leaves deterministic headroom beneath the hard publication limit.
    """

    values = (observed_mora_rate, maximum_mora_rate, target_mora_rate, minimum_speed_scale)
    if any(not isinstance(value, (int, float)) or not math.isfinite(float(value)) for value in values):
        raise ValueError("teaching mora-rate values must be finite numbers")
    observed = float(observed_mora_rate)
    maximum = float(maximum_mora_rate)
    target = float(target_mora_rate)
    minimum_speed = float(minimum_speed_scale)
    if observed <= 0 or minimum_speed <= 0 or not 0 < target < maximum:
        raise ValueError("teaching mora-rate values are out of range")
    if observed <= target:
        return prepared

    current_speed = prepared.query.get("speedScale")
    if (
        not isinstance(current_speed, (int, float))
        or not math.isfinite(float(current_speed))
        or float(current_speed) <= 0
    ):
        raise ValueError("prepared Aivis query has no valid speedScale")
    current_speed = float(current_speed)
    configured_speed = prepared.query_parameters.get("configuredSpeedScale", current_speed)
    if (
        not isinstance(configured_speed, (int, float))
        or not math.isfinite(float(configured_speed))
        or float(configured_speed) <= 0
    ):
        raise ValueError("prepared Aivis query has no valid configuredSpeedScale")
    configured_speed = float(configured_speed)
    proposed = current_speed * target / observed
    adjusted_speed = math.floor(proposed * 1_000_000) / 1_000_000
    if adjusted_speed < minimum_speed:
        raise ValueError(
            "teaching mora-rate limit is unreachable at the minimum Aivis speedScale"
        )

    query = copy.deepcopy(prepared.query)
    query["speedScale"] = adjusted_speed
    query_parameters = copy.deepcopy(prepared.query_parameters)
    query_parameters.update(
        {
            "speedScale": adjusted_speed,
            "configuredSpeedScale": configured_speed,
            "rateAdjustmentPolicy": RATE_ADJUSTMENT_POLICY,
            "maximumMoraPerSecond": maximum,
            "targetMoraPerSecond": target,
        }
    )
    adjustment = {
        "policy": RATE_ADJUSTMENT_POLICY,
        "observedMoraPerSecond": round(observed, 6),
        "configuredSpeedScale": configured_speed,
        "calibrationSpeedScale": current_speed,
        "adjustedSpeedScale": adjusted_speed,
        "maximumMoraPerSecond": maximum,
        "targetMoraPerSecond": target,
    }
    return replace(
        prepared,
        query=query,
        query_parameters=query_parameters,
        rate_adjustment=adjustment,
    )


def restore_prepared_query_rate(
    prepared: PreparedAivisQuery,
    adjustment: Mapping[str, Any] | None,
    *,
    minimum_speed_scale: float = 0.5,
) -> PreparedAivisQuery:
    """Restore a previously audited per-item speed without a baseline render."""

    if not isinstance(adjustment, Mapping):
        raise ValueError("recorded rate adjustment is missing")
    if adjustment.get("policy") != RATE_ADJUSTMENT_POLICY:
        raise ValueError("recorded rate adjustment policy is invalid")
    configured = prepared.query.get("speedScale")
    recorded_configured = adjustment.get("configuredSpeedScale")
    calibration_speed = adjustment.get("calibrationSpeedScale")
    adjusted = adjustment.get("adjustedSpeedScale")
    observed = adjustment.get("observedMoraPerSecond")
    maximum = adjustment.get("maximumMoraPerSecond")
    target = adjustment.get("targetMoraPerSecond")
    numeric = (
        configured,
        recorded_configured,
        calibration_speed,
        adjusted,
        observed,
        maximum,
        target,
    )
    if any(
        not isinstance(value, (int, float)) or not math.isfinite(float(value))
        for value in numeric
    ):
        raise ValueError("recorded rate adjustment values are invalid")
    if not math.isclose(float(configured), float(recorded_configured), abs_tol=1e-9):
        raise ValueError("recorded rate adjustment configured speed does not match")
    expected_adjusted = math.floor(
        float(calibration_speed) * float(target) / float(observed) * 1_000_000
    ) / 1_000_000
    if (
        float(calibration_speed) > float(configured)
        or float(calibration_speed) <= float(adjusted)
        or not math.isclose(float(adjusted), expected_adjusted, abs_tol=1e-9)
    ):
        raise ValueError("recorded rate adjustment calibration is invalid")
    if (
        float(adjusted) < float(minimum_speed_scale)
        or float(adjusted) >= float(configured)
        or not 0 < float(target) < float(maximum)
        or float(observed) <= float(target)
    ):
        raise ValueError("recorded rate adjustment values are out of range")

    query = copy.deepcopy(prepared.query)
    query["speedScale"] = float(adjusted)
    query_parameters = copy.deepcopy(prepared.query_parameters)
    query_parameters.update(
        {
            "speedScale": float(adjusted),
            "configuredSpeedScale": float(configured),
            "rateAdjustmentPolicy": RATE_ADJUSTMENT_POLICY,
            "maximumMoraPerSecond": float(maximum),
            "targetMoraPerSecond": float(target),
        }
    )
    return replace(
        prepared,
        query=query,
        query_parameters=query_parameters,
        rate_adjustment=dict(adjustment),
    )


RequestFunction = Callable[..., Any]


class AivisAdapter:
    """Create deterministic Aivis queries without trusting engine-side kanji readings."""

    execution_provider = "CPU"

    def __init__(
        self,
        *,
        base_url: str,
        engine_version: str,
        models: Sequence[Mapping[str, Any]],
        voices: Mapping[str, Mapping[str, Any]],
        timeout_seconds: float = 120,
        request: RequestFunction | None = None,
        verify_model_files: bool = True,
    ) -> None:
        parsed = urllib.parse.urlsplit(base_url.rstrip("/"))
        if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
            raise ValueError("AivisSpeech baseUrl must be an HTTP loopback endpoint")
        self.base_url = base_url.rstrip("/")
        self.engine_version = str(engine_version)
        self.models = [dict(model) for model in models]
        self.voices = {key: dict(value) for key, value in voices.items()}
        self.timeout_seconds = float(timeout_seconds)
        self._request_override = request
        self.verify_model_files = bool(verify_model_files)
        self._provenance: dict[str, Any] | None = None
        self._model_infos: dict[str, Mapping[str, Any]] = {}
        self._speakers: list[Mapping[str, Any]] = []

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        body: Any = None,
        expect_binary: bool = False,
    ) -> Any:
        clean_params = {
            key: (str(value).lower() if isinstance(value, bool) else value)
            for key, value in (params or {}).items()
        }
        if self._request_override is not None:
            return self._request_override(
                method,
                path,
                params=dict(params or {}),
                body=body,
                expect_binary=expect_binary,
            )
        query = urllib.parse.urlencode(clean_params)
        url = f"{self.base_url}{path}{'?' + query if query else ''}"
        data = _canonical_json(body) if body is not None else None
        headers = {"Accept": "audio/wav" if expect_binary else "application/json"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                payload = response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[-2000:]
            raise RuntimeError(
                f"AivisSpeech request failed: {method} {path}: HTTP {error.code}: {detail}"
            ) from error
        except (urllib.error.URLError, TimeoutError) as error:
            raise RuntimeError(f"AivisSpeech request failed: {method} {path}: {error}") from error
        if expect_binary:
            return payload
        return json.loads(payload.decode("utf-8"))

    def verify_provenance(self) -> dict[str, Any]:
        if self._provenance is not None:
            return copy.deepcopy(self._provenance)
        if len(self.models) != 4 or len({model.get("uuid") for model in self.models}) != 4:
            raise ValueError("Aivis provenance requires exactly four unique models")
        actual_version = str(self._request("GET", "/version"))
        if actual_version != self.engine_version:
            raise RuntimeError(
                f"AivisSpeech Engine version mismatch: {actual_version!r} != {self.engine_version!r}"
            )
        devices = self._request("GET", "/supported_devices")
        if not isinstance(devices, Mapping) or devices.get("cpu") is not True:
            raise RuntimeError("AivisSpeech Engine does not report CPU support")
        model_infos = self._request("GET", "/aivm_models")
        speakers = self._request("GET", "/speakers")
        if not isinstance(model_infos, Mapping) or not isinstance(speakers, list):
            raise RuntimeError("AivisSpeech Engine returned an invalid model or speaker catalog")
        verified: list[dict[str, Any]] = []
        for configured in self.models:
            uuid = str(configured.get("uuid", "")).lower()
            if not _UUID.fullmatch(uuid):
                raise ValueError(f"invalid AIVM model UUID: {uuid!r}")
            actual = model_infos.get(uuid)
            if not isinstance(actual, Mapping) or actual.get("is_loaded") is not True:
                raise RuntimeError(f"configured AIVM model is not loaded: {uuid}")
            manifest = actual.get("manifest")
            if not isinstance(manifest, Mapping):
                raise RuntimeError(f"AIVM model manifest is missing: {uuid}")
            expected_version = str(configured.get("version", ""))
            if str(manifest.get("version", "")) != expected_version:
                raise RuntimeError(f"AIVM model version mismatch: {uuid}")
            expected_hash = str(configured.get("sha256", "")).lower()
            if not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
                raise ValueError(f"AIVM model SHA-256 is invalid: {uuid}")
            if configured.get("license") != ACML_ID:
                raise ValueError(f"AIVM model license must be {ACML_ID}: {uuid}")
            license_text = str(manifest.get("license", ""))
            if "Aivis Common Model License" not in license_text or "ACML" not in license_text:
                raise RuntimeError(f"AIVM model does not attest ACML: {uuid}")
            file_path = Path(str(actual.get("file_path", "")))
            if self.verify_model_files:
                if not file_path.is_file():
                    raise FileNotFoundError(f"AIVM model file is missing: {uuid}")
                actual_hash = _file_sha256(file_path)
                if actual_hash != expected_hash:
                    raise RuntimeError(f"AIVM model SHA-256 mismatch: {uuid}")
            verified.append(
                {
                    "uuid": uuid,
                    "name": str(manifest.get("name", "")),
                    "version": expected_version,
                    "sha256": expected_hash,
                    "bytes": int(actual.get("file_size", file_path.stat().st_size if file_path.is_file() else 0)),
                    "license": ACML_ID,
                }
            )
        self._model_infos = {str(key): value for key, value in model_infos.items()}
        self._speakers = [speaker for speaker in speakers if isinstance(speaker, Mapping)]
        self._provenance = {
            "engine": {"name": "AivisSpeech Engine", "version": actual_version},
            "executionProvider": "CPU",
            "models": verified,
        }
        return copy.deepcopy(self._provenance)

    def _resolve_voice(self, voice_key: str) -> tuple[dict[str, Any], Mapping[str, Any], int]:
        self.verify_provenance()
        voice = self.voices.get(voice_key)
        if not isinstance(voice, Mapping):
            raise ValueError(f"unknown Aivis voice key: {voice_key}")
        model_uuid = str(voice.get("modelUuid", "")).lower()
        style_name = str(voice.get("styleName", ""))
        model = self._model_infos.get(model_uuid)
        manifest = model.get("manifest") if isinstance(model, Mapping) else None
        model_speakers = manifest.get("speakers") if isinstance(manifest, Mapping) else None
        speaker_uuids = {
            str(speaker.get("uuid"))
            for speaker in (model_speakers or [])
            if isinstance(speaker, Mapping) and speaker.get("uuid")
        }
        matches: list[int] = []
        for speaker in self._speakers:
            if str(speaker.get("speaker_uuid")) not in speaker_uuids:
                continue
            for style in speaker.get("styles") or []:
                if isinstance(style, Mapping) and style.get("name") == style_name:
                    matches.append(int(style["id"]))
        if len(matches) != 1:
            raise RuntimeError(
                f"Aivis style must resolve exactly once: model={model_uuid}, style={style_name!r}"
            )
        configured_model = next(model for model in self.models if model.get("uuid") == model_uuid)
        return dict(voice), configured_model, matches[0]

    def voice_descriptor(self, voice_key: str) -> dict[str, Any]:
        voice, model, style_id = self._resolve_voice(voice_key)
        return {
            "modelUuid": str(model["uuid"]),
            "modelVersion": str(model["version"]),
            "modelSha256": str(model["sha256"]),
            "styleName": str(voice["styleName"]),
            "styleId": style_id,
        }

    def propose_surface_reading(self, surface: str, voice_key: str) -> str:
        """Return a review candidate from Aivis' Japanese text analysis.

        This helper is intentionally separate from synthesis. Its output is a
        draft for a human to review and save as ``readingJa`` / ``reading``;
        ``prepare_query`` still rejects unreviewed surface text.
        """

        if not isinstance(surface, str) or not surface.strip():
            raise ValueError("surface text must not be empty")
        _voice, _model, style_id = self._resolve_voice(voice_key)
        phrases = self._request(
            "POST",
            "/accent_phrases",
            params={"text": surface.strip(), "speaker": style_id, "is_kana": False},
        )
        mora_phoneme_sequence(phrases)
        punctuation = {".": "。", ",": "、", "?": "？", "!": "！"}
        rendered: list[str] = []
        for phrase in phrases:
            moras = list(phrase.get("moras") or [])
            if phrase.get("pause_mora"):
                moras.append(phrase["pause_mora"])
            for mora in moras:
                text = str(mora.get("text", ""))
                text = punctuation.get(text, text)
                if not text:
                    raise ValueError("Aivis reading candidate contains an empty mora")
                rendered.append(text)
        candidate = "".join(rendered)
        return validate_kana_reading(candidate)

    def prepare_query(self, surface: str, reading: str, voice_key: str) -> PreparedAivisQuery:
        if not isinstance(surface, str) or not surface.strip():
            raise ValueError("surface text must not be empty")
        surface = surface.strip()
        reading = validate_kana_reading(reading)
        voice, model, style_id = self._resolve_voice(voice_key)
        base_query = self._request(
            "POST", "/audio_query", params={"text": surface, "speaker": style_id}
        )
        phrases = self._request(
            "POST",
            "/accent_phrases",
            params={"text": reading, "speaker": style_id, "is_kana": False},
        )
        if not isinstance(base_query, Mapping) or not isinstance(phrases, list):
            raise RuntimeError("AivisSpeech returned an invalid audio query")
        phonemes = mora_phoneme_sequence(phrases)
        query = copy.deepcopy(dict(base_query))
        query["accent_phrases"] = copy.deepcopy(phrases)
        # AivisSpeech uses ``kana`` as the ordinary synthesis text, unlike
        # VOICEVOX's AquesTalk-style reading field. Preserve the surface text
        # for natural prosody while the reviewed-reading accent phrases above
        # continue to lock every mora and pronunciation.
        surface_structure = _prosody_structure(base_query.get("accent_phrases"))
        reviewed_structure = _prosody_structure(phrases)
        structures_match = (
            surface_structure is not None
            and reviewed_structure is not None
            and surface_structure == reviewed_structure
            and _punctuation_topology(surface) == _punctuation_topology(reading)
        )
        kana_source = "surface" if structures_match else "reviewed-reading-fallback"
        query["kana"] = surface if structures_match else reading
        query_parameters: dict[str, Any] = {"kanaSource": kana_source}
        for field in _QUERY_FIELDS:
            if field in voice:
                query[field] = voice[field]
            if field in query:
                query_parameters[field] = query[field]
        query["outputSamplingRate"] = 44_100
        query["outputStereo"] = False
        query_parameters.update({"outputSamplingRate": 44_100, "outputStereo": False})
        mora_payload = {
            "accentPhrases": phrases,
            "phonemes": list(phonemes),
        }
        return PreparedAivisQuery(
            surface=surface,
            reading=reading,
            voice_key=voice_key,
            model_uuid=str(model["uuid"]),
            model_version=str(model["version"]),
            model_sha256=str(model["sha256"]),
            style_name=str(voice["styleName"]),
            style_id=style_id,
            query=query,
            query_parameters=query_parameters,
            mora_phonemes=phonemes,
            mora_sha256=hashlib.sha256(_canonical_json(mora_payload)).hexdigest(),
        )

    def synthesize_prepared(
        self,
        prepared: PreparedAivisQuery,
        output_path: str | Path,
    ) -> Path:
        payload = self._request(
            "POST",
            "/synthesis",
            params={"speaker": prepared.style_id},
            body=prepared.query,
            expect_binary=True,
        )
        if not isinstance(payload, bytes) or not payload:
            raise RuntimeError("AivisSpeech synthesis returned no WAV data")
        destination = Path(output_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(
            f".{destination.stem}.{os.getpid()}.{time.time_ns()}."
            f"aivis-candidate{destination.suffix}"
        )
        try:
            with temporary.open("wb") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)
        return destination
