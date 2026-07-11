# Japanese Kokoro voice notice

The Kokoro v1.0 model and bundled voice embeddings are distributed under
Apache-2.0. The upstream Kokoro voice inventory additionally identifies source
material that requires attribution for four of the five Japanese voices used by
this project.

| Model voice | Upstream reading / source material |
| --- | --- |
| `jf_alpha` | No additional source attribution listed by Kokoro. |
| `jf_gongitsune` | *Gongitsune* (`tnc__gongitsune`) |
| `jf_nezumi` | *Nezumi no Yomeiri* (`tnc__nezuminoyomeiri`) |
| `jf_tebukuro` | *Tebukuro wo Kaini* (`tnc__tebukurowokaini`) |
| `jm_kumo` | *Kumo no Ito* (`tnc__kumonoito`) |

The four named readings come from the `tnc` series in **Koniwa (声庭), an open
collection of annotated Japanese voices**, maintained by `shirayu`. Koniwa
credits the announcers of Television Nishinippon Corporation (テレビ西日本) and
lists the `tnc` audio as **Creative Commons Attribution 3.0 (CC BY 3.0)**; the
underlying literary texts are listed as public domain.

- Koniwa collection and attribution table:
  https://github.com/koniwa/koniwa
- CC BY 3.0 license:
  https://creativecommons.org/licenses/by/3.0/
- Kokoro Japanese voice inventory:
  https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
- Kokoro model card and Apache-2.0 declaration:
  https://huggingface.co/hexgrad/Kokoro-82M
- Kokoro ONNX model-files-v1.0 release:
  https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0

This notice should remain with distributions that include audio rendered with
these Japanese voices. It records upstream attribution; it does not change the
license of LuSu's original stage scripts or application code.
