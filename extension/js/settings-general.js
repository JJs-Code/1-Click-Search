// General Settings Controller
// Manages the blur intensity slider, home/delete toggles, 12h/24h clock format selector,
// full-config JSON Import/Export (clipboard & file), walkthrough replay, and settings reset.

const blurSlider = document.getElementById('blurSlider');
const blurOutput = document.getElementById('blurValue');
const blurImage  = document.getElementById('blurImage');
let blurSetpoint = localStorage.getItem('blurIntensity');
let blurIntensity = blurSetpoint !== null ? parseFloat(blurSetpoint) : 4;

if (blurImage) blurImage.style.filter = `blur(${blurIntensity}px)`;
if (blurSlider) blurSlider.value = blurIntensity * 12.5;
if (blurOutput) blurOutput.textContent = `Current: ${Math.round(blurIntensity * 12.5)}%`;

if (blurSlider) {
    blurSlider.addEventListener("input", function() {
        if (blurOutput) blurOutput.textContent = `Current: ${this.value}%`;
        const adjustedOutput = this.value / 12.5;
        localStorage.setItem('blurIntensity', adjustedOutput);
        if (blurImage) blurImage.style.filter = `blur(${adjustedOutput}px)`;
        populateImportExportField();
    });
}

// Settings Toggle Helper
// Binds a checkbox toggle to a localStorage key ('on' / 'off') and refreshes the export preview on change.
const settingsListeners = {};
function setupSettingToggle(elementId, storageKey, defaultValue = 'on') {
    const toggle = document.getElementById(elementId);
    if (!toggle) return;
    let raw = localStorage.getItem(storageKey);
    // Backward compatibility: migrate legacy delWarn to deleteWarning
    if (raw === null && storageKey === 'deleteWarning') {
        raw = localStorage.getItem('delWarn');
        if (raw !== null) {
            localStorage.setItem('deleteWarning', raw);
            localStorage.removeItem('delWarn');
        }
    }
    let value = null;
    if (raw !== null) {
        try { value = JSON.parse(raw); } catch(e) { value = raw; }
    } else {
        value = defaultValue;
    }

    if (value === 'off') {
        toggle.removeAttribute('checked');
        toggle.checked = false;
    } else {
        toggle.setAttribute('checked', '');
        toggle.checked = true;
    }
    
    if (settingsListeners[elementId] !== 'on') {
        settingsListeners[elementId] = 'on';
        toggle.addEventListener('change', () => {
            const val = toggle.checked ? 'on' : 'off';
            localStorage.setItem(storageKey, JSON.stringify(val));
            if (storageKey === 'deleteWarning') localStorage.removeItem('delWarn');
            populateImportExportField();
        });
    }
}

function setupAllToggles() {
    setupSettingToggle('showClockCheckbox', 'showClock', 'on');
    setupSettingToggle('showLogoCheckbox', 'showLogo', 'on');
    setupSettingToggle('deleteWarningCheckbox', 'deleteWarning', 'on');
    setupClockFormatSelector();
}

/** Initializes the 12hr / 24hr segmented buttons and hides them when the Home Clock is turned off. */
function setupClockFormatSelector() {
    const group = document.getElementById('clockTimeFormatGroup');
    if (!group) return;
    let format = localStorage.getItem('clockTimeFormat') || '24h';
    try { format = JSON.parse(format); } catch(e) {}

    const clockToggle = document.getElementById('showClockCheckbox');
    const updateGroupVisibility = () => {
        if (clockToggle) {
            group.style.display = clockToggle.checked ? 'inline-flex' : 'none';
        }
    };
    updateGroupVisibility();
    if (clockToggle) {
        clockToggle.addEventListener('change', updateGroupVisibility);
    }

    const buttons = group.querySelectorAll('.clockFormatBtn');
    buttons.forEach(btn => {
        if (btn.dataset.format === format) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const chosen = btn.dataset.format;
            localStorage.setItem('clockTimeFormat', JSON.stringify(chosen));
            populateImportExportField();
        });
    });
}

setupAllToggles();

// Read-only display box for import/export
const importExportBox       = document.getElementById('importExportTextarea');
const buttonImportSave      = document.getElementById('buttonImportSave');
const buttonExportClipboard = document.getElementById('buttonExportClipboard');
const buttonExportFile      = document.getElementById('buttonExportFile');
const buttonImportFile      = document.getElementById('buttonImportFile');
const importFileInput       = document.getElementById('importFileInput');

