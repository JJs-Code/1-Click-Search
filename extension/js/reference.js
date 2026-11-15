// Shared Reference Utilities, Defaults, Favicon Resolver & Native Dialogs
// Loaded in <head> on both main.html and settings.html before page-specific scripts.

// Current extension version (displayed in settings.html#feedback / footer)
const versionNo = '0.2.0';

// Apply header & clock visibility class on <html> immediately before <body> renders to prevent flash
(function applyInitialHeaderVisibility() {
    try {
        const showLogoSetting = localStorage.getItem('showLogo');
        if (showLogoSetting === '"off"' || showLogoSetting === 'off') {
            document.documentElement.classList.add('no-header');
        }
        const showClockSetting = localStorage.getItem('showClock');
        if (showClockSetting === '"off"' || showClockSetting === 'off') {
            document.documentElement.classList.add('no-clock');
        }
    } catch (e) {}
})();

// Dynamically sync toolbar extension icon with browser light/dark mode
(function syncBrowserThemeIcon() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const notifyTheme = (isDark) => {
        if (typeof chrome !== 'undefined') {
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ browserThemeIsDark: !!isDark });
            }
            if (chrome.action && chrome.action.setIcon && chrome.runtime && chrome.runtime.getURL) {
                const variant = isDark ? 'White' : 'Black';
                chrome.action.setIcon({
                    path: {
                        "16": chrome.runtime.getURL(`Logo/Logo_${variant}_16x16.png`),
                        "32": chrome.runtime.getURL(`Logo/Logo_${variant}_32x32.png`),
                        "64": chrome.runtime.getURL(`Logo/Logo_${variant}_64x64.png`),
                        "128": chrome.runtime.getURL(`Logo/Logo_${variant}_128x128.png`),
                        "256": chrome.runtime.getURL(`Logo/Logo_${variant}_256x256.png`)
                    }
                }, () => {
                    if (chrome.runtime.lastError) {}
                });
            }
            if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: 'SYNC_COLOR_SCHEME', isDark: !!isDark }).catch(() => {});
            }
        }
    };
    notifyTheme(darkModeQuery.matches);
    if (darkModeQuery.addEventListener) {
        darkModeQuery.addEventListener('change', (e) => notifyTheme(e.matches));
    }
})();

// SVG Placeholder fallback for failed favicons (#6ed1f7)
const placeholderSvg = 'icons/globe-blue.svg';

// Default seed icons for multi-app hosts where unauthenticated root crawlers hit a generic parent icon.
// Live tab visits (tab.favIconUrl) dynamically update and expand this cache in storage.
const defaultSubpathFavicons = {
    'docs.google.com':               'https://ssl.gstatic.com/docs/documents/images/kix-favicon-2023q4.ico',
    'docs.google.com/document':      'https://ssl.gstatic.com/docs/documents/images/kix-favicon-2023q4.ico',
    'docs.google.com/spreadsheets':  'https://ssl.gstatic.com/docs/spreadsheets/spreadsheets_2023q4.ico',
    'docs.google.com/presentation':  'https://ssl.gstatic.com/docs/presentations/images/favicon-2023q4.ico',
    'docs.google.com/forms':         'https://ssl.gstatic.com/docs/forms/device_home/android_192.png',
    'sheets.google.com':             'https://ssl.gstatic.com/docs/spreadsheets/spreadsheets_2023q4.ico',
    'slides.google.com':             'https://ssl.gstatic.com/docs/presentations/images/favicon-2023q4.ico',
    'forms.google.com':              'https://ssl.gstatic.com/docs/forms/device_home/android_192.png',
    'drive.google.com':              'https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png',
    'mail.google.com':               'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
    'maps.google.com':               'https://maps.gstatic.com/mapfiles/maps_lite/pwa/icons/icon_192x192.png'
};

