// Search Settings Controller
// Manages the pinned Browser Default Search banner and custom search engine cards
// (rendering, live favicon preview, validation, toggling, deletion, and drag-and-drop reordering).

const searchDataContainer = document.getElementById('searchDataContainer');
let firstSearchChild      = searchDataContainer ? searchDataContainer.querySelector('div.searchContainer') : null;
function getDeleteWarningSetting() {
    let raw = localStorage.getItem('deleteWarning');
    if (raw === null) raw = localStorage.getItem('delWarn');
    if (raw !== null) {
        try { return JSON.parse(raw); } catch(e) { return raw; }
    }
    return 'on';
}

function getStoredSearchData() {
    let raw = localStorage.getItem('searchData');
    if (raw === null) {
        raw = localStorage.getItem('schData');
        if (raw !== null) {
            localStorage.setItem('searchData', raw);
            localStorage.removeItem('schData');
        }
    }
    if (raw) {
        try { return JSON.parse(raw); } catch(e) { return null; }
    }
    return null;
}

let storedSearchData      = getStoredSearchData();
let searchDeleteButtons   = document.querySelectorAll('.searchButton.buttonRed'); 
let deleteWarningStored   = getDeleteWarningSetting();
let deleteWarningSetting  = deleteWarningStored ? deleteWarningStored : 'on';
let searchWarningMessage  = document.getElementById('warningMessage');
let searchNameMessage     = document.getElementById('nameMessage');
let searchUrlMessage      = document.getElementById('urlMessage');
let searchUniqueMessage   = document.getElementById('uniqueNameMessage');
let searchSavedMessage    = document.getElementById('savedMessage');
let searchDeleteListeners = 0;

initialiseSearchSettings();

function updateAllSearchSettings() {
    updateFirstSearchChild();
    updateStoredSearchData();
    updateSearchDeleteButtons();
    updateDeleteWarningSetting();
    updateSearchWarningMessages();
    detectSearchDelete();
    updateDefaultSearchBanner();
    if (typeof setupAllToggles === 'function') setupAllToggles();
    runSearchListeners();
}

function updateFirstSearchChild()    { firstSearchChild    = searchDataContainer.querySelector('div.searchContainer'); }
function updateStoredSearchData()    { storedSearchData    = getStoredSearchData(); }
function updateSearchDeleteButtons() { searchDeleteButtons = document.querySelectorAll('.searchButton.buttonRed'); }
function updateDeleteWarningSetting(){ deleteWarningStored   = getDeleteWarningSetting();
                                       deleteWarningSetting  = deleteWarningStored ? deleteWarningStored : 'on'; }
function updateSearchWarningMessages() {
    searchWarningMessage = document.getElementById('warningMessage');
    searchNameMessage    = document.getElementById('nameMessage');
    searchUrlMessage     = document.getElementById('urlMessage');
    searchUniqueMessage  = document.getElementById('uniqueNameMessage');
    searchSavedMessage   = document.getElementById('savedMessage');
}

function runSearchListeners() {
    detectSearchDelete();
    searchOnOffListeners();
    searchDragAndDropListeners();
}

/** Initializes the search settings view, migrating legacy data and removing any legacy Browser Default entry. */
function initialiseSearchSettings() {
    if (!storedSearchData) {
        localStorage.setItem('searchData', JSON.stringify(defaultSearches));
        localStorage.removeItem('schData');
    } else if (storedSearchData['Browser Default']) {
        delete storedSearchData['Browser Default'];
        localStorage.setItem('searchData', JSON.stringify(storedSearchData));
        localStorage.removeItem('schData');
    }
    updateStoredSearchData();
    searchDataContainer.innerHTML = '';
    renderSearchContainers(storedSearchData);
    attachBrowserSettingsLinkListener();
    attachRedetectDefaultEngineListener();
    updateAllSearchSettings();
}