/** Collects all General and Background settings into a single object for export. */
function getGeneralSettingsObj() {
    let blur = localStorage.getItem('blurIntensity');
    blur = blur !== null ? parseFloat(blur) : 4;

    let deleteWarning = 'on';
    let rawDeleteWarning = localStorage.getItem('deleteWarning');
    if (rawDeleteWarning === null) rawDeleteWarning = localStorage.getItem('delWarn');
    if (rawDeleteWarning !== null) {
        try { deleteWarning = JSON.parse(rawDeleteWarning); } catch(e) { deleteWarning = rawDeleteWarning; }
    }

    let showLogo = 'on';
    const rawShowLogo = localStorage.getItem('showLogo');
    if (rawShowLogo !== null) {
        try { showLogo = JSON.parse(rawShowLogo); } catch(e) { showLogo = rawShowLogo; }
    }

    let showClock = 'on';
    const rawShowClock = localStorage.getItem('showClock');
    if (rawShowClock !== null) {
        try { showClock = JSON.parse(rawShowClock); } catch(e) { showClock = rawShowClock; }
    }

    let clockTimeFormat = '24h';
    const rawFormat = localStorage.getItem('clockTimeFormat');
    if (rawFormat !== null) {
        try { clockTimeFormat = JSON.parse(rawFormat); } catch(e) { clockTimeFormat = rawFormat; }
    }

    const selectedBackground = localStorage.getItem('selectedBackground') || 'background-random';
    const selectedRandomOption = localStorage.getItem('selectedRandomOption') || 'background-daily';
    const customBackgroundUrl = localStorage.getItem('customBackgroundUrl') || '';

    return {
        blurIntensity: blur,
        deleteWarning: deleteWarning === 'off' ? 'off' : 'on',
        showLogo: showLogo === 'off' ? 'off' : 'on',
        showClock: showClock === 'off' ? 'off' : 'on',
        clockTimeFormat: clockTimeFormat,
        selectedBackground: selectedBackground,
        selectedRandomOption: selectedRandomOption,
        customBackgroundUrl: customBackgroundUrl
    };
}

/**
 * Builds the pipe-delimited export string:
 *   searches | leftBookmarks | rightBookmarks | generalSettings
 * and displays it in the read-only import/export preview box.
 */
function populateImportExportField() {
    if (!importExportBox) return;
    let searchDataObj = null;
    try {
        let raw = localStorage.getItem('searchData');
        if (raw === null) raw = localStorage.getItem('schData');
        if (raw) searchDataObj = JSON.parse(raw);
    } catch(e) {}
    if (!searchDataObj) searchDataObj = (typeof defaultSearches !== 'undefined' ? { ...defaultSearches } : {});
    delete searchDataObj['Browser Default'];

    const searchData      = JSON.stringify(searchDataObj);
    const leftBookmarks   = localStorage.getItem('bookmarkLeftData') || localStorage.getItem('bmLeftData') || (typeof defaultLeftBookmarks !== 'undefined' ? JSON.stringify(defaultLeftBookmarks) : '');
    const rightBookmarks  = localStorage.getItem('bookmarkRightData') || localStorage.getItem('bmRightData') || (typeof defaultRightBookmarks !== 'undefined' ? JSON.stringify(defaultRightBookmarks) : '');
    const generalSettings = JSON.stringify(getGeneralSettingsObj());

    importExportBox.textContent = searchData + '|' + leftBookmarks + '|' + rightBookmarks + '|' + generalSettings;
}

populateImportExportField();
window.addEventListener('hashchange', populateImportExportField);
window.addEventListener('storage', () => {
    setupAllToggles();
    populateImportExportField();
});

if (buttonExportClipboard) {
    buttonExportClipboard.addEventListener('click', function() {
        populateImportExportField();
        const exportText = importExportBox.textContent || '';
        const setFeedback = () => {
            showBrowserAlert('Settings successfully exported to clipboard!');
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(exportText).then(setFeedback).catch(() => {
                const tempInput = document.createElement('textarea');
                tempInput.value = exportText;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                tempInput.remove();
                setFeedback();
            });
        } else {
            const tempInput = document.createElement('textarea');
            tempInput.value = exportText;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            tempInput.remove();
            setFeedback();
        }
    });
}