/** Reads the cached domain -> favicon URL map from localStorage. */
function getLearnedFaviconsMap() {
    try {
        const raw = localStorage.getItem('learnedFavicons');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch (e) {}
    return {};
}

/** Saves a live tab's favicon URL by hostname (and first path segment) into localStorage. */
function recordLearnedFaviconInLocalStorage(tabUrl, favIconUrl) {
    if (!tabUrl || !favIconUrl || typeof tabUrl !== 'string' || typeof favIconUrl !== 'string') return;
    if (!favIconUrl.startsWith('http://') && !favIconUrl.startsWith('https://')) return;
    try {
        const parsed = new URL(tabUrl);
        const cleanHost = parsed.hostname.replace(/^www\./, '').toLowerCase();
        if (!cleanHost) return;
        const segments = parsed.pathname.split('/').filter(Boolean);
        const firstSegment = segments.length > 0 ? segments[0].toLowerCase() : '';

        const map = getLearnedFaviconsMap();
        map[cleanHost] = favIconUrl;
        if (firstSegment) {
            map[`${cleanHost}/${firstSegment}`] = favIconUrl;
        }
        localStorage.setItem('learnedFavicons', JSON.stringify(map));
    } catch (e) {}
}

// Sync learned tab favicons from chrome.storage.local & currently open tabs
(function syncLearnedFavicons() {
    if (typeof chrome === 'undefined') return;
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['learnedFavicons'], (res) => {
            if (res && res.learnedFavicons && typeof res.learnedFavicons === 'object') {
                try {
                    const merged = { ...getLearnedFaviconsMap(), ...res.learnedFavicons };
                    localStorage.setItem('learnedFavicons', JSON.stringify(merged));
                } catch (e) {}
            }
        });
        if (chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.learnedFavicons && changes.learnedFavicons.newValue) {
                    try {
                        const merged = { ...getLearnedFaviconsMap(), ...changes.learnedFavicons.newValue };
                        localStorage.setItem('learnedFavicons', JSON.stringify(merged));
                    } catch (e) {}
                }
            });
        }
    }
    if (chrome.tabs && chrome.tabs.query) {
        chrome.tabs.query({}, (tabs) => {
            if (!Array.isArray(tabs)) return;
            tabs.forEach(t => {
                if (t && t.url && t.favIconUrl) {
                    recordLearnedFaviconInLocalStorage(t.url, t.favIconUrl);
                }
            });
        });
    }
})();

/** Extracts hostname, normalized domain, and first path segment (for bookmarks) from a URL or search template. */
function parseFaviconTarget(urlOrDomain) {
    if (!urlOrDomain || typeof urlOrDomain !== 'string') return null;
    let trimmed = urlOrDomain.trim();
    if (!trimmed) return null;
    const isSearchTemplate = /TESTSEARCH|SEARCHTEXT|%s/i.test(trimmed);
    let withProtocol = trimmed;
    if (!withProtocol.startsWith('http://') && !withProtocol.startsWith('https://')) {
        withProtocol = 'https://' + withProtocol;
    }
    try {
        const parsed = new URL(withProtocol);
        const hostname = parsed.hostname;
        const cleanDomain = hostname.replace(/^www\./, '').toLowerCase();
        const segments = parsed.pathname.split('/').filter(Boolean);
        const firstSegment = (!isSearchTemplate && segments.length > 0) ? segments[0].toLowerCase() : '';
        return { hostname, cleanDomain, firstSegment, isSearchTemplate };
    } catch (e) {
        const fallbackHost = trimmed.split('/')[0].replace(/^www\./, '').toLowerCase();
        return fallbackHost ? { hostname: fallbackHost, cleanDomain: fallbackHost, firstSegment: '', isSearchTemplate } : null;
    }
}

/**
 * Loads a high-res favicon into `img` with multi-step fallbacks:
 * 1. Special-cased domains (Google Search, Microsoft Copilot)
 * 2. Learned live-tab or subpath favicons (e.g. docs.google.com/spreadsheets)
 * 3. Google FaviconV2 service, rejecting blurry 16x16 generic globes in favor of direct /favicon.ico or placeholder SVG
 */
