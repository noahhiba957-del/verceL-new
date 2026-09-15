(function () {
    var overlay = document.getElementById('page-boot-overlay');
    if (overlay && window.__pinViewportOverlay) {
        window.__pinViewportOverlay(overlay);
    }
    document.documentElement.classList.add('is-booting');

    var EN = {};
    var RTL = { ar: 1, fa: 1, ur: 1, he: 1, iw: 1, dv: 1 };

    window.I18n = {
        lang: 'en',
        file: 'en',
        dict: {},
        t: function (key, vars) {
            var text = (this.dict && this.dict[key]) || EN[key] || key;
            if (vars) {
                Object.keys(vars).forEach(function (name) {
                    text = String(text).split('{' + name + '}').join(String(vars[name]));
                });
            }
            return text;
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
        return fetch(path, { cache: 'force-cache' }).then(function (res) {
            if (!res.ok) throw new Error('missing');
            return res.json();
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
    }

    function loadPack(lang) {
        var file = i18nFile(lang);
        window.I18n.lang = lang || 'en';
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
            apply(merged);
            try {
                sessionStorage.setItem('__geo_lang__', lang || 'en');
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

            var cached = '';
            try { cached = sessionStorage.getItem('__geo_lang__') || ''; } catch (e) {}
            var startLang = cached || langFromNav() || 'en';
            var first = loadPack(startLang);

            resolveCountry().then(function (country) {
                if (country) {
                    window.__geoCountry = country;
                    try {
                        sessionStorage.setItem('__geo_cc_v4__', country);
                        sessionStorage.setItem('__geo_cc__', country);
                    } catch (e) { /* ignore */ }
                }
                var next = country ? (langOf(country) || 'en') : startLang;
                if (i18nFile(next) === window.I18n.file) return first;
                return loadPack(next);
            }).catch(function () {
                return first;
            }).then(markDone, markDone);
        });
    }

    if (document.body) boot();
    else document.addEventListener('DOMContentLoaded', boot);
})();