/**
 * Renders search engine cards from `obj` (inserting in reverse at the top so the stored order
 * is preserved top-to-bottom), and wires up debounced favicon previews as URLs are edited.
 */
function renderSearchContainers(obj) {
    if (!obj) return;
    const entries = Object.entries(obj).reverse();
    entries.forEach(([name, key]) => {
        // Skip browser default since it is permanently pinned in the HTML header above
        if (name === 'Browser Default' || (key && (key.isBrowserDefault || key.url === 'BROWSER_DEFAULT'))) {
            return;
        }

        const newSearchContainer = document.createElement('div');
        newSearchContainer.className = 'searchContainer' + (key && key.state === 'off' ? ' inactive' : '');
        newSearchContainer.id = name !== 'blank' ? name.replace(/\s+/g, '_') : 'newSearch';
        newSearchContainer.innerHTML = searchHtml(name, key);
        if (typeof updateSettingsCardFavicon === 'function') {
            updateSettingsCardFavicon(newSearchContainer);
        }
        const urlInput = newSearchContainer.querySelector('.searchUrl');
        if (urlInput) {
            let faviconTimer = null;
            urlInput.addEventListener('input', () => {
                clearTimeout(faviconTimer);
                faviconTimer = setTimeout(() => {
                    if (typeof updateSettingsCardFavicon === 'function') {
                        updateSettingsCardFavicon(newSearchContainer);
                    }
                }, 250);
            });
        }
        updateFirstSearchChild();
        if (firstSearchChild) {
            searchDataContainer.insertBefore(newSearchContainer, firstSearchChild);
        } else {
            searchDataContainer.appendChild(newSearchContainer);
        }
        adjustSearchWidth();
    });
}

/** Updates the pinned Browser Default Search banner title and favicon from confirmedDefaultSearch. */
function updateDefaultSearchBanner() {
    const iconImg = document.getElementById('defaultSearchBannerIcon');
    const titleSpan = document.getElementById('defaultSearchBannerTitle');
    if (!titleSpan) return;

    let confirmed = null;
    try {
        const raw = localStorage.getItem('confirmedDefaultSearch');
        if (raw) confirmed = JSON.parse(raw);
    } catch(e) {}

    if (confirmed && confirmed.name) {
        titleSpan.textContent = confirmed.name;
        if (iconImg) {
            loadFaviconWithFallback(iconImg, confirmed.domain, 32, placeholderSvg);
        }
    } else {
        titleSpan.textContent = 'Browser Default Search';
        if (iconImg) {
            iconImg.src = placeholderSvg;
        }
    }
}

// Sync confirmed engine from storage in real time
if (typeof chrome !== 'undefined' && chrome.storage) {
    if (chrome.storage.local) {
        chrome.storage.local.get(['confirmedDefaultSearch'], (result) => {
            if (result && result.confirmedDefaultSearch) {
                try {
                    localStorage.setItem('confirmedDefaultSearch', JSON.stringify(result.confirmedDefaultSearch));
                } catch(e) {}
                updateDefaultSearchBanner();
            } else if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: 'CHECK_DEFAULT_SEARCH' }).catch(() => {});
            }
        });
    }
    if (chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes.confirmedDefaultSearch && changes.confirmedDefaultSearch.newValue) {
                try {
                    localStorage.setItem('confirmedDefaultSearch', JSON.stringify(changes.confirmedDefaultSearch.newValue));
                } catch(e) {}
                updateDefaultSearchBanner();
                const redetectBtn = document.getElementById('btnRedetectDefaultEngine');
                if (redetectBtn) {
                    const svg = redetectBtn.querySelector('svg');
                    if (svg) svg.classList.remove('spinRotating');
                    redetectBtn.style.pointerEvents = 'auto';
                }
            }
        });
    }
}