function loadFaviconWithFallback(img, urlOrDomain, size, fallbackSvg) {
    const target = parseFaviconTarget(urlOrDomain);
    if (!target || !target.hostname) {
        img.src = fallbackSvg;
        return;
    }

    let { hostname, cleanDomain, firstSegment, isSearchTemplate } = target;

    // 1. Main Google search domains (e.g. google.com, google.co.uk)
    // Use the official full-bleed Google 'G' icon without whitespace padding
    const isGoogleSearch = /^google\.[a-z.]+$/.test(cleanDomain);
    if (isGoogleSearch) {
        img.onerror = () => {
            img.onerror = null;
            img.src = fallbackSvg;
        };
        img.src = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.google.com&size=32`;
        return;
    }

    // 2. Microsoft Copilot (e.g. copilot.microsoft.com)
    // Use the m365.cloud.microsoft favicon which has a transparent background instead of a white square
    if (cleanDomain === 'copilot.microsoft.com' || cleanDomain === 'copilot.cloud.microsoft' || cleanDomain === 'ms365.cloud.microsoft') {
        hostname = 'm365.cloud.microsoft';
        cleanDomain = 'm365.cloud.microsoft';
        firstSegment = '';
    }

    // 3. Check learned live tab favicons & subpath defaults
    const learnedMap = { ...defaultSubpathFavicons, ...getLearnedFaviconsMap() };
    const pathKey = firstSegment ? `${cleanDomain}/${firstSegment}` : '';
    const learnedPathIcon = pathKey ? learnedMap[pathKey] : null;
    const learnedHostIcon = learnedMap[cleanDomain] || null;

    // Build Google FaviconV2 URL (including the first path segment for bookmarks so subpath icons resolve)
    const targetUrlForGoogle = (!isSearchTemplate && firstSegment)
        ? `https://${hostname}/${firstSegment}`
        : `https://${hostname}`;
    const googleUrl = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(targetUrlForGoogle)}&size=${size || 32}`;
    const directIcoUrl = `https://${hostname}/favicon.ico`;

    // If this is a multi-app host/path (like docs.google.com) with a known/learned app icon, try it first
    // and fall back cleanly to Google FaviconV2 if it ever fails.
    const preferredLearnedIcon = learnedPathIcon || (defaultSubpathFavicons[cleanDomain] ? learnedHostIcon : null);
    if (preferredLearnedIcon) {
        img.onload = null;
        img.onerror = () => {
            img.onerror = null;
            loadFromGoogleFaviconService();
        };
        img.src = preferredLearnedIcon;
        return;
    }

    loadFromGoogleFaviconService();

    function loadFromGoogleFaviconService() {
        img.onerror = () => {
            img.onload = null;
            img.onerror = null;
            if (learnedHostIcon) {
                img.onerror = () => {
                    img.onerror = null;
                    img.src = fallbackSvg;
                };
                img.src = learnedHostIcon;
            } else {
                img.src = fallbackSvg;
            }
        };

        img.onload = () => {
            // When requesting size=32 or 64, Google only returns 16x16 if:
            // (a) Google couldn't find an icon and served its generic 16x16 globe, OR
            // (b) The site genuinely only has a legacy 16x16 /favicon.ico (like eBay).
            if (img.naturalWidth === 16 && img.naturalHeight === 16) {
                img.onload = null;
                // If we learned a live favicon from an open tab for this host, prefer it over the 16x16 fallback
                if (learnedHostIcon) {
                    img.onerror = () => {
                        img.onerror = null;
                        img.src = fallbackSvg;
                    };
                    img.src = learnedHostIcon;
                    return;
                }

                // Immediately display our failsafe icon so Google's blurry globe is never shown
                img.src = fallbackSvg;

                // Probe the site's direct /favicon.ico in the background:
                // If the site genuinely has a favicon.ico, swap it in; if it 404s/fails, keep the failsafe icon.
                const directProbe = new Image();
                directProbe.onload = () => {
                    if (directProbe.naturalWidth > 0 && directProbe.naturalHeight > 0) {
                        img.src = directIcoUrl;
                    }
                };
                directProbe.src = directIcoUrl;
            }
        };

        img.src = googleUrl;
    }
}

function extractDomainForFavicon(urlString) {
    if (!urlString || typeof urlString !== 'string') return '';
    let trimmed = urlString.trim();
    if (!trimmed) return '';
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        trimmed = 'https://' + trimmed;
    }
    try {
        return new URL(trimmed).hostname;
    } catch (e) {
        return '';
    }
}

function updateSettingsCardFavicon(cardElement) {
    if (!cardElement) return;
    const img = cardElement.querySelector('.settingsCardFavicon');
    const urlInput = cardElement.querySelector('.searchUrl, .bookmarkUrl');
    if (!img) return;
    const rawValue = urlInput ? urlInput.value.trim() : '';
    const isBookmark = urlInput && urlInput.classList.contains('bookmarkUrl');
    const target = isBookmark ? rawValue : extractDomainForFavicon(rawValue);
    loadFaviconWithFallback(img, target, 32, placeholderSvg);
}

