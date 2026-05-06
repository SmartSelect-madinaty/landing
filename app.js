// app.js
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ================== 1) Fix FINAL ya only: (ي at end of word) -> ى ==================
  const YA = "\u064A";            // ي
  const ALEF_MAQSURA = "\u0649";  // ى

  const FINAL_YA_RE =
    /ي(?=$|[\s\u00A0\u2000-\u200A\u202F\u205F\u3000\)\]\}\>»"'\u060C\u061B\u061F\.,!?:;…])/g;

  function shouldSkipNode(node){
    if (!node) return true;

    const p = node.parentElement;
    if (!p) return false;

    const tag = p.tagName?.toLowerCase?.() || "";
    if (["script","style","noscript","textarea","input","select","option","code","pre"].includes(tag)) return true;

    if (p.isContentEditable) return true;
    if (p.closest?.("[data-no-ya-fix]")) return true;

    return false;
  }

  function replaceFinalYaInTextNode(tn){
    if (!tn || !tn.nodeValue) return 0;
    if (tn.nodeValue.indexOf(YA) === -1) return 0;
    if (shouldSkipNode(tn)) return 0;

    const before = tn.nodeValue;
    const after = before.replace(FINAL_YA_RE, ALEF_MAQSURA);

    if (after !== before) {
      tn.nodeValue = after;
      return 1;
    }
    return 0;
  }

  function fixYaDots(root = document.body){
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let changed = 0;

    while (walker.nextNode()) {
      changed += replaceFinalYaInTextNode(walker.currentNode);
    }
    return changed;
  }

  function observeYaFix(root = document.body){
    if (!root) return;

    if (root._yaObserver) {
      try { root._yaObserver.disconnect(); } catch(e){}
      root._yaObserver = null;
    }

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData" && m.target) {
          replaceFinalYaInTextNode(m.target);
          continue;
        }
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === Node.TEXT_NODE) {
              replaceFinalYaInTextNode(n);
            } else if (n.nodeType === Node.ELEMENT_NODE) {
              fixYaDots(n);
            }
          });
        }
      }
    });

    obs.observe(root, {
      subtree: true,
      childList: true,
      characterData: true
    });

    root._yaObserver = obs;
  }

  // ============ Force "go to absolute top" for logo clicks ============
  function initTopLinks(){
    $$(".js-top").forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        history.replaceState(null, "", "#pageTop");
      });
    });
  }

  // ============ Header menu (MOBILE SAFE) ============
  function initHeaderMenu(){
    const menu   = $("#hmenu");
    const btn    = $("#hmenuBtn");
    const panel  = $("#hmenuPanel");
    const header = $(".header");
    if (!menu || !btn || !panel) return;

    function syncMenuTop(){
      const h = header?.getBoundingClientRect?.().height || 88;
      document.documentElement.style.setProperty("--menuTop", `${Math.round(h)}px`);
    }

    function open(){
      syncMenuTop();
      menu.classList.add("is-open");
      btn.setAttribute("aria-expanded","true");
      document.body.classList.add("menu-open");
    }

    function close(){
      menu.classList.remove("is-open");
      btn.setAttribute("aria-expanded","false");
      document.body.classList.remove("menu-open");
    }

    function toggle(){
      menu.classList.contains("is-open") ? close() : open();
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });

    panel.addEventListener("click", (e) => {
      e.stopPropagation();
      const a = e.target.closest("a");
      if (a) close();
    });

    panel.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    panel.addEventListener("touchmove",  (e) => e.stopPropagation(), { passive: true });

    document.addEventListener("click", () => close());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    window.addEventListener("resize", () => {
      if (menu.classList.contains("is-open")) syncMenuTop();
    });

    window.addEventListener("orientationchange", () => {
      if (menu.classList.contains("is-open")) setTimeout(syncMenuTop, 80);
    });
  }

  // Fetch config
  async function loadConfig() {
    const res = await fetch("./config/site.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load site.json (${res.status})`);
    return await res.json();
  }

  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r())) ;

  async function decodeImages(rootEl){
    const imgs = Array.from(rootEl.querySelectorAll("img"));
    const tasks = imgs.map(img => {
      if (!img.complete) {
        return new Promise(res => {
          img.addEventListener("load", () => res(), { once: true });
          img.addEventListener("error", () => res(), { once: true });
        });
      }
      if (img.decode) return img.decode().catch(() => {});
      return Promise.resolve();
    });
    await Promise.all(tasks);
  }

  // ================== LIGHTBOX (Models) ==================
  function ensureLightbox(){
    let lb = $("#lb");
    if (lb) return lb;

    lb = document.createElement("div");
    lb.id = "lb";
    lb.className = "lb";
    lb.setAttribute("aria-hidden", "true");

    lb.innerHTML = `
      <div class="lb__backdrop" data-lb-close="1"></div>
      <div class="lb__panel" role="dialog" aria-modal="true" aria-label="Image preview">
        <button class="lb__close" type="button" aria-label="Close" data-lb-close="1">✕</button>
        <img class="lb__img" id="lbImg" alt="Preview" />
      </div>
    `;

    document.body.appendChild(lb);

    const close = () => {
      lb.classList.remove("is-open");
      lb.setAttribute("aria-hidden","true");
      document.body.classList.remove("menu-open"); // keep same lock style if you prefer
      document.body.style.overflow = "";
    };

    lb.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.closest && t.closest("[data-lb-close]")) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lb.classList.contains("is-open")) close();
    });

    lb._close = close;
    return lb;
  }

  function openLightbox(src, alt){
    const lb = ensureLightbox();
    const img = $("#lbImg");
    if (img) {
      img.src = src || "";
      img.alt = alt || "Preview";
    }
    lb.classList.add("is-open");
    lb.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";
  }

  function wireSlidesForLightbox(track){
    if (!track) return;

    // Delegate click
    track.addEventListener("click", (e) => {
      const slide = e.target.closest(".slide");
      if (!slide) return;
      const img = slide.querySelector("img");
      if (!img) return;

      openLightbox(img.currentSrc || img.src, img.alt || "Preview");
    });
  }

  // ============ Continuous Models Marquee (RTL SAFE + NO JITTER) ============
  function initModelsMarquee(items) {
    const track = $("#cartrack");
    if (!track) return;

    // cleanup previous raf/listeners
    if (track._rafId) { cancelAnimationFrame(track._rafId); track._rafId = null; }
    if (track._onResize) { window.removeEventListener("resize", track._onResize); track._onResize = null; }
    if (track._onVis) { document.removeEventListener("visibilitychange", track._onVis); track._onVis = null; }
    if (track._onEnter) { track.removeEventListener("mouseenter", track._onEnter); track._onEnter = null; }
    if (track._onLeave) { track.removeEventListener("mouseleave", track._onLeave); track._onLeave = null; }
    if (track._onTouchStart) { track.removeEventListener("touchstart", track._onTouchStart); track._onTouchStart = null; }
    if (track._onTouchEnd) { track.removeEventListener("touchend", track._onTouchEnd); track._onTouchEnd = null; }

    track.innerHTML = "";

    const wrap = track.parentElement;
    if (!wrap) return;

    // Force stable direction (avoid RTL flip issues)
    wrap.style.direction = "ltr";
    track.style.direction = "ltr";
    wrap.style.overflow = "hidden";

    const buildOneSet = () => {
      const frag = document.createDocumentFragment();

      items.forEach((it, idx) => {
        const slide = document.createElement("div");
        slide.className = "slide";

        const img = document.createElement("img");
        img.src = it.img;
        img.alt = it.caption || `model ${idx + 1}`;

        const cap = document.createElement("div");
        cap.className = "caption";
        cap.textContent = it.caption || "";

        slide.appendChild(img);
        slide.appendChild(cap);
        frag.appendChild(slide);
      });

      return frag;
    };

    let singleSetWidth = 0;

    const rebuild = async () => {
      track.innerHTML = "";
      track.style.transform = "translate3d(0,0,0)";
      singleSetWidth = 0;

      if (!items || !items.length) return;

      const set1 = document.createElement("div");
      set1.style.display = "flex";
      set1.style.gap = "14px";
      set1.appendChild(buildOneSet());
      track.appendChild(set1);

      // Wait for layout + images decode
      await nextFrame();
      await decodeImages(track);
      await nextFrame();

      // ✅ Use precise width (avoid ceil wobble)
      const w = set1.getBoundingClientRect().width;
      singleSetWidth = w > 0 ? w : 0;

      const set2 = set1.cloneNode(true);
      track.appendChild(set2);

      await nextFrame();

      // ✅ re-wire lightbox after rebuild
      if (!track._lbWired) {
        wireSlidesForLightbox(track);
        track._lbWired = true;
      }
    };

    let x = 0;
    let last = performance.now();

    const SPEED = matchMedia("(max-width: 560px)").matches ? 85 : 120;
    const DIR = -1;

    let paused = false;

    function tick(now){
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!singleSetWidth || singleSetWidth <= 1) {
        track._rafId = requestAnimationFrame(tick);
        return;
      }

      if (!paused) {
        x += SPEED * dt;

        // wrap
        if (x >= singleSetWidth) x -= singleSetWidth;

        // ✅ translate3d for stability
        track.style.transform = `translate3d(${DIR * x}px,0,0)`;
      }

      track._rafId = requestAnimationFrame(tick);
    }

    (async () => {
      await rebuild();
      x = 0;
      last = performance.now();
      track._rafId = requestAnimationFrame(tick);
    })();

    track._onEnter = () => { paused = true; };
    track._onLeave = () => { paused = false; last = performance.now(); };
    track.addEventListener("mouseenter", track._onEnter);
    track.addEventListener("mouseleave", track._onLeave);

    track._onTouchStart = () => { paused = true; };
    track._onTouchEnd = () => { paused = false; last = performance.now(); };
    track.addEventListener("touchstart", track._onTouchStart, { passive: true });
    track.addEventListener("touchend", track._onTouchEnd, { passive: true });

    // ✅ Debounced resize (prevents repeated rebuild jitter)
    let resizeT = null;
    track._onResize = () => {
      if (resizeT) clearTimeout(resizeT);
      resizeT = setTimeout(async () => {
        x = 0;
        last = performance.now();
        await rebuild();
      }, 180);
    };
    window.addEventListener("resize", track._onResize);

    track._onVis = () => {
      if (document.hidden && track._rafId) {
        cancelAnimationFrame(track._rafId);
        track._rafId = null;
      }
      if (!document.hidden && !track._rafId) {
        last = performance.now();
        track._rafId = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", track._onVis);
  }

  // FAQ
  function initFAQ(faq) {
    const wrap = $("#faqList");
    if (!wrap) return;
    wrap.innerHTML = "";

    faq.forEach((item) => {
      const box = document.createElement("div");
      box.className = "faqItem";

      const q = document.createElement("button");
      q.className = "faqQ";
      q.type = "button";
      q.innerHTML = `<span>${item.q}</span><span class="faqIcon">+</span>`;

      const a = document.createElement("div");
      a.className = "faqA";
      a.textContent = item.a;

      q.addEventListener("click", () => {
        box.classList.toggle("is-open");
        const icon = q.querySelector(".faqIcon");
        if (icon) icon.textContent = box.classList.contains("is-open") ? "−" : "+";
      });

      box.appendChild(q);
      box.appendChild(a);
      wrap.appendChild(box);
    });
  }

  function normalizeUrl(u){
    if (!u) return "";
    return String(u).trim();
  }

  function setLinks(cfg) {
    const wa = normalizeUrl(cfg?.links?.whatsapp) || "https://wa.me/201271028216";
    ["#waTop", "#waFooter", "#waNav", "#waHero", "#waReport", "#waCta", "#waFinal", "#waFooterCta"].forEach(id => {
      const el = $(id);
      if (el) el.setAttribute("href", wa);
    });

    const fb = normalizeUrl(cfg?.links?.facebook) || "https://www.facebook.com/";
    ["#fbTop", "#fbFooter"].forEach(id => {
      const el = $(id);
      if (el) el.setAttribute("href", fb);
    });

    const email = normalizeUrl(cfg?.links?.email) || "";
    ["#emailTop", "#emailFooter"].forEach(id => {
      const el = $(id);
      if (!el) return;

      if (!email) {
        el.style.display = "none";
        return;
      }

      el.style.display = "";
      el.setAttribute("href", `mailto:${email}`);
      el.textContent = email;
    });

    const form = normalizeUrl(cfg?.links?.requestForm) || "https://forms.gle/GsTXZGXXrcypanPd7";
    ["#ctaHero", "#ctaProblem", "#ctaFooter"].forEach(id => {
      const el = $(id);
      if (el) el.setAttribute("href", form);
    });

    // ================== ✅ UPDATED (STRICT): Sample report download from WEBSITE ==================
    // This prevents site.json from overriding your local PDF download link,
    // and ensures the button triggers a direct download (not a new tab).
    const rep = $("#ctaReport");
    if (rep) {
      const report = normalizeUrl(cfg?.links?.reportPdf) || "/assets/files/sample-report.pdf";

      rep.setAttribute("href", report);

      // Force direct download behavior
      rep.setAttribute("download", "");

      // Avoid opening in new tab for downloads (especially inside Facebook in-app browser)
      rep.removeAttribute("target");
      rep.removeAttribute("rel");
    }
  }

  // i18n injection
  function applyI18n(cfg, lang){
    const t = cfg?.i18n?.[lang];
    if (!t) return;

    const panel = $("#hmenuPanel");
    if (panel) {
      const aProblem = panel.querySelector('a[href="#problem"]');
      const aWhy     = panel.querySelector('a[href="#why"]');
      const aModels  = panel.querySelector('a[href="#models"]');
      const aFaq     = panel.querySelector('a[href="#faq"]');

      if (aProblem && t.nav_problem) aProblem.textContent = t.nav_problem;
      if (aWhy && t.nav_why)         aWhy.textContent = t.nav_why;
      if (aModels && t.nav_models)   aModels.textContent = t.nav_models;
      if (aFaq && t.nav_faq)         aFaq.textContent = t.nav_faq;
    }

    const heroTitle = $(".hero__title");
    const heroSub   = $(".hero__subtitle");
    if (heroTitle && t.hero_title) heroTitle.textContent = t.hero_title;
    if (heroSub && t.hero_subtitle) heroSub.textContent = t.hero_subtitle;

    const ctaHero = $("#ctaHero");
    const ctaFooter = $("#ctaFooter");
    const ctaReport = $("#ctaReport");
    if (ctaHero && t.cta_request) ctaHero.textContent = t.cta_request;
    if (ctaFooter && t.cta_request) ctaFooter.textContent = t.cta_request;
    if (ctaReport && t.cta_sample) ctaReport.textContent = t.cta_sample;

    const hProblem = $('#problem .h2');
    const hWhy     = $('#why .h2');
    const hModels  = $('#models .h2');
    const hFaq     = $('#faq .h2');

    if (hProblem && t.problem_title) hProblem.textContent = t.problem_title;
    if (hWhy && t.why_title)         hWhy.textContent = t.why_title;
    if (hModels && t.models_title)   hModels.textContent = t.models_title;
    if (hFaq && t.faq_title)         hFaq.textContent = t.faq_title;

    const note = $("#footerNote");
    if (note && t.footer_note) note.textContent = t.footer_note;
  }

  function renderSections(cfg, lang) {
    applyI18n(cfg, lang);

    const heroBg = $("#heroBg");
    if (heroBg && cfg?.images?.heroBg) {
      heroBg.style.backgroundImage = `url("${cfg.images.heroBg}")`;
    }

    const problemImg = $("#problemImg");
    if (problemImg && cfg?.images?.problem) {
      problemImg.src = cfg.images.problem;
      problemImg.alt = (lang === "en")
        ? "Why is finding the right apartment in Madinaty hard?"
        : "لماذا صعب العثور على الشقة المناسبة في مدينتي؟";
    }

    const problemBox = $("#problemBullets");
    if (problemBox) {
      problemBox.innerHTML = "";
      (cfg?.content?.[lang]?.problemBullets || []).forEach(t => {
        const li = document.createElement("li");
        li.textContent = t;
        problemBox.appendChild(li);
      });
    }

    const whyImg = $("#whyImg");
    if (whyImg && cfg?.images?.why) {
      whyImg.src = cfg.images.why;
      whyImg.alt = (lang === "en") ? "Why Nest Match?" : "لماذا Nest Match؟";
    }

    const whyBox = $("#whyBullets");
    if (whyBox) {
      whyBox.innerHTML = "";
      (cfg?.content?.[lang]?.whyBullets || []).forEach(t => {
        const li = document.createElement("li");
        li.textContent = t;
        whyBox.appendChild(li);
      });
    }

    initModelsMarquee(cfg?.models?.items || []);
    initFAQ(cfg?.content?.[lang]?.faq || []);

    const copy = $("#footerCopy");
    if (copy) {
      const year = new Date().getFullYear();
      copy.textContent = `© ${year} Nest Match. All rights reserved.`;
    }

    fixYaDots(document.body);
  }

  function detectLang(){
    const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (htmlLang.startsWith("en")) return "en";
    return "ar";
  }

  function boot(cfg){
    observeYaFix(document.body);

    setLinks(cfg);
    initTopLinks();
    initHeaderMenu();

    const lang = detectLang();
    renderSections(cfg, lang);

    window.addEventListener("load", () => fixYaDots(document.body), { once: true });
  }

  loadConfig()
    .then(cfg => boot(cfg))
    .catch(err => {
      console.error(err);
      const hero = document.querySelector(".hero__subtitle");
      if (hero) hero.textContent = "حدث خطأ في تحميل الإعدادات (site.json). تأكد من وجود الملف في config/site.json.";
      observeYaFix(document.body);
      fixYaDots(document.body);
    });
})();