/** Opens the browser's built-in search engine settings page when the banner link is clicked. */
function attachBrowserSettingsLinkListener() {
    const link = document.getElementById('linkBrowserSettings');
    if (link) {
        link.onclick = (e) => {
            e.preventDefault();
            if (chrome && chrome.tabs && chrome.tabs.create) {
                chrome.tabs.create({ url: 'chrome://settings/search' });
            } else {
                window.open('chrome://settings/search', '_blank');
            }
        };
    }
}

/** Wires up the "Re-detect" button to ask the background worker to re-probe the default search engine. */
function attachRedetectDefaultEngineListener() {
    const redetectBtn = document.getElementById('btnRedetectDefaultEngine');
    if (redetectBtn) {
        redetectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const svg = redetectBtn.querySelector('svg');
            if (svg) svg.classList.add('spinRotating');
            redetectBtn.style.pointerEvents = 'none';

            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: 'CHECK_DEFAULT_SEARCH', force: true }).catch(() => {});
            }

            setTimeout(() => {
                if (svg) svg.classList.remove('spinRotating');
                redetectBtn.style.pointerEvents = 'auto';
            }, 2500);
        });
    }
}

/** Validates all search engine cards (empty fields, invalid syntax, duplicate names) and saves if valid. */
function checkAndSaveSearches() {
    let errorCount = 0;
    const { badName, badUrl } = checkBadSyntax();

    if (!isSearchDataEntered()) {
        showSearchWarningMessage();
        errorCount++;
    } else { removeSearchMessages(searchWarningMessage); }

    if (badName) {
        showSearchNameMessage();
        errorCount++;
    } else { removeSearchMessages(searchNameMessage); }

    if (badUrl) {
        showSearchUrlMessage();
        errorCount++;
    } else { removeSearchMessages(searchUrlMessage); }

    if (isSearchNameDuplicate()) {
        showSearchUniqueMessage();
        errorCount++;
    } else { removeSearchMessages(searchUniqueMessage); }
    
    if (errorCount === 0) {
        showSearchSavedMessage();
    } else { removeSearchMessages(searchSavedMessage); }

    updateAllSearchSettings();
}

function isSearchDataEntered() {
    updateAllSearchSettings();
    const cards = searchDataContainer.querySelectorAll('.searchContainer');
    for (const card of cards) {
        const nameInput = card.querySelector('.searchName');
        const urlInput = card.querySelector('.searchUrl');
        if (nameInput && urlInput) {
            if (!nameInput.value.trim() || !urlInput.value.trim()) {
                return false;
            }
        }
    }
    return true;
}

function checkBadSyntax() {
    let badName = false;
    let badUrl = false;
    document.querySelectorAll('.searchName').forEach(input => {
        if (!input.disabled && /[<>]/.test(input.value)) badName = true;
    });
    document.querySelectorAll('.searchUrl').forEach(urlInput => {
        if (!urlInput.disabled) {
            let val = urlInput.value.trim();
            if (val !== '' && !val.startsWith('http://') && !val.startsWith('https://')) {
                val = 'https://' + val;
                urlInput.value = val;
            }
            const hasPlaceholder = /TESTSEARCH|SEARCHTEXT|%s/i.test(val);
            if ((!hasPlaceholder || !val.startsWith('http')) && val !== '') {
                badUrl = true;
            }
        }
    });
    return { badName, badUrl };
}

function isSearchNameDuplicate() {
    const inputs = document.querySelectorAll('.searchName');
    const values = [];
    let duplicate = false;
    inputs.forEach(input => {
        const value = input.value.trim();
        if (values.includes(value)) {
            duplicate = true;
        } else {
            values.push(value);
        }
    });
    return duplicate;
}

function removeSearchMessages(element) {
    updateSearchWarningMessages();
    if (element) element.remove();
}

