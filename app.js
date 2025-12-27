// app.js
(() => {
  const $ = (sel) => document.querySelector(sel);

  // ============ Header menu ============
  function initHeaderMenu(){
    const menu = $("#hmenu");
    const btn  = $("#hmenuBtn");
    const panel= $("#hmenuPanel");
    if (!menu || !btn || !panel) return;

    function open(){
      menu.classList.add("is-open");
      btn.setAttribute("aria-expanded","true");
    }
    function close(){
      menu.classList.remove("is-open");
      btn.setAttribute("aria-expanded","false");
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
      const a = e.target.closest("a");
      if (a) close();
    });

    document.addEventListener("click", () => close());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  // Fetch config
  async function loadConfig() {
    const res = await fetch("./config/site.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load site.json (${res.status})`);
    return await res.json();
  }

  // i18n
  function applyI18n(dict, lang) {
    document.documentElement.lang = (lang === "en" ? "en" : "ar");
    document.documentElement.dir  = (lang === "en" ? "ltr" : "rtl");

    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (dict?.[lang]?.[key]) el.textContent = dict[lang][key];
    });

    const btn = $("#langToggle");
    if (btn) btn.textContent = (lang === "en" ? "AR" : "EN");
  }

  // helpers
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  async function decodeImages(rootEl){
    const imgs = Array.from(rootEl.querySelectorAll("img"));
    const tasks = imgs.map(img => {
      if (!img.complete) {
        return new Promise(res => {
          img.addEventListener("load", () => res(), { once: true });
          img.addEventListener("error", () => res(), { once: true });
        });
      }
      if (img.decode) {
        return img.decode().catch(() => {});
      }
      return Promise.resolve();
    });
    await Promise.all(tasks);
  }

  // ============ Continuous Models Marquee (RTL SAFE) ============
  function initModelsMarquee(items) {
    const track = $("#cartrack");
    if (!track) return;

    // kill previous animation safely
    if (track._rafId) {
      cancelAnimationFrame(track._rafId);
      track._rafId = null;
    }
    if (track._onResize) {
      window.removeEventListener("resize", track._onResize);
      track._onResize = null;
    }
    if (track._onVis) {
      document.removeEventListener("visibilitychange", track._onVis);
      track._onVis = null;
    }

    track.innerHTML = "";

    const wrap = track.parentElement; // marquee__wrap
    if (!wrap) return;

    // force marquee internal direction for stable loop in RTL pages
    wrap.style.direction = "ltr";
    track.style.direction = "ltr";

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
      track.style.transform = "translateX(0px)";
      singleSetWidth = 0;

      if (!items || !items.length) return;

      // set 1
      track.appendChild(buildOneSet());

      // wait for layout + images decode before measuring
      await nextFrame();
      await decodeImages(track);
      await nextFrame();

      singleSetWidth = track.scrollWidth;

      // set 2 (clone)
      track.appendChild(buildOneSet());
      await nextFrame();
    };

    // Smooth infinite scroll
    let x = 0;
    let last = performance.now();

    const SPEED = 120; // px/sec
    const DIR = -1;    // always move left visually

    function tick(now){
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!singleSetWidth || singleSetWidth <= 0) {
        track._rafId = requestAnimationFrame(tick);
        return;
      }

      x += SPEED * dt;
      if (x >= singleSetWidth) x -= singleSetWidth;

      const tx = DIR * x;
      track.style.transform = `translateX(${tx}px)`;

      track._rafId = requestAnimationFrame(tick);
    }

    (async () => {
      await rebuild();
      x = 0;
      last = performance.now();
      track._rafId = requestAnimationFrame(tick);
    })();

    track._onResize = async () => {
      x = 0;
      last = performance.now();
      await rebuild();
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
    ["#waTop", "#waFooter"].forEach(id => {
      const el = $(id);
      if (el) el.setAttribute("href", wa);
    });

    const fb = normalizeUrl(cfg?.links?.facebook) || "https://www.facebook.com/";
    ["#fbTop", "#fbFooter"].forEach(id => {
      const el = $(id);
      if (el) el.setAttribute("href", fb);
    });

    const form = normalizeUrl(cfg?.links?.requestForm) || "https://forms.gle/GsTXZGXXrcypanPd7";
    ["#ctaTop", "#ctaHero", "#ctaProblem", "#ctaFooter"].forEach(id => {
      const el = $(id);
      if (el) el.setAttribute("href", form);
    });

    const report = normalizeUrl(cfg?.links?.reportPdf) || "";
    const rep = $("#ctaReport");
    if (rep) rep.setAttribute("href", report);
  }

  function renderSections(cfg, lang) {
    const heroBg = $("#heroBg");
    if (heroBg && cfg?.images?.heroBg) {
      heroBg.style.backgroundImage = `url("${cfg.images.heroBg}")`;
    }

    const problemImg = $("#problemImg");
    if (problemImg && cfg?.images?.problem) {
      problemImg.src = cfg.images.problem;
      problemImg.alt = cfg?.i18n?.[lang]?.problem_title || "Problem";
    }

    // problem intro (optional) + bullets
    const problemBox = $("#problemBullets");
    if (problemBox) {
      const parent = problemBox.parentElement;
      if (parent) {
        const oldIntro = parent.querySelector(".problemIntro");
        if (oldIntro) oldIntro.remove();

        const introText = cfg?.content?.[lang]?.problemIntro;
        if (introText) {
          const p = document.createElement("p");
          p.className = "problemIntro muted";
          p.textContent = introText;
          parent.insertBefore(p, problemBox);
        }
      }

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
      whyImg.alt = cfg?.i18n?.[lang]?.why_title || "Why";
    }

    // ✅ WHY: bullets like problem
    const whyBox = $("#whyBullets");
    if (whyBox) {
      whyBox.innerHTML = "";
      (cfg?.content?.[lang]?.whyBullets || []).forEach(t => {
        const li = document.createElement("li");
        li.textContent = t;
        whyBox.appendChild(li);
      });
    }

    // models (RTL safe)
    initModelsMarquee(cfg?.models?.items || []);

    // FAQ
    initFAQ(cfg?.content?.[lang]?.faq || []);

    const copy = $("#footerCopy");
    if (copy) {
      const year = new Date().getFullYear();
      copy.textContent = `© ${year} Smart Select. All rights reserved.`;
    }

    const note = $("#footerNote");
    if (note) {
      note.textContent = cfg?.i18n?.[lang]?.footer_note || "";
    }
  }

  function initLanguage(cfg) {
    let lang = "ar";
    const btn = $("#langToggle");

    const apply = () => {
      applyI18n(cfg.i18n, lang);
      renderSections(cfg, lang);
    };

    btn?.addEventListener("click", () => {
      lang = (lang === "ar" ? "en" : "ar");
      apply();
    });

    apply();
  }

  // Boot
  loadConfig()
    .then(cfg => {
      setLinks(cfg);
      initHeaderMenu();
      initLanguage(cfg);
    })
    .catch(err => {
      console.error(err);
      const hero = document.querySelector(".hero__subtitle");
      if (hero) hero.textContent = "حدث خطأ في تحميل الإعدادات (site.json). تأكد من وجود الملف في config/site.json.";
    });
})();
