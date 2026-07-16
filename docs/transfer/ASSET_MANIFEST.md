# Quick Transfer IMAGE2 资产清单

| 文件 | 用途 | 尺寸 | 来源与生成说明 |
|---|---|---:|---|
| `assets/transfer/quick-transfer-icons-source.png` | 高分辨率键控源图 | 1254×1254 | 内置 IMAGE2 / imagegen 生成的 4×4 Neo-XP / Pixel Glass 图标图集，纯洋红键控背景，仅作为源文件保留。 |
| `assets/transfer/quick-transfer-icons.png` | 主站与后台正式透明图标图集 | 1254×1254 ARGB | 使用 imagegen skill 自带 `remove_chroma_key.py` 从源图去背并验证四角 alpha=0；CSS 只做图集裁切与布局，不绘制图标。 |

图集顺序：

1. App、房间锁、文字、通用文件
2. 图片、视频、音频、PDF
3. 压缩包、上传、下载、暂停
4. 继续、取消、复制、删除

生成提示核心：原创 Y2K 像素玻璃、冰蓝/钴蓝/薰衣草/暖橙、深蓝像素描边、小尺寸可识别、无文字/emoji/水印、不复制 Windows、Apple 或第三方商业图标。

正式图集通过 `css/transfer.css` 的 `background-position` 使用；页面结构、文字、焦点、44px 热区和响应式布局仍由语义化 HTML/CSS/JavaScript 实现。