function displaySearchMessage(messageId, messageClass, flashClass, content) {
    updateSearchWarningMessages();
    let messageElement = document.getElementById(messageId);
    if (!messageElement) {
        messageElement = document.createElement('p');
        messageElement.id = messageId;
        messageElement.className = 'searchMessage ' + (messageClass || '');
        messageElement.innerHTML = content;
        const msgContainer = document.getElementById('searchMessageContainer');
        if (msgContainer) {
            msgContainer.appendChild(messageElement);
        } else {
            const banner = document.getElementById('defaultBrowserSearchBanner');
            if (banner && banner.parentNode) {
                banner.parentNode.insertBefore(messageElement, banner);
            } else {
                updateFirstSearchChild();
                searchDataContainer.insertBefore(messageElement, firstSearchChild);
            }
        }
    } else {
        messageElement.classList.add(flashClass);
        setTimeout(() => messageElement.classList.remove(flashClass), 500); 
    }
}

function showSearchWarningMessage() {
    displaySearchMessage('warningMessage', undefined, 'warningFlash', 'Fill in all input fields before saving or adding new searches');
}

function showSearchNameMessage() {
    displaySearchMessage('nameMessage', 'syntaxMessage', 'syntaxFlash', "The '<' and '>' characters are not allowed in the 'Name' field");
}

function showSearchUrlMessage() {
    displaySearchMessage('urlMessage', 'syntaxMessage', 'syntaxFlash', 'The \'URL\' field must contain "TESTSEARCH" (or "%s") and be a valid website URL');
}

function showSearchUniqueMessage() {
    displaySearchMessage('uniqueNameMessage', 'syntaxMessage', 'syntaxFlash', 'New name cannot be the same as already existing search name');
}

function showSearchSavedMessage() {
    saveSearchesToStorage();
    updateSearchDeleteButtons();
    updateSearchWarningMessages();
    displaySearchMessage('savedMessage', undefined, 'savedFlash', 'Saved!');
}

function saveSearchesToStorage() {
    const searchData = {};
    const nameInputs = searchDataContainer.querySelectorAll('.searchName');

    nameInputs.forEach(nameInput => {
        const searchContainerElement = nameInput.closest('.searchContainer');
        const nameValue = nameInput.value.trim();
        if (!nameValue || nameValue === 'Browser Default' || nameValue === 'Browser Default Search') return;

        searchContainerElement.id = nameValue.replace(/\s+/g, '_');

        const urlInput = searchContainerElement.querySelector('.searchUrl');
        const activeInput = searchContainerElement.querySelector('.searchActive');

        let normalizedUrl = urlInput ? urlInput.value.trim() : '';
        if (normalizedUrl && !normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = 'https://' + normalizedUrl;
        }
        normalizedUrl = normalizedUrl.replace(/SEARCHTEXT|%s/gi, 'TESTSEARCH');
        if (urlInput) urlInput.value = normalizedUrl;
        if (typeof updateSettingsCardFavicon === 'function') {
            updateSettingsCardFavicon(searchContainerElement);
        }
        searchData[nameValue] = {
            url: normalizedUrl,
            state: activeInput && activeInput.checked ? 'on' : 'off'
        };
    });

    localStorage.setItem('searchData', JSON.stringify(searchData));
    localStorage.removeItem('schData');
    storedSearchData = getStoredSearchData();
    if (typeof populateImportExportField === 'function') populateImportExportField();
    updateAllSearchSettings();
}

function searchDeleteHandler(e) {
    e.preventDefault();
    const searchContainerElement = e.target.closest('.searchContainer');
    if (!searchContainerElement) return;
    showBrowserDeleteConfirm(() => {
        executeDeleteSearchByElement(searchContainerElement);
    });
}

function executeDeleteSearchByElement(searchContainerElement) {
    const nameInput = searchContainerElement.querySelector('.searchName');
    const nameId = nameInput && nameInput.value.trim() ? nameInput.value.trim() : searchContainerElement.id.replace(/_/g, ' ');
    searchContainerElement.remove();
    updateStoredSearchData();
    if (storedSearchData) delete storedSearchData[nameId];
    removeSearchMessages(searchSavedMessage);
    saveSearchesToStorage();
    updateAllSearchSettings();
}