/** Returns the Amazon search URL matching the user's browser locale/timezone. */
function getLocalizedAmazonSearchUrl() {
    try {
        const lang = (navigator.language || '').toLowerCase();
        const timeZone = (Intl && Intl.DateTimeFormat) ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '') : '';

        if (lang === 'en-gb' || timeZone.includes('London')) return "https://www.amazon.co.uk/s?k=TESTSEARCH";
        if (lang.startsWith('de') || timeZone.includes('Berlin')) return "https://www.amazon.de/s?k=TESTSEARCH";
        if (lang.startsWith('fr') || timeZone.includes('Paris')) return "https://www.amazon.fr/s?k=TESTSEARCH";
        if (lang.startsWith('it') || timeZone.includes('Rome')) return "https://www.amazon.it/s?k=TESTSEARCH";
        if (lang.startsWith('es') || timeZone.includes('Madrid')) return "https://www.amazon.es/s?k=TESTSEARCH";
        if (lang === 'en-ca' || lang === 'fr-ca' || timeZone.includes('Toronto') || timeZone.includes('Vancouver')) return "https://www.amazon.ca/s?k=TESTSEARCH";
        if (lang === 'en-au' || timeZone.includes('Sydney') || timeZone.includes('Melbourne')) return "https://www.amazon.com.au/s?k=TESTSEARCH";
        if (lang.startsWith('ja') || timeZone.includes('Tokyo')) return "https://www.amazon.co.jp/s?k=TESTSEARCH";
        if (lang.startsWith('nl') || timeZone.includes('Amsterdam')) return "https://www.amazon.nl/s?k=TESTSEARCH";
    } catch (e) {}
    return "https://www.amazon.com/s?k=TESTSEARCH";
}

// default searches
const defaultSearches = {
    "Google Maps":     { url: "https://maps.google.com/maps?q=TESTSEARCH", state: "on" },
    "Google Shopping": { url: "https://shopping.google.com/search?q=TESTSEARCH", state: "on" },
    "YouTube":         { url: "https://www.youtube.com/results?search_query=TESTSEARCH", state: "on" },
    "Amazon":          { url: getLocalizedAmazonSearchUrl(), state: "on" },
    "Wikipedia":       { url: "https://en.wikipedia.org/wiki/TESTSEARCH", state: "on" }
};

// default left bookmarks
const defaultLeftBookmarks = {
    "Gmail":        { url: "https://mail.google.com/", state: "on" },
    "Google Drive": { url: "https://drive.google.com/", state: "on" },
    "Gemini":       { url: "https://gemini.google.com/", state: "on" },
    "ChatGPT":      { url: "https://chatgpt.com/", state: "on" }
};

// default right bookmarks
const defaultRightBookmarks = {
    "Google News": { url: "https://news.google.com/", state: "on" },
    "Twitter":     { url: "https://twitter.com/", state: "on" },
    "Facebook":    { url: "https://www.facebook.com/", state: "on" },
    "Reddit":      { url: "https://www.reddit.com/", state: "on" }
};

// Menu items
const menuPages = {
    'search':     'buttonNavigationSearch',
    'bookmarks':  'buttonNavigationBookmarks',
    'background': 'buttonNavigationBackground',
    'general':    'buttonNavigationGeneral',
    'feedback':   'buttonNavigationFeedback',
    'exts':       'buttonNavigationExtensions'
};

// Background image manifest & URL helpers (synced from GitHub with offline defaults)
const BACKGROUNDS_BASE_URL = 'https://raw.githubusercontent.com/JJs-Code/1-Click-Search/main/backgrounds';
const BACKGROUNDS_MANIFEST_URL = `${BACKGROUNDS_BASE_URL}/backgrounds.json`;
const BACKGROUNDS_CACHE_KEY = 'cachedBackgroundList';

const defaultBackgrounds = [
    "Aurora", "Autumn_Leaves", "Blossom", "Breakwater", "Fall",
    "Falls", "Frost", "Frozen", "Haze", "Lazy_Day",
    "Morning_Mist", "Palm_Beach", "Peaks", "Sol", "Spots",
    "Stripes", "Sunset", "Treetops", "Tropical", "Whitewater", "Wildflower"
];

