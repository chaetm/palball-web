# PALBALL workspace

- Deliver the local, self-contained `PALBALL.html`. Do not publish Sites unless the user asks again.
- The user has authorized automatic import of new material under `works/`. The local watcher handles this. If it is stopped, run `python3 -B palball-site/tools/sync_works.py` during future work to include new projects without asking again.
- Keep original images, PDFs, and descriptions in `works/` intact. The importer writes web copies under `palball-site/dist/assets/works/`.
- Source UI files live under `palball-site/dist/`; regenerate with `python3 -B palball-site/tools/export_html.py` after changing source UI code. Check for direct user edits in `PALBALL.html` before regenerating the whole file. The watcher patches only archive data to preserve those edits.
- Preserve the supplied logo shapes, the two-stage logo motion, #181818 background, white typography, and the custom round cursor.
- Use 1px underlines for hover interactions. Work titles show an underline and arrow without lateral movement. Do not add work numbering in index, gallery, or image captions.
- Gallery previews use variable widths based on image proportions. Place title, discipline, and type together below the image, aligned left.
- Limit gallery thumbnails to 560 CSS pixels in height. Stack discipline and type on separate rows in project details. Keep the footer free of the graphic/editorial tagline.
- BLOC PDF web copies use a 2px crop on all sides to remove rasterization hairlines; preserve `pdfCropPixels: 2` on reimport and never crop the source PDF.