function toggleSearchState() {
    const searchContainerElement = this.closest('.searchContainer');
    const nameId = searchContainerElement.id.replace(/_/g, ' ');
    if (this.checked) {
        searchContainerElement.classList.remove('inactive');
    } else {
        searchContainerElement.classList.add('inactive');
    }
    if (storedSearchData[nameId]) {
        storedSearchData[nameId].state = this.checked ? 'on' : 'off';
        localStorage.setItem('searchData', JSON.stringify(storedSearchData));
        localStorage.removeItem('schData');
        if (typeof populateImportExportField === 'function') populateImportExportField();
    }
}

function getDragAfterSearchElement(container, y) {
    const draggables = [...container.querySelectorAll('.searchContainer:not(.is-dragged-item):not(.drag-placeholder)')];
    return draggables.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        } 
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function adjustSearchWidth() {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    function setWidths(className, width, maxWidth, flexWrap, flex) {
        document.querySelectorAll(className).forEach(elem => {
            elem.style.width = width;
            elem.style.maxWidth = maxWidth;
            elem.style.flexWrap = flexWrap;
            if (flex !== undefined) elem.style.flex = flex;
        });        
    }
    if (viewportWidth >= 1500) {
        setWidths('.searchContainer:not(.defaultSearchBanner)', '100%', '1450px', 'nowrap', '');
        setWidths('.searchName', 'calc(100% / 2.5)', '300px', '', '0 0 auto');
        setWidths('.searchUrl', '100%', '100%', '', '1 1 auto');
    } else {
        ['.searchContainer', '.searchName', '.searchUrl'].forEach(cls => setWidths(cls, '', '', '', ''));
    }
}

document.getElementById('addNewSearchButton').addEventListener('click', function(e) {
    e.preventDefault();
    removeSearchMessages(searchSavedMessage);
    if (isSearchDataEntered()) {
        renderSearchContainers({ blank: '' });
        updateAllSearchSettings();
    } else {
        showSearchWarningMessage();
    }
});

document.getElementById('saveSearchButton').addEventListener('click', function(e) {
    e.preventDefault();
    checkAndSaveSearches();
});

function removeSearchDeleteListeners() {
    if (searchDeleteListeners === 1) {
        searchDeleteButtons.forEach(button => button.removeEventListener('click', searchDeleteHandler));
        searchDeleteListeners = 0;
    }
}

function detectSearchDelete() {
    removeSearchDeleteListeners();
    updateSearchDeleteButtons();
    if (searchDeleteButtons.length > 0) {
        searchDeleteListeners = 1;
        searchDeleteButtons.forEach(btn => btn.addEventListener('click', searchDeleteHandler));
    }
}

function searchOnOffListeners() {
    document.querySelectorAll('.searchActive').forEach(toggle => {
        toggle.removeEventListener('change', toggleSearchState);
        toggle.addEventListener('change', toggleSearchState);
    });
}