function normalizeBackgroundName(name) {
    if (name === 'Autumm_Leaves') return 'Autumn_Leaves';
    return name;
}

/** Converts a raw background filename/entry into a clean card label (strips extension, underscores -> spaces). */
function getBackgroundDisplayName(entry) {
    const clean = normalizeBackgroundName(entry || '');
    return clean.replace(/\.(jpe?g|png|webp|gif|avif)$/i, '').replace(/_/g, ' ');
}

/** Resolves a background entry into full-res and thumbnail GitHub raw URLs (defaults extensionless entries to .jpg). */
function resolveBackgroundImageUrls(entry) {
    const clean = normalizeBackgroundName(entry || '');
    const hasExtension = /\.(jpe?g|png|webp|gif|avif)$/i.test(clean);
    const fileName = hasExtension ? clean : `${clean}.jpg`;
    return {
        fullUrl: `${BACKGROUNDS_BASE_URL}/${fileName}`,
        thumbUrl: `${BACKGROUNDS_BASE_URL}/thumbs/${fileName}`
    };
}

/** Filters a remote background list to safe, unique, non-empty image filenames. */
function sanitizeBackgroundList(rawList) {
    if (!Array.isArray(rawList)) return null;
    const cleaned = [];
    const seen = new Set();
    for (const item of rawList) {
        if (typeof item !== 'string') continue;
        const normalized = normalizeBackgroundName(item.trim());
        if (!normalized || normalized.includes('..') || normalized.includes('/') || normalized.includes('\\')) continue;
        if (!seen.has(normalized)) {
            seen.add(normalized);
            cleaned.push(normalized);
        }
    }
    return cleaned.length > 0 ? cleaned : null;
}

/** Returns the cached GitHub background list from localStorage, or the built-in defaults if offline/uninitialized. */
function getBackgroundList() {
    try {
        const cached = localStorage.getItem(BACKGROUNDS_CACHE_KEY);
        if (cached) {
            const parsed = sanitizeBackgroundList(JSON.parse(cached));
            if (parsed) return parsed;
        }
    } catch (e) {}
    return defaultBackgrounds.slice();
}

/** Fetches the latest backgrounds/backgrounds.json from GitHub and updates the localStorage cache if changed. */
async function fetchRemoteBackgroundList() {
    const currentList = getBackgroundList();
    try {
        const response = await fetch(BACKGROUNDS_MANIFEST_URL, { cache: 'no-cache' });
        if (!response.ok) return { list: currentList, changed: false };
        const data = await response.json();
        const candidate = Array.isArray(data) ? data : (data && Array.isArray(data.backgrounds) ? data.backgrounds : null);
        const remoteList = sanitizeBackgroundList(candidate);
        if (!remoteList) return { list: currentList, changed: false };

        const changed = JSON.stringify(remoteList) !== JSON.stringify(currentList);
        try {
            localStorage.setItem(BACKGROUNDS_CACHE_KEY, JSON.stringify(remoteList));
        } catch (e) {}
        return { list: remoteList, changed };
    } catch (e) {
        return { list: currentList, changed: false };
    }
}

// background solid colors
const solidBackgroundIds = {
    'background-dark':  '#282828',
    'background-light': '#FFFFFF'
};

/** Escapes HTML special characters for safe insertion inside attribute values. */
function escapeHtmlAttr(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
}

// HTML injection: Search Box
function searchHtml(name, key) {
    const safeName = name !== 'blank' ? escapeHtmlAttr(name) : '';
    const safeUrl = escapeHtmlAttr(key && key.url ? key.url : '');
    return `
        <img class="settingsCardFavicon" alt="">

        <input type="text" class="searchInput searchName" title="Search engine name" placeholder="Name" value="${safeName}">
        <input type="url"  class="searchInput searchUrl"  title="Search URL pattern" placeholder="Site url" value="${safeUrl}">

        <div class="searchContainerButton actionButtons">
            <div class="searchActiveToggle">
                <label class="switch" title="Enable or disable search bar">
                    <input type="checkbox" class="searchActive" title="Enable or disable search bar" ${key && key.state === 'off' ? '' : 'checked'}>
                    <span class="slider round"></span>
                </label>
            </div>

            <button type="button" class="searchButton actionButton buttonRed" title="Delete search bar">
                <svg class="icon">
                    <use href="icons/delete.svg#icon"></use>
                </svg>
            </button>

            <svg class="icon buttonReorder" title="Drag to reorder">
                <use href="icons/reorder.svg#icon"></use>
            </svg>
        </div>
    `;
}

