# Japanese AivisSpeech voice notice

The Japanese audio prepared for “日本語の裏側” application 1.0.4 / content 1.0.3 was rendered locally
with **AivisSpeech Engine 1.2.0** and the four AIVMX models listed below. The
model weights are not included in this repository; only pre-generated MP3
files, reproducibility metadata, and hashes are published.

## Engine

- AivisSpeech Engine 1.2.0
- Project: https://github.com/Aivis-Project/AivisSpeech-Engine
- Release: https://github.com/Aivis-Project/AivisSpeech-Engine/releases/tag/1.2.0
- License: LGPL-3.0
- Execution used for this release: loopback-only, CPU-only offline batch
  processing; no service, startup entry, scheduled task, or browser-side model
  loading.

## AIVMX models

All four model manifests declare **Aivis Common Model License (ACML) 1.0**.
The complete license, including prohibited uses and redistribution conditions,
is authoritative:
https://github.com/Aivis-Project/ACML/blob/master/ACML-1.0.md

| Public credit | Version | Model UUID | SHA-256 | Creator / voice credit | Official model page |
| --- | --- | --- | --- | --- | --- |
| AivisSpeech: コハク | 1.1.0 | `22e8ed77-94fe-4ef2-871f-a86f94e9a579` | `3f5c08b52bb8a64efd361268580c81510f96c927cd6905aa7dbae6851333270a` | © Oz Chat / Trippy; CV: ねゆたろ | https://hub.aivis-project.com/aivm-models/22e8ed77-94fe-4ef2-871f-a86f94e9a579 |
| AivisSpeech: まお | 1.2.0 | `a59cb814-0083-4369-8542-f51a29e72af7` | `f87ccea2e8e2de0e0bfe52e803945af903b4086bf25621a015111628f00e4119` | © Oz Chat / Trippy; CV: ねゆたろ | https://hub.aivis-project.com/aivm-models/a59cb814-0083-4369-8542-f51a29e72af7 |
| AivisSpeech: fumifumi | 1.0.0 | `71e72188-2726-4739-9aa9-39567396fb2a` | `dec42930f9fdd5948831a271fcc8b377f56001273c6d3035cf68465b6dbaf91a` | model: kokushin; voice: sagawafumiya | https://hub.aivis-project.com/aivm-models/71e72188-2726-4739-9aa9-39567396fb2a |
| AivisSpeech: 阿井田 茂 | 1.0.0 | `47e53151-a378-46f3-abee-ce13aa07feb1` | `6dabe29de5ec2c1715e12a430805e1bff6ec64a315cccec2d26fad029df83243` | model / CV: 古山キリヲ | https://hub.aivis-project.com/aivm-models/47e53151-a378-46f3-abee-ce13aa07feb1 |

These are original-character or original-voice models. The project does not
claim that they are voices from an existing anime, game, VTuber, celebrity, or
franchise, and the audio must not be presented as official speech by any real
person or rights holder.

This notice records provenance and credits; it does not replace the ACML text
or change the license of LuSu's original stage scripts and application code.