/** Attaches pointer-based vertical drag-and-drop reordering with FLIP sibling animation. */
function searchDragAndDropListeners() {
    if (searchDataContainer._hasDragListeners) return;
    searchDataContainer._hasDragListeners = true;

    searchDataContainer.addEventListener("mousedown", function(e) {
        const handle = e.target.closest('.buttonReorder, .settingsCardFavicon');
        if (!handle || e.button !== 0) return;

        const card = handle.closest('.searchContainer');
        if (!card) return;

        e.preventDefault();

        const startY = e.clientY;
        const startX = e.clientX;
        let isDraggingActive = false;
        let placeholder = null;
        let grabOffsetY = 0;

        function onMouseMove(moveEvent) {
            if (!isDraggingActive) {
                if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 3) return;

                isDraggingActive = true;
                document.body.classList.add('is-dragging');

                const cardRect = card.getBoundingClientRect();
                grabOffsetY = startY - cardRect.top;

                placeholder = document.createElement('div');
                placeholder.className = 'searchContainer drag-placeholder';
                placeholder.style.height = cardRect.height + 'px';
                placeholder.style.width = cardRect.width + 'px';
                placeholder.style.marginTop = window.getComputedStyle(card).marginTop;
                placeholder.style.marginBottom = window.getComputedStyle(card).marginBottom;

                card.parentNode.insertBefore(placeholder, card);

                card.classList.add('is-dragged-item');
                card.style.position = 'fixed';
                card.style.top = (moveEvent.clientY - grabOffsetY) + 'px';
                card.style.left = cardRect.left + 'px';
                card.style.width = cardRect.width + 'px';
                card.style.height = cardRect.height + 'px';
                card.style.margin = '0';
                card.style.zIndex = '100';
                card.style.pointerEvents = 'none';
            }

            card.style.top = (moveEvent.clientY - grabOffsetY) + 'px';

            const afterElement = getDragAfterSearchElement(searchDataContainer, moveEvent.clientY);
            if (placeholder.nextElementSibling === afterElement) return;

            // FLIP animation for siblings
            const siblings = [...searchDataContainer.querySelectorAll('.searchContainer:not(.is-dragged-item):not(.drag-placeholder)')];
            const firstTops = new Map();
            siblings.forEach(el => firstTops.set(el, el.getBoundingClientRect().top));

            if (afterElement == null) {
                searchDataContainer.appendChild(placeholder);
            } else {
                searchDataContainer.insertBefore(placeholder, afterElement);
            }

            siblings.forEach(el => {
                const firstTop = firstTops.get(el);
                if (firstTop === undefined) return;
                const lastTop = el.getBoundingClientRect().top;
                const deltaY = firstTop - lastTop;

                if (Math.abs(deltaY) > 0.5) {
                    el.style.transition = 'none';
                    el.style.transform = `translateY(${deltaY}px)`;
                    el.offsetHeight; // force reflow
                    el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)';
                    el.style.transform = '';

                    const onEnd = () => {
                        el.style.transition = '';
                        el.removeEventListener('transitionend', onEnd);
                    };
                    el.addEventListener('transitionend', onEnd);
                }
            });
        }

        function onMouseUp() {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            if (!isDraggingActive) {
                document.body.classList.remove('is-dragging');
                return;
            }

            const targetRect = placeholder.getBoundingClientRect();
            card.style.transition = 'top 0.18s cubic-bezier(0.2, 0, 0, 1)';
            card.style.top = targetRect.top + 'px';

            let cleanedUp = false;
            function finish() {
                if (cleanedUp) return;
                cleanedUp = true;

                if (placeholder && placeholder.parentNode) {
                    placeholder.parentNode.insertBefore(card, placeholder);
                    placeholder.remove();
                }

                card.style.position = '';
                card.style.top = '';
                card.style.left = '';
                card.style.width = '';
                card.style.height = '';
                card.style.margin = '';
                card.style.zIndex = '';
                card.style.transition = '';
                card.style.pointerEvents = '';
                card.classList.remove('is-dragged-item');
                document.body.classList.remove('is-dragging');

                if (typeof adjustSearchWidth === 'function') adjustSearchWidth();
                saveSearchesToStorage();
            }

            card.addEventListener('transitionend', finish, { once: true });
            setTimeout(finish, 220);
        }

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });

    window.addEventListener('dragstart', function(e) {
        if (document.body.classList.contains('is-dragging')) {
            e.preventDefault();
        }
    });
}

window.addEventListener('resize', adjustSearchWidth);
adjustSearchWidth();

window.addEventListener('storage', (e) => {
    if (e.key === 'searchData' || e.key === 'schData') {
        updateStoredSearchData();
        if (storedSearchData && searchDataContainer) {
            searchDataContainer.innerHTML = '';
            renderSearchContainers(storedSearchData);
            updateAllSearchSettings();
        }
    }
});