// HTML injection: Bookmark Box
function bookmarkHtml(name, key) {
    const safeName = name !== 'blank' ? escapeHtmlAttr(name) : '';
    const safeUrl = escapeHtmlAttr(key && key.url ? key.url : '');
    return `
        <img class="settingsCardFavicon" alt="">

        <input type="text" class="searchInput bookmarkName" title="Bookmark name" placeholder="Name" value="${safeName}">
        <input type="url"  class="searchInput bookmarkUrl"  title="Bookmark URL" placeholder="Site url" value="${safeUrl}">

        <div class="searchContainerButton actionButtons">
            <div class="searchActiveToggle">
                <label class="switch" title="Enable or disable bookmark">
                    <input type="checkbox" class="bookmarkActive" title="Enable or disable bookmark" ${key && key.state === 'off' ? '' : 'checked'}>
                    <span class="slider round"></span>
                </label>
            </div>

            <button type="button" class="bookmarkButton actionButton buttonRed" title="Delete bookmark">
                <svg class="icon">
                    <use href="icons/delete.svg#icon"></use>
                </svg>
            </button>

            <svg class="icon bookmarkButtonReorder" title="Drag to reorder">
                <use href="icons/reorder.svg#icon"></use>
            </svg>
        </div>
    `;
}

// Browser-level Alert Dialog (matching the uniform top-docked dialog style)
function showBrowserAlert(messageText, onOk) {
    const existing = document.getElementById('nativeAlertDialog');
    if (existing) existing.remove();

    const dialog = document.createElement('dialog');
    dialog.id = 'nativeAlertDialog';
    dialog.className = 'nativeSystemDialog';
    dialog.innerHTML = `
        <p class="nativeDialogTitle"></p>
        <div class="nativeDialogActions">
            <button type="button" class="nativeDialogBtn nativeDialogBtnConfirm" id="nativeAlertOkBtn">OK</button>
        </div>
    `;
    const titleEl = dialog.querySelector('.nativeDialogTitle');
    if (titleEl) titleEl.textContent = messageText;
    document.body.appendChild(dialog);

    const okBtn = dialog.querySelector('#nativeAlertOkBtn');
    let handled = false;

    const cleanup = () => {
        if (dialog.open) dialog.close();
        dialog.remove();
    };

    okBtn.addEventListener('click', () => {
        handled = true;
        cleanup();
        if (typeof onOk === 'function') onOk();
    });

    dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        if (!handled) {
            handled = true;
            cleanup();
            if (typeof onOk === 'function') onOk();
        }
    });

    dialog.showModal();
    okBtn.focus();
}

// Browser-level Delete Confirmation Dialog (with "Don't ask me again" checkbox)
function showBrowserDeleteConfirm(onConfirm, onCancel) {
    let raw = localStorage.getItem('deleteWarning');
    if (raw === null) raw = localStorage.getItem('delWarn');
    let deleteWarningSetting = 'on';
    if (raw !== null) {
        try { deleteWarningSetting = JSON.parse(raw); } catch (e) { deleteWarningSetting = raw; }
    }

    if (deleteWarningSetting === 'off') {
        if (typeof onConfirm === 'function') onConfirm();
        return;
    }

    const existing = document.getElementById('nativeDeleteDialog');
    if (existing) existing.remove();

    const dialog = document.createElement('dialog');
    dialog.id = 'nativeDeleteDialog';
    dialog.className = 'nativeSystemDialog';
    dialog.innerHTML = `
        <p class="nativeDialogTitle">Are you sure you want to delete this item?</p>
        <label class="nativeDialogCheckboxRow">
            <input type="checkbox" id="nativeDontAskAgainCheckbox">
            <span>Don't ask me again</span>
        </label>
        <div class="nativeDialogActions">
            <button type="button" class="nativeDialogBtn nativeDialogBtnConfirm" id="nativeDeleteConfirmBtn">OK</button>
            <button type="button" class="nativeDialogBtn nativeDialogBtnCancel" id="nativeDeleteCancelBtn">Cancel</button>
        </div>
    `;
    document.body.appendChild(dialog);

    const checkbox = dialog.querySelector('#nativeDontAskAgainCheckbox');
    const cancelBtn = dialog.querySelector('#nativeDeleteCancelBtn');
    const confirmBtn = dialog.querySelector('#nativeDeleteConfirmBtn');
    let handled = false;

    const cleanup = () => {
        if (dialog.open) dialog.close();
        dialog.remove();
    };

    cancelBtn.addEventListener('click', () => {
        handled = true;
        cleanup();
        if (typeof onCancel === 'function') onCancel();
    });

    confirmBtn.addEventListener('click', () => {
        handled = true;
        if (checkbox && checkbox.checked) {
            localStorage.setItem('deleteWarning', JSON.stringify('off'));
            localStorage.removeItem('delWarn');
            if (typeof setupAllToggles === 'function') setupAllToggles();
            if (typeof populateImportExportField === 'function') populateImportExportField();
        }
        cleanup();
        if (typeof onConfirm === 'function') onConfirm();
    });

    dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        if (!handled) {
            handled = true;
            cleanup();
            if (typeof onCancel === 'function') onCancel();
        }
    });

    dialog.showModal();
    confirmBtn.focus();
}