if (buttonExportFile) {
    buttonExportFile.addEventListener('click', function() {
        populateImportExportField();
        const exportText = importExportBox ? (importExportBox.textContent || '') : '';
        const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateStamp = new Date().toISOString().slice(2, 10);
        link.href = url;
        link.download = `1ClickSearch-UserConfig-${dateStamp}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
}

if (buttonImportFile && importFileInput) {
    buttonImportFile.addEventListener('click', function() {
        importFileInput.value = '';
        importFileInput.click();
    });

    importFileInput.addEventListener('change', function(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const content = evt.target && typeof evt.target.result === 'string' ? evt.target.result : '';
            processImport(content);
        };
        reader.onerror = function() {
            showBrowserAlert('Failed to read the selected file. Please try again.');
        };
        reader.readAsText(file);
    });
}

// Import logic with auto-conversion of SEARCHTEXT -> TESTSEARCH, 2-part -> 3-part layout, and optional 4th part for General Settings.
// Validates every JSON segment before writing anything to localStorage so invalid input never corrupts settings.
function processImport(rawInput) {
    if (!rawInput || !rawInput.trim()) {
        showBrowserAlert('No data to import. Please copy your export data first.');
        return;
    }

    rawInput = rawInput.trim();

    // Convert legacy placeholder SEARCHTEXT to TESTSEARCH
    rawInput = rawInput.replace(/SEARCHTEXT/gi, 'TESTSEARCH');

    const parts = rawInput.split('|');
    if (parts.length < 2) {
        showBrowserAlert('Invalid settings format. The text must be a valid 1 Click Search export string.');
        return;
    }

    // 1. Validate Searches (Part 1)
    let parsedSearches;
    try {
        parsedSearches = JSON.parse(parts[0]);
        if (!parsedSearches || typeof parsedSearches !== 'object' || Array.isArray(parsedSearches)) {
            throw new Error('Searches must be a JSON object');
        }
    } catch (e) {
        showBrowserAlert('Invalid search data JSON format. Please verify the copied settings text.');
        return;
    }

    // 2. Validate Bookmarks (Parts 2 & 3)
    let parsedLeft = null;
    let parsedRight = null;
    try {
        if (parts.length === 2) {
            // Legacy 2-part format: bookmarks are in parts[1]
            parsedRight = (parts[1] && parts[1].trim()) ? JSON.parse(parts[1]) : {};
            if (!parsedRight || typeof parsedRight !== 'object' || Array.isArray(parsedRight)) {
                throw new Error('Bookmarks must be a JSON object');
            }
        } else {
            // 3-part or 4-part format: left in parts[1], right in parts[2]
            parsedLeft = (parts[1] && parts[1].trim()) ? JSON.parse(parts[1]) : {};
            parsedRight = (parts[2] && parts[2].trim()) ? JSON.parse(parts[2]) : {};
            if (!parsedLeft || typeof parsedLeft !== 'object' || Array.isArray(parsedLeft) ||
                !parsedRight || typeof parsedRight !== 'object' || Array.isArray(parsedRight)) {
                throw new Error('Bookmarks must be a JSON object');
            }
        }
    } catch (e) {
        showBrowserAlert('Invalid bookmark data JSON format. Please verify the copied settings text.');
        return;
    }

    // 3. Validate General Settings (Part 4, optional for backwards compatibility)
    let parsedGeneral = null;
    if (parts.length >= 4 && parts[3] && parts[3].trim()) {
        try {
            parsedGeneral = JSON.parse(parts[3]);
            if (!parsedGeneral || typeof parsedGeneral !== 'object' || Array.isArray(parsedGeneral)) {
                throw new Error('General settings must be a JSON object');
            }
        } catch (e) {
            showBrowserAlert('Invalid general settings JSON format. Please verify the copied settings text.');
            return;
        }
    }

    // --- Validation passed! Now we can safely update and save ---

    // 1. Save Searches (strip any legacy Browser Default so it never pollutes user searches)
    delete parsedSearches['Browser Default'];
    localStorage.setItem('searchData', JSON.stringify(parsedSearches));
    localStorage.removeItem('schData');

    // 2. Save Bookmarks
    if (parts.length === 2) {
        if (!localStorage.getItem('bookmarkLeftData') && !localStorage.getItem('bmLeftData')) {
            localStorage.setItem('bookmarkLeftData', JSON.stringify(defaultLeftBookmarks));
        } else if (localStorage.getItem('bmLeftData') && !localStorage.getItem('bookmarkLeftData')) {
            localStorage.setItem('bookmarkLeftData', localStorage.getItem('bmLeftData'));
        }
        localStorage.setItem('bookmarkRightData', JSON.stringify(parsedRight));
    } else {
        localStorage.setItem('bookmarkLeftData', JSON.stringify(parsedLeft));
        localStorage.setItem('bookmarkRightData', JSON.stringify(parsedRight));
    }
    localStorage.removeItem('bmLeftData');
    localStorage.removeItem('bmRightData');

    // 3. Save General Settings if present in import data
    if (parsedGeneral) {
        if (typeof parsedGeneral.blurIntensity !== 'undefined') {
            const blurVal = Math.min(8, Math.max(0, parseFloat(parsedGeneral.blurIntensity) || 4));
            localStorage.setItem('blurIntensity', blurVal);
        }
        // Accept deleteWarning or legacy delWarn
        const deleteWarningVal = typeof parsedGeneral.deleteWarning !== 'undefined' ? parsedGeneral.deleteWarning : parsedGeneral.delWarn;
        if (typeof deleteWarningVal !== 'undefined') {
            const val = deleteWarningVal === 'off' ? 'off' : 'on';
            localStorage.setItem('deleteWarning', JSON.stringify(val));
            localStorage.removeItem('delWarn');
        }
        if (typeof parsedGeneral.showLogo !== 'undefined') {
            const showLogoVal = parsedGeneral.showLogo === 'off' ? 'off' : 'on';
            localStorage.setItem('showLogo', JSON.stringify(showLogoVal));
        }
        if (typeof parsedGeneral.showClock !== 'undefined') {
            const showClockVal = parsedGeneral.showClock === 'off' ? 'off' : 'on';
            localStorage.setItem('showClock', JSON.stringify(showClockVal));
        }
        if (typeof parsedGeneral.clockTimeFormat === 'string' && parsedGeneral.clockTimeFormat) {
            localStorage.setItem('clockTimeFormat', JSON.stringify(parsedGeneral.clockTimeFormat));
        }
        if (typeof parsedGeneral.selectedBackground === 'string' && parsedGeneral.selectedBackground) {
            localStorage.setItem('selectedBackground', parsedGeneral.selectedBackground);
            localStorage.setItem('currentId', parsedGeneral.selectedBackground);
        }
        if (typeof parsedGeneral.selectedRandomOption === 'string' && parsedGeneral.selectedRandomOption) {
            localStorage.setItem('selectedRandomOption', parsedGeneral.selectedRandomOption);
        }
        if (typeof parsedGeneral.customBackgroundUrl === 'string') {
            localStorage.setItem('customBackgroundUrl', parsedGeneral.customBackgroundUrl);
        }
    }

    showBrowserAlert('Settings successfully imported!', () => {
        window.location.href = 'settings.html#general';
        window.location.reload();
    });
}

if (buttonImportSave) {
    buttonImportSave.addEventListener('click', async function() {
        let clipText = '';
        let clipboardReadSuccess = false;

        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                clipText = await navigator.clipboard.readText();
                clipboardReadSuccess = true;
            } catch (err) {
                clipboardReadSuccess = false;
            }
        }

        // If clipboard was successfully accessed but has no text
        if (clipboardReadSuccess && (!clipText || !clipText.trim())) {
            showBrowserAlert('Your clipboard is empty. Please copy valid export settings data to your clipboard first.');
            return;
        }

        let textToImport = '';
        if (clipText && clipText.trim()) {
            textToImport = clipText.trim();
        } else if (importExportBox && importExportBox.textContent) {
            textToImport = importExportBox.textContent.trim();
        }

        processImport(textToImport);
    });
}

// Replay Interactive Walkthrough
const buttonStartWalkthrough = document.getElementById('buttonStartWalkthrough');
if (buttonStartWalkthrough) {
    buttonStartWalkthrough.addEventListener('click', function() {
        localStorage.removeItem('walkthroughCompleted');
        localStorage.setItem('startWalkthrough', Date.now().toString());
        focusOrOpenHomeTab();
    });
}

// Reset all settings
const buttonResetAll = document.getElementById('buttonResetAll');
if (buttonResetAll) {
    buttonResetAll.addEventListener('click', function() {
        showBrowserResetConfirm(() => {
            localStorage.clear();
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.clear(() => {
                    location.reload();
                });
            } else {
                location.reload();
            }
        });
    });
}