(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const svg = $("#interactive-logo");
  const toggle = $("#logo-toggle");
  const logo = window.PALBALL_LOGO;
  const ns = "http://www.w3.org/2000/svg";
  const numberPattern = /[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi;
  // Keep both endpoint logos in a fixed viewport. PAL travels vertically first,
  // then horizontally; BALL can move underneath it without crossing letters.
  const groups = ["pal", "ball", "dot", "frame"].map((name) => {
    const group = document.createElementNS(ns, "g");
    group.dataset.part = name;
    svg.append(group);
    return group;
  });
  const shapes = logo.horizontal.map((path, i) => {
    const el = document.createElementNS(ns, "path");
    el.setAttribute("d", path);
    el.setAttribute("fill", "#ffffff");
    groups[i < 3 ? 0 : i < 7 ? 1 : i === 7 ? 2 : 3].append(el);
    const fromBox = el.getBBox();
    el.setAttribute("d", logo.stacked[i]);
    const toBox = el.getBBox();
    el.setAttribute("d", path);
    return { el, template: path, from: path.match(numberPattern).map(Number), to: logo.stacked[i].match(numberPattern).map(Number), fromBox, toBox };
  });
  let progress = 0, circleProgress = 0, target = 0, frame = 0;
  let viewport = { width: 0, height: 0 };
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = (t) => {
    t = Math.max(0, Math.min(t, 1));
    return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const origins = [[0, 3], [3, 7], [7, 8]].map(([start, end]) => {
    const subset = shapes.slice(start, end);
    return ["fromBox", "toBox"].map(key => ({
      x: Math.min(...subset.map(shape => shape[key].x)),
      y: Math.min(...subset.map(shape => shape[key].y))
    }));
  });
  const circleAtProgress = (value, fromValue, fromCircle, destination) => {
    if (destination) {
      const start = Math.max(fromValue, .46);
      const phase = start < 1 ? ease((value - start) / (1 - start)) : 1;
      return mix(fromCircle, 1, phase);
    }
    const start = Math.min(fromValue, .46);
    return start > 0 ? fromCircle * ease(value / start) : 0;
  };
  const paintLogo = (value, circleValue = circleProgress) => {
    progress = value;
    circleProgress = circleValue;
    const { width, height } = viewport;
    if (!width || !height) return;
    const vertical = ease(value / .46);
    const horizontal = ease((value - .46) / .54);
    // A shared scale keeps every PAL point on the same x coordinate on its
    // vertical leg. Separate endpoint fitting was visibly shrinking the word.
    // The return trip keeps the large circle while the frame opens sideways.
    // Reserve its widest extent so it stays inside the viewport at that turn.
    const sweepWidth = 2 * (shapes[8].fromBox.width + shapes[7].toBox.width) - 1037;
    const scale = Math.min(width / sweepWidth, height / 385);
    const fit = (w, h) => {
      return { scale, x: (width - w * scale) / 2, y: (height - h * scale) / 2 };
    };
    const fromFit = fit(1037, 237), toFit = fit(761, 385);
    shapes.slice(0, 8).forEach(({el, template, from, to}, i) => {
      const shapeProgress = i === 7 ? circleValue : horizontal;
      let index = 0;
      el.setAttribute("d", template.replace(numberPattern, () => {
        const n = mix(from[index], to[index], shapeProgress);
        index++;
        return n.toFixed(4);
      }));
    });
    origins.forEach(([from, to], i) => {
      const x = mix(fromFit.x + from.x * fromFit.scale, toFit.x + to.x * toFit.scale, horizontal);
      let y = mix(fromFit.y + from.y * fromFit.scale, toFit.y + to.y * toFit.scale, vertical);
      if (i === 2) {
        // On return, keep the large circle through PAL's horizontal leg, then
        // shrink as PAL descends. Both directions share the bottom anchor.
        const baseline = mix(fromFit.y + 237 * scale, toFit.y + 384.48 * scale, vertical);
        const diameter = mix(shapes[7].fromBox.height, shapes[7].toBox.height, circleValue) * scale;
        y = baseline - diameter;
      }
      const shapeProgress = i === 2 ? circleValue : horizontal;
      groups[i].setAttribute("transform", `translate(${x} ${y}) scale(${scale}) translate(${-mix(from.x, to.x, shapeProgress)} ${-mix(from.y, to.y, shapeProgress)})`);
    });
    // Expand the frame vertically before closing it horizontally around the words.
    const outline = shapes[8];
    const axes = ["x", "y", "y", "x", "y", "x", "x", "y", "x", "y", "x", "y"];
    let index = 0;
    outline.el.setAttribute("d", outline.template.replace(numberPattern, () => {
      const axis = axes[index];
      const a = outline.from[index] * fromFit.scale + fromFit[axis];
      const b = outline.to[index] * toFit.scale + toFit[axis];
      index++;
      return mix(a, b, axis === "x" ? horizontal : vertical).toFixed(4);
    }));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  };
  const resizeLogo = () => {
    const { width, height } = svg.getBoundingClientRect();
    if (width === viewport.width && height === viewport.height) return;
    viewport = { width, height };
    paintLogo(progress);
  };
  new ResizeObserver(resizeLogo).observe(svg);
  resizeLogo();
  toggle.addEventListener("click", () => {
    cancelAnimationFrame(frame);
    target = target ? 0 : 1;
    toggle.setAttribute("aria-pressed", String(Boolean(target)));
    toggle.setAttribute("aria-label", `로고 배리에이션 전환. 현재 ${target ? "두 줄형" : "가로형"}`);
    if (reduceMotion.matches) return paintLogo(target, target);
    const start = performance.now(), from = progress, fromCircle = circleProgress, destination = target;
    const duration = 1280 * Math.abs(destination - from);
    const animate = (now) => {
      const t = duration ? Math.min((now - start) / duration, 1) : 1;
      const value = mix(from, destination, t);
      paintLogo(value, circleAtProgress(value, from, fromCircle, destination));
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
  });

  const projects = window.PALBALL_PROJECTS || [];
  const list = $("#project-list"), dialog = $("#project-dialog");
  let filter = "all", view = "gallery", previousFocus;
  const pad = (n) => String(n).padStart(2, "0");
  const element = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const separatedText = (node, parts) => {
    node.replaceChildren();
    parts.forEach((part, index) => {
      if (index) {
        const dot = element("span", "round-separator");
        dot.setAttribute("aria-hidden", "true");
        node.append(" ", dot, " ");
      }
      node.append(String(part));
    });
    return node;
  };
  const roundPeriods = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.parentElement.closest(".sr-only,.prose-ending")) continue;
      if (/[^\s.]+\.(?=\s|$)/.test(walker.currentNode.textContent)) nodes.push(walker.currentNode);
    }
    nodes.forEach(node => {
      const text = node.textContent, fragment = document.createDocumentFragment();
      const pattern = /([^\s.]+)\.(?=\s|$)/g;
      let start = 0, match;
      while ((match = pattern.exec(text))) {
        fragment.append(text.slice(start, match.index));
        const ending = element("span", "prose-ending");
        const dot = element("span", "prose-stop");
        dot.setAttribute("aria-hidden", "true");
        ending.append(match[1], dot, element("span", "sr-only", "."));
        fragment.append(ending);
        start = pattern.lastIndex;
      }
      fragment.append(text.slice(start));
      node.replaceWith(fragment);
    });
  };

  // Three coincident blend layers remap the two brand colors exactly:
  // difference inverts; color-dodge restores white; lighten restores #181818.
  const cursor = $("#custom-cursor");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const cursorSupported = CSS.supports("mix-blend-mode", "color-dodge");
  const cursorSamples = new WeakMap();
  const imageCursorInk = (image, clientX, clientY) => {
    if (!image.complete || !image.naturalWidth) return "#ffffff";
    const rect = image.getBoundingClientRect();
    const fit = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    const drawnWidth = image.naturalWidth * fit, drawnHeight = image.naturalHeight * fit;
    const x = (clientX - rect.left - (rect.width - drawnWidth) / 2) / drawnWidth;
    const y = (clientY - rect.top - (rect.height - drawnHeight) / 2) / drawnHeight;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
    try {
      if (!cursorSamples.has(image)) {
        const canvas = document.createElement("canvas"); canvas.width = 192; canvas.height = 192;
        const context = canvas.getContext("2d", {willReadFrequently:true});
        context.drawImage(image, 0, 0, 192, 192);
        cursorSamples.set(image, context.getImageData(0, 0, 192, 192).data);
      }
      const pixels = cursorSamples.get(image), offset = (Math.floor(y * 192) * 192 + Math.floor(x * 192)) * 4;
      const luminance = .2126 * pixels[offset] + .7152 * pixels[offset + 1] + .0722 * pixels[offset + 2];
      return luminance > 155 ? "#181818" : "#ffffff";
    } catch { return "#ffffff"; }
  };
  const hideCursor = () => {
    cursor.hidden = true;
    document.documentElement.classList.remove("has-custom-cursor");
  };
  document.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || !cursorSupported || event.pointerType === "touch") return hideCursor();
    cursor.style.setProperty("--cursor-x", `${event.clientX}px`);
    cursor.style.setProperty("--cursor-y", `${event.clientY}px`);
    // Colored project images also keep the cursor in the two-color palette.
    const image = event.target.closest?.("img");
    const ink = image ? imageCursorInk(image, event.clientX, event.clientY) : null;
    cursor.classList.toggle("over-artwork", Boolean(ink));
    if (ink) cursor.style.setProperty("--cursor-ink", ink);
    cursor.hidden = false;
    document.documentElement.classList.add("has-custom-cursor");
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", hideCursor);
  window.addEventListener("blur", hideCursor);
  finePointer.addEventListener("change", hideCursor);
  const matchesCategory = (project, category) => category === "all" || (project.categories || [project.category]).includes(category);
  const countBy = (category) => projects.filter(project => matchesCategory(project, category)).length;
  $$(".work-count").forEach(el => el.textContent = `(${pad(projects.length)})`);
  $$("[data-filter]").forEach(button => {
    button.querySelector("span").textContent = `(${pad(countBy(button.dataset.filter))})`;
    button.addEventListener("click", () => { filter = button.dataset.filter; renderArchive(); });
  });
  $$("[data-view]").forEach(button => button.addEventListener("click", () => { view = button.dataset.view; renderArchive(); }));
  const renderArchive = () => {
    list.replaceChildren();
    list.classList.toggle("gallery", view === "gallery");
    $(".index-head").hidden = view === "gallery";
    const visible = projects.filter(project => matchesCategory(project, filter));
    visible.forEach(project => {
      const row = element("button", "project-row grid");
      row.type = "button";
      row.setAttribute("aria-label", `${project.title} 프로젝트 상세 보기`);
      if (project.thumbnail || project.images?.[0]) {
        const preview = element("span", "gallery-preview");
        const img = document.createElement("img");
        const setPreviewRatio = () => {
          if (img.naturalWidth && img.naturalHeight) preview.style.setProperty("--preview-ratio", String(img.naturalWidth / img.naturalHeight));
        };
        if (project.thumbnailWidth && project.thumbnailHeight) preview.style.setProperty("--preview-ratio", String(project.thumbnailWidth / project.thumbnailHeight));
        img.addEventListener("load", setPreviewRatio, {once:true});
        img.src = project.thumbnail || project.images[0].src; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
        if (img.complete) setPreviewRatio();
        preview.append(img); row.append(preview);
      }
      row.append(element("span", "project-name", project.title), element("span", "project-category", project.discipline), element("span", "project-type", project.type));
      row.addEventListener("click", () => openProject(project));
      list.append(row);
    });
    $("#empty-state").hidden = visible.length !== 0;
    $("#archive-count").textContent = `${pad(visible.length)} ${visible.length === 1 ? "PROJECT" : "PROJECTS"}`;
    $$("[data-filter]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === filter)));
    $$("[data-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === view)));
  };
  $("#show-all").addEventListener("click", () => { filter = "all"; renderArchive(); $("[data-filter=all]").focus(); });

  const openProject = (project) => {
    previousFocus = document.activeElement;
    $("#project-title").textContent = project.title;
    $("#project-title").lang = project.language || "en";
    const content = $("#detail-content"); content.replaceChildren();
    if (project.subtitle || project.context) {
      const introduction = element("div", "detail-introduction grid");
      const text = element("div");
      if (project.subtitle) text.append(element("p", "detail-subtitle", project.subtitle));
      if (project.context) text.append(element("p", "detail-context", project.context));
      introduction.append(text); content.append(introduction);
    }
    const description = element("div", "detail-description grid");
    const prose = element("div", "detail-prose");
    project.description.split(/\n\s*\n/).forEach(text => {
      const paragraph = element("p", "", text); roundPeriods(paragraph); prose.append(paragraph);
    });
    description.append(prose); content.append(description);
    const meta = element("div", "detail-meta grid");
    const fields = [["DISCIPLINE", project.discipline], ["TYPE", project.type], ...(project.credits || []).map(credit => [credit.label, credit.value])];
    fields.forEach(parts => meta.append(separatedText(element("p"), parts))); content.append(meta);
    const media = element("div", "project-media-grid grid");
    if (project.mediaType === "artwork") content.append(media);
    (project.images || []).forEach((item, i) => {
      if (project.mediaType === "artwork") {
        const figure = element("figure", `project-media ${item.layout || "wide"}`);
        const img = document.createElement("img"); img.src = item.src; img.alt = item.alt || project.title; img.loading = i ? "lazy" : "eager"; img.decoding = "async";
        if (item.width && item.height) { img.width = item.width; img.height = item.height; }
        figure.append(img);
        if (item.caption) {
          const caption = element("figcaption");
          caption.append(separatedText(element("span"), item.caption.split(/\s*[●/]\s*/)));
          figure.append(caption);
        }
        media.append(figure);
        return;
      }
      const figure = element("div", `detail-logo ${item.layout || ""}`);
      const img = document.createElement("img"); img.src = item.src; img.alt = item.alt || project.title; img.loading = "lazy";
      figure.append(img); content.append(figure);
      const caption = element("div", "image-caption grid");
      caption.append(separatedText(element("p"), (item.caption || "").split(/\s*[●/]\s*/))); content.append(caption);
    });
    dialog.returnValue = "";
    dialog.showModal(); document.body.classList.add("dialog-open"); dialog.scrollTop = 0;
    dialog.append(cursor);
    refreshHeaderInk();
    $("#close-project").focus({preventScroll:true});
  };
  const closeProject = () => dialog.close("");
  $("#detail-home").addEventListener("click", () => dialog.close("home"));
  $("#close-project").addEventListener("click", closeProject);
  $("#back-to-index").addEventListener("click", closeProject);
  dialog.addEventListener("close", () => {
    document.body.append(cursor);
    document.body.classList.remove("dialog-open");
    const focusTarget = dialog.returnValue === "home" ? $(".site-header .wordmark") :
      previousFocus?.closest("[data-page][hidden]") ? null : previousFocus;
    focusTarget?.focus({preventScroll:true});
  });

  // Hash routes keep each page independently addressable in the offline HTML.
  const pages = $$("main > [data-page]");
  const pageTitles = {
    home: "PALBALL — Graphic & Editorial Design",
    works: "WORKS — PALBALL",
    about: "ABOUT — PALBALL"
  };
  const legacyPages = { top: "home", work: "works", studio: "about", contact: "about" };
  const renderPage = (focusHeading = false) => {
    const hash = location.hash.slice(1);
    const page = Object.hasOwn(pageTitles, hash) ? hash :
      Object.hasOwn(legacyPages, hash) ? legacyPages[hash] : "home";
    if (hash && hash !== page) history.replaceState(null, "", `#${page}`);
    if (dialog.open) dialog.close(page === "home" ? "home" : "route");
    pages.forEach(section => { section.hidden = section.dataset.page !== page; });
    document.body.dataset.page = page;
    $(".site-footer").hidden = page === "home";
    $$(".site-header nav a").forEach(link => {
      if (link.hash === `#${page}`) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.title = pageTitles[page];
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (focusHeading) $("main > [data-page]:not([hidden]) h1").focus({preventScroll:true});
    if (page === "home") resizeLogo();
  };
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("hashchange", () => renderPage(true));
  $$("[data-page-link]").forEach(link => link.addEventListener("click", event => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.hash === location.hash) {
      event.preventDefault();
      renderPage(true);
    }
  }));
  $(".skip-link").addEventListener("click", event => {
    event.preventDefault();
    $("#main-content").focus({preventScroll:true});
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  $("#back-to-top").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "instant" : "smooth" });
    $("main > [data-page]:not([hidden]) h1").focus({preventScroll:true});
  });

  // Only the glyph masks filter the backdrop. Empty header space stays clear,
  // and each backdrop pixel maps to white or #181818, including colored art.
  const headerControls = $$(".site-header a,.detail-header a,.detail-header button");
  const headerInkSupported = CSS.supports("backdrop-filter", 'url("#header-contrast")');
  let headerInkFrame = 0;
  const paintHeaderInk = control => {
    const rect = control.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const style = getComputedStyle(control), padding = 8;
    const scale = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil((rect.width + padding * 2) * scale);
    canvas.height = Math.ceil((rect.height + padding * 2) * scale);
    const context = canvas.getContext("2d");
    context.scale(scale, scale);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.letterSpacing = style.letterSpacing;
    const text = control.textContent.trim().replace(/\s+/g, " ");
    const metrics = context.measureText(text);
    const fontSize = parseFloat(style.fontSize);
    const ascent = metrics.fontBoundingBoxAscent ?? fontSize * .8;
    const descent = metrics.fontBoundingBoxDescent ?? fontSize * .2;
    const baseline = padding + (rect.height - ascent - descent) / 2 + ascent;
    context.fillStyle = "#ffffff";
    context.fillText(text, padding, baseline);
    if (control.matches(":hover,:focus-visible,[aria-current=page]")) {
      context.fillRect(padding, baseline + 5, Math.min(rect.width, metrics.width), 1);
    }
    let ink = control.querySelector(".header-ink");
    if (!ink) {
      ink = element("span", "header-ink");
      ink.setAttribute("aria-hidden", "true");
      control.append(ink);
    }
    ink.style.setProperty("--ink-mask", `url("${canvas.toDataURL()}")`);
    control.classList.add("has-header-ink");
  };
  const refreshHeaderInk = () => {
    if (!headerInkSupported) return;
    cancelAnimationFrame(headerInkFrame);
    headerInkFrame = requestAnimationFrame(() => headerControls.forEach(paintHeaderInk));
  };
  if (headerInkSupported) {
    const inkResizeObserver = new ResizeObserver(refreshHeaderInk);
    const inkLabelObserver = new MutationObserver(refreshHeaderInk);
    headerControls.forEach(control => {
      inkResizeObserver.observe(control);
      inkLabelObserver.observe(control, {characterData:true, childList:true, subtree:true, attributes:true, attributeFilter:["aria-current"]});
      ["pointerenter", "pointerleave", "focus", "blur"].forEach(event => control.addEventListener(event, refreshHeaderInk));
    });
    document.fonts.ready.then(refreshHeaderInk);
    window.addEventListener("resize", refreshHeaderInk, {passive:true});
    refreshHeaderInk();
  }
  $("#copy-email").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("8palball@gmail.com");
      $("#copy-status").textContent = "이메일 주소를 복사했습니다.";
    } catch {
      $("#copy-status").textContent = "8palball@gmail.com 주소를 선택해 복사해주세요.";
    }
  });
  $("#copyright-year").textContent = new Date().getFullYear();
  $$(".statement p,.hero-caption>p:first-child,.section-aside,.archive-end>p:first-child").forEach(roundPeriods);
  renderArchive();
  renderPage();
})();