// Browser-level Reset All Settings Dialog (requires typing RESET)
function showBrowserResetConfirm(onConfirm) {
    const existing = document.getElementById('nativeResetDialog');
    if (existing) existing.remove();

    const dialog = document.createElement('dialog');
    dialog.id = 'nativeResetDialog';
    dialog.className = 'nativeSystemDialog';
    dialog.innerHTML = `
        <p class="nativeDialogTitle scaryResetTitle">Reset All Settings</p>
        <p class="nativeDialogBody">This will delete all your current settings and cannot be undone, it is recommended to back up your searches first, are you sure you want to proceed?</p>
        <p class="nativeDialogBody" style="margin-bottom: 8px;">Type <b>RESET</b> below to confirm:</p>
        <input type="text" class="nativeDialogInput" id="nativeResetConfirmInput" placeholder="Type RESET" autocomplete="off">
        <div class="nativeDialogActions">
            <button type="button" class="nativeDialogBtn nativeDialogBtnDanger" id="nativeResetConfirmBtn" disabled>RESET ALL</button>
            <button type="button" class="nativeDialogBtn nativeDialogBtnCancel" id="nativeResetCancelBtn">Cancel</button>
        </div>
    `;
    document.body.appendChild(dialog);

    const input = dialog.querySelector('#nativeResetConfirmInput');
    const cancelBtn = dialog.querySelector('#nativeResetCancelBtn');
    const confirmBtn = dialog.querySelector('#nativeResetConfirmBtn');

    const cleanup = () => {
        if (dialog.open) dialog.close();
        dialog.remove();
    };

    input.addEventListener('input', () => {
        confirmBtn.disabled = input.value.trim() !== 'RESET';
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim() === 'RESET') {
            e.preventDefault();
            confirmBtn.click();
        }
    });

    cancelBtn.addEventListener('click', cleanup);

    confirmBtn.addEventListener('click', () => {
        if (input.value.trim() !== 'RESET') return;
        cleanup();
        if (typeof onConfirm === 'function') onConfirm();
    });

    dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        cleanup();
    });

    dialog.showModal();
    input.focus();
}

/**
 * Focuses an existing Home (New Tab) tab if one is already open,
 * or opens main.html in the current tab otherwise.
 */
function focusOrOpenHomeTab() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query && chrome.runtime && chrome.runtime.getURL) {
        const homeUrl = chrome.runtime.getURL('main.html');
        const isHomeTab = (t) => {
            const tabUrl = t.url || t.pendingUrl || '';
            return (
                tabUrl.startsWith(homeUrl) ||
                /^(chrome|edge|brave|vivaldi|opera):\/\/newtab\/?/i.test(tabUrl) ||
                t.title === 'Home: 1 Click Search'
            );
        };
        chrome.tabs.query({}, function(tabs) {
            const existingTab = tabs && tabs.find(isHomeTab);
            if (existingTab) {
                chrome.tabs.update(existingTab.id, { active: true });
                if (existingTab.windowId && chrome.windows) {
                    chrome.windows.update(existingTab.windowId, { focused: true });
                }
            } else {
                window.location.href = 'main.html';
            }
        });
    } else {
        window.location.href = 'main.html';
    }
}