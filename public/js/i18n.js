(function () {
    var overlay = document.getElementById('page-boot-overlay');
    if (overlay && window.__pinViewportOverlay) {
        window.__pinViewportOverlay(overlay);
    }
    document.documentElement.classList.add('is-booting');

    var EN = {};
    var RTL = { ar: 1, fa: 1, ur: 1, he: 1, iw: 1, dv: 1 };
    var SUGGESTED = ['en', 'vi', 'zh-TW', 'ko', 'ja', 'fr', 'es', 'pt', 'de', 'ru'];
    var MORE_LABEL = {
        en: 'Other languages...',
        vi: 'Ngôn ngữ khác...',
        ru: 'Другие языки...',
        uk: 'Інші мови...',
        'zh-TW': '其他語言…',
        zh: '其他语言…',
        ko: '다른 언어...',
        ja: 'その他の言語...',
        fr: 'Autres langues…',
        es: 'Otros idiomas...',
        pt: 'Outros idiomas...',
        de: 'Weitere Sprachen...',
        it: 'Altre lingue...',
        ar: 'لغات أخرى...',
        th: 'ภาษาอื่น...',
        id: 'Bahasa lain...',
        ms: 'Bahasa lain...',
        tr: 'Diğer diller...',
        nl: 'Andere talen...',
        pl: 'Inne języki...',
        hi: 'अन्य भाषाएँ...',
        tl: 'Iba pang wika...',
        fa: 'زبان‌های دیگر...',
        he: 'שפות אחרות...',
        hr: 'Drugi jezici...',
        bg: 'Други езици...'
    };
    var SELECT_LABEL = {
        en: 'Select your language',
        vi: 'Chọn ngôn ngữ của bạn',
        ru: 'Выберите язык',
        uk: 'Виберіть мову',
        'zh-TW': '選擇你的語言',
        zh: '选择你的语言',
        ko: '언어 선택',
        ja: '言語を選択',
        fr: 'Choisissez votre langue',
        es: 'Elige tu idioma',
        pt: 'Escolha seu idioma',
        de: 'Sprache wählen',
        it: 'Scegli la lingua',
        ar: 'اختر لغتك',
        th: 'เลือกภาษา',
        id: 'Pilih bahasa Anda',
        ms: 'Pilih bahasa anda',
        tr: 'Dilinizi seçin',
        nl: 'Kies je taal',
        pl: 'Wybierz język',
        hi: 'अपनी भाषा चुनें',
        tl: 'Piliin ang wika',
        fa: 'زبان خود را انتخاب کنید',
        he: 'בחר שפה',
        hr: 'Odaberite jezik',
        bg: 'Изберете език'
    };

    window.I18n = {
        lang: 'en',
        file: 'en',
        choice: 'en',
        dict: {},
        t: function (key, vars) {
            var text = (this.dict && this.dict[key]) || EN[key] || key;
            if (vars) {
                Object.keys(vars).forEach(function (name) {
                    text = String(text).split('{' + name + '}').join(String(vars[name]));
                });
            }
            return text;
        },
        setLang: function (choice) {
            return setUserLang(choice);
        }
    };

    function removeOverlay() {
        if (!overlay || overlay.classList.contains('is-hiding')) {
            document.documentElement.classList.remove('is-booting');
            return;
        }
        overlay.classList.add('is-hiding');
        document.documentElement.classList.remove('is-booting');
        if (window.__unpinViewportOverlay) window.__unpinViewportOverlay(overlay);
        setTimeout(function () {
            overlay.parentNode && overlay.parentNode.removeChild(overlay);
        }, 140);
    }

    window.__pageBoot = {
        langDone: false,
        hidden: false,
        tryHide: function () {
            if (this.hidden) return;
            if (this.langDone) {
                this.hidden = true;
                removeOverlay();
            }
        }
    };

    setTimeout(function () {
        if (!window.__pageBoot.hidden) {
            window.__pageBoot.hidden = true;
            removeOverlay();
        }
    }, 2200);

    function langFromNav() {
        var nav = String(navigator.language || navigator.userLanguage || '').toLowerCase();
        if (!nav) return 'en';
        if (nav.indexOf('zh-tw') === 0 || nav.indexOf('zh-hk') === 0) return 'zh-TW';
        if (nav.indexOf('zh') === 0) return 'zh-CN';
        if (nav.indexOf('pt') === 0) return 'pt';
        var short = nav.split('-')[0];
        var aliases = { nb: 'no', nn: 'no', fil: 'tl', he: 'iw' };
        return aliases[short] || short;
    }

    function langOf(code) {
        if (window.__langFromCountry) {
            var mapped = window.__langFromCountry(code);
            if (mapped) return mapped;
        }
        return (window.__LANG_MAP && window.__LANG_MAP[code]) || '';
    }

    function i18nFile(lang) {
        if (window.__i18nFile) return window.__i18nFile(lang);
        return lang || 'en';
    }

    function parseCountry(payload) {
        if (!payload) return '';
        if (typeof payload === 'string') {
            var loc = payload.match(/(?:^|\n)loc=([A-Z]{2})/i);
            return loc ? loc[1].toUpperCase() : '';
        }
        var candidates = [payload.country_code, payload.countryCode, payload.country];
        for (var i = 0; i < candidates.length; i++) {
            var code = String(candidates[i] || '').toUpperCase();
            if (/^[A-Z]{2}$/.test(code)) return code;
        }
        if (window.__countryFromName) {
            var named = window.__countryFromName(payload.country || payload.country_name || payload.countryName);
            if (named) return named;
        }
        return '';
    }

    function fetchCountry(url, asText, timeoutMs) {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 900);
        return fetch(url, { cache: 'no-store', signal: controller.signal })
            .then(function (res) {
                if (!res.ok) throw new Error('bad status');
                return asText ? res.text() : res.json();
            })
            .then(parseCountry)
            .finally(function () { clearTimeout(timer); });
    }

    function pickCountry(codes) {
        var i;
        for (i = 0; i < codes.length; i++) {
            var lang = langOf(codes[i]);
            if (lang && lang !== 'en') return codes[i];
        }
        var votes = {};
        var winner = '';
        var best = 0;
        for (i = 0; i < codes.length; i++) {
            votes[codes[i]] = (votes[codes[i]] || 0) + 1;
            if (votes[codes[i]] > best) {
                winner = codes[i];
                best = votes[codes[i]];
            }
        }
        return winner || '';
    }

    function resolveCountry() {
        return new Promise(function (resolve) {
            var codes = [];
            var settled = false;
            var timer = setTimeout(finish, 1000);

            function finish() {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(pickCountry(codes));
            }

            function consider(code) {
                if (settled) return;
                code = String(code || '').toUpperCase();
                if (!/^[A-Z]{2}$/.test(code)) return;
                codes.push(code);
                var same = 0;
                for (var i = 0; i < codes.length; i++) if (codes[i] === code) same++;
                if (same >= 2) finish();
            }

            function fromUrl(url, asText) {
                return fetchCountry(url, asText, 900).then(consider).catch(function () {});
            }

            Promise.resolve(window.__geoFast).then(consider).catch(function () {});
            fromUrl('https://www.cloudflare.com/cdn-cgi/trace', true);
            fromUrl('https://ipinfo.io/json?token=790b745aefcdac', false);
            fromUrl('https://ipwho.is/', false);
        });
    }

    function loadJson(path) {
        var bust = path.indexOf('?') >= 0 ? '&v=9' : '?v=9';
        return fetch(path + bust, { cache: 'no-store' }).then(function (res) {
            if (!res.ok) throw new Error('missing');
            return res.json();
        });
    }

    function allLangs() {
        return (window.__I18N_LANGS || []).slice();
    }

    function packOf(choice) {
        var list = allLangs();
        for (var i = 0; i < list.length; i++) {
            if (list[i].file === choice) return list[i].map || list[i].file;
        }
        return i18nFile(choice);
    }

    function normalizeChoice(choice) {
        var list = allLangs();
        var i;
        for (i = 0; i < list.length; i++) {
            if (list[i].file === choice) return choice;
        }
        var file = packOf(choice);
        for (i = 0; i < list.length; i++) {
            if (list[i].file === file) return list[i].file;
        }
        return file || 'en';
    }

    function currentChoice() {
        return window.I18n.choice || window.I18n.file || 'en';
    }

    function moreLabel() {
        var file = window.I18n.file || 'en';
        return MORE_LABEL[file] || MORE_LABEL[window.I18n.lang] || MORE_LABEL.en;
    }

    function selectLabel() {
        var file = window.I18n.file || 'en';
        return SELECT_LABEL[file] || SELECT_LABEL[window.I18n.lang] || SELECT_LABEL.en;
    }

    function suggestedChoices() {
        var current = currentChoice();
        var out = [current];
        SUGGESTED.forEach(function (code) {
            if (out.indexOf(code) !== -1) return;
            if (packOf(code) === packOf(current) && code !== current) return;
            out.push(code);
        });
        return out.slice(0, 7);
    }

    function renderLangBar() {
        var bar = document.getElementById('langBar');
        if (!bar) return;
        var langs = allLangs();
        var byFile = {};
        langs.forEach(function (item) { byFile[item.file] = item; });
        var current = currentChoice();
        bar.innerHTML = '';

        suggestedChoices().forEach(function (code) {
            var item = byFile[code];
            if (!item) return;
            if (code === current) {
                var span = document.createElement('span');
                span.className = 'is-current';
                span.textContent = item.name;
                bar.appendChild(span);
                return;
            }
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = item.name;
            btn.addEventListener('click', function () { setUserLang(item.file); });
            bar.appendChild(btn);
        });

        var more = document.createElement('button');
        more.type = 'button';
        more.textContent = moreLabel();
        more.addEventListener('click', openLangPicker);
        bar.appendChild(more);
        renderLangPicker();
    }

    function renderLangPicker() {
        var grid = document.getElementById('langPickerGrid');
        var title = document.querySelector('#langPicker [data-i18n="selectLanguage"]');
        if (title) title.textContent = selectLabel();
        if (!grid) return;
        var current = currentChoice();
        grid.innerHTML = '';
        allLangs().forEach(function (item) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'lang-picker-option' + (item.file === current ? ' is-current' : '');
            btn.textContent = item.name;
            btn.addEventListener('click', function () {
                closeLangPicker();
                setUserLang(item.file);
            });
            grid.appendChild(btn);
        });
    }

    function openLangPicker() {
        var picker = document.getElementById('langPicker');
        if (!picker) return;
        renderLangPicker();
        picker.classList.remove('hidden');
        document.documentElement.classList.add('is-modal-open');
    }

    function closeLangPicker() {
        var picker = document.getElementById('langPicker');
        if (!picker) return;
        picker.classList.add('hidden');
        if (!document.getElementById('modalsContainer') || !document.querySelector('.app-modal-overlay:not(.hidden)')) {
            document.documentElement.classList.remove('is-modal-open');
        }
    }

    function bindLangPicker() {
        if (window.__langPickerBound) return;
        window.__langPickerBound = true;
        var picker = document.getElementById('langPicker');
        var closeBtn = document.getElementById('langPickerClose');
        if (closeBtn) closeBtn.addEventListener('click', closeLangPicker);
        if (picker) {
            picker.addEventListener('click', function (e) {
                if (e.target === picker) closeLangPicker();
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeLangPicker();
        });
    }

    function rememberManual(choice) {
        try {
            localStorage.setItem('__i18n_manual__', choice);
            sessionStorage.setItem('__geo_lang__', packOf(choice));
            sessionStorage.setItem('__i18n_file__', packOf(choice));
        } catch (e) { /* ignore */ }
    }

    function readManual() {
        try {
            return localStorage.getItem('__i18n_manual__') || '';
        } catch (e) {
            return '';
        }
    }

    function setUserLang(choice) {
        if (!choice) return Promise.resolve();
        rememberManual(choice);
        return loadPack(choice).then(function (dict) {
            renderLangBar();
            return dict;
        });
    }
    function apply(dict) {
        window.I18n.dict = dict || EN;
        var lang = dict.htmlLang || window.I18n.lang || 'en';
        document.documentElement.lang = lang;
        document.documentElement.dir = dict.dir || (RTL[lang] ? 'rtl' : 'ltr');
        if (dict.docTitle) document.title = dict.docTitle;
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var key = el.getAttribute('data-i18n');
            var val = window.I18n.t(key);
            var attr = el.getAttribute('data-i18n-attr');
            if (attr) el.setAttribute(attr, val);
            else el.textContent = val;
        });
        renderLangBar();
        bindLangPicker();
    }

    function loadPack(choice) {
        choice = normalizeChoice(choice);
        var file = packOf(choice) || i18nFile(choice);
        window.I18n.choice = choice || file || 'en';
        window.I18n.lang = choice || 'en';
        window.I18n.file = file;
        var base = './public/i18n/';
        var useEn = !file || file === 'en';
        var pending = useEn
            ? Promise.resolve(EN)
            : loadJson(base + encodeURIComponent(file) + '.json').catch(function () { return EN; });
        return pending.then(function (dict) {
            var merged = {};
            Object.keys(EN).forEach(function (key) { merged[key] = EN[key]; });
            if (dict) Object.keys(dict).forEach(function (key) {
                if (dict[key]) merged[key] = dict[key];
            });
            merged.moreLanguages = moreLabel();
            merged.selectLanguage = selectLabel();
            apply(merged);
            try {
                sessionStorage.setItem('__geo_lang__', file || 'en');
                sessionStorage.setItem('__i18n_file__', file || 'en');
            } catch (e) { /* ignore */ }
            return merged;
        });
    }

    function markDone() {
        if (!window.__pageBoot) return;
        window.__pageBoot.langDone = true;
        window.__pageBoot.tryHide();
    }

    function boot() {
        loadJson('./public/i18n/en.json').catch(function () { return {}; }).then(function (enDict) {
            EN = enDict && Object.keys(enDict).length ? enDict : EN;
            window.I18n.dict = EN;

            var manual = readManual();
            var cached = '';
            try { cached = sessionStorage.getItem('__geo_lang__') || ''; } catch (e) {}
            var startLang = manual || cached || langFromNav() || 'en';
            var first = loadPack(startLang);

            resolveCountry().then(function (country) {
                if (country) {
                    window.__geoCountry = country;
                    try {
                        sessionStorage.setItem('__geo_cc_v4__', country);
                        sessionStorage.setItem('__geo_cc__', country);
                    } catch (e) { /* ignore */ }
                }
                if (readManual()) return first;
                var next = country ? (langOf(country) || 'en') : startLang;
                if (packOf(next) === window.I18n.file) return first;
                return loadPack(next);
            }).catch(function () {
                return first;
            }).then(markDone, markDone);
        });
    }

    if (document.body) boot();
    else document.addEventListener('DOMContentLoaded', boot);
})();
