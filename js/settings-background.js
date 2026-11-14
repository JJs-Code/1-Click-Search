// Background Settings Controller
function selectActiveBackground(className) {
    const toggles = document.querySelectorAll(className);
    toggles.forEach(el => {
        if (el._hasBgClickListener) return;
        el._hasBgClickListener = true;
        el.addEventListener('click', () => {
            document.querySelectorAll(className).forEach(elem => elem.classList.remove('active'));
            el.classList.add('active');
            localStorage.setItem('currentId', el.id);
            saveBackgroundSelection(el.id);
        });
    });

    let storedId = localStorage.getItem('currentId');
    if (storedId === 'Autumm_Leaves') {
        storedId = 'Autumn_Leaves';
        localStorage.setItem('currentId', storedId);
    }
    const currentElement = document.getElementById(storedId);
    if (currentElement) {
        currentElement.classList.add('active');
    } else {
        const defaultRandom = document.getElementById('background-random');
        if (defaultRandom) defaultRandom.classList.add('active');
    }
}

function saveBackgroundSelection(background) {
    localStorage.setItem('selectedBackground', background);
}

function renderBackgroundThumbnails(backgroundList) {
    const container = document.getElementById('backgroundThumbnailContainer');
    if (!container) return;
    container.innerHTML = '';

    backgroundList.forEach(bgName => {
        const { fullUrl, thumbUrl } = resolveBackgroundImageUrls(bgName);
        const thumbnail = document.createElement('div');
        thumbnail.className = 'backgroundThumbnail';
        thumbnail.style.backgroundImage = `url('${thumbUrl}')`;
        thumbnail.id = bgName;

        // Fall back to full image if a newly added GitHub background has no separate thumbnail file
        const thumbProbe = new Image();
        thumbProbe.onerror = () => {
            thumbnail.style.backgroundImage = `url('${fullUrl}')`;
        };
        thumbProbe.src = thumbUrl;

        const title = document.createElement('p');
        title.className = 'imageTitle';
        title.textContent = getBackgroundDisplayName(bgName);
        thumbnail.appendChild(title);
        container.appendChild(thumbnail);
    });
}

const randomThumbsContainer = document.getElementById('backgroundThumbnailsRandom');
if (randomThumbsContainer) {
    randomThumbsContainer.addEventListener('click', () => {
        const checkedRadio = document.querySelector('input[name="backgroundRandomOption"]:checked');
        if (checkedRadio) {
            localStorage.setItem('selectedRandomOption', checkedRadio.id);
            localStorage.removeItem('selectedRandOption');
        }
    });
}

function restoreBackgroundRadioOption() {
    let selectedId = localStorage.getItem('selectedRandomOption');
    if (selectedId === null) {
        selectedId = localStorage.getItem('selectedRandOption');
        if (selectedId !== null) {
            localStorage.setItem('selectedRandomOption', selectedId);
            localStorage.removeItem('selectedRandOption');
        }
    }
    if (selectedId) {
        const selectedRadio = document.getElementById(selectedId);
        if (selectedRadio) selectedRadio.checked = true;
    }
}

function setupCustomBackgroundControls() {
    const customCard  = document.getElementById('background-custom');
    const customInput = document.getElementById('customBackgroundInput');
    const uploadBtn   = document.getElementById('buttonUploadCustomBg');
    const clearBtn    = document.getElementById('buttonClearCustomBg');
    const fileInput   = document.getElementById('customBgFileInput');
    const titleEl     = document.getElementById('customBackgroundTitle');

    function updateCustomCardPreview(url) {
        if (!customCard) return;
        if (url) {
            customCard.style.backgroundImage = `url('${url}')`;
            customCard.classList.remove('no-image');
            if (titleEl) titleEl.textContent = 'Custom';
        } else {
            customCard.style.backgroundImage = 'none';
            customCard.classList.add('no-image');
            if (titleEl) titleEl.textContent = '+ Upload';
        }
    }

    const currentCustomUrl = localStorage.getItem('customBackgroundUrl') || '';
    updateCustomCardPreview(currentCustomUrl);
    if (customInput && currentCustomUrl && !currentCustomUrl.startsWith('data:')) {
        customInput.value = currentCustomUrl;
    }

    function setCustomBackground(url) {
        if (!url) return;
        try {
            localStorage.setItem('customBackgroundUrl', url);
        } catch(e) {
            alert('Image is too large to store in browser storage. Please try a smaller image or an image URL.');
            return;
        }
        updateCustomCardPreview(url);

        const toggles = document.querySelectorAll('.backgroundThumbnail');
        toggles.forEach(elem => elem.classList.remove('active'));
        if (customCard) customCard.classList.add('active');
        localStorage.setItem('currentId', 'background-custom');
        saveBackgroundSelection('background-custom');

        if (typeof populateImportExportField === 'function') populateImportExportField();
    }

    if (customInput) {
        let timer = null;
        customInput.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const val = customInput.value.trim();
                if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
                    setCustomBackground(val);
                }
            }, 300);
        });
    }

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.value = '';
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                const rawData = evt.target && evt.target.result;
                if (!rawData) return;
                // Preserve full native resolution of uploaded image
                setCustomBackground(rawData);
                if (customInput) customInput.value = '';
            };
            reader.readAsDataURL(file);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('customBackgroundUrl');
            if (customInput) customInput.value = '';
            updateCustomCardPreview('');

            if (localStorage.getItem('selectedBackground') === 'background-custom') {
                const defaultRandom = document.getElementById('background-random');
                const toggles = document.querySelectorAll('.backgroundThumbnail');
                toggles.forEach(elem => elem.classList.remove('active'));
                if (defaultRandom) defaultRandom.classList.add('active');
                localStorage.setItem('currentId', 'background-random');
                saveBackgroundSelection('background-random');
            }
            if (typeof populateImportExportField === 'function') populateImportExportField();
        });
    }
}

renderBackgroundThumbnails(getBackgroundList());
restoreBackgroundRadioOption();
setupCustomBackgroundControls();
selectActiveBackground('.backgroundThumbnail');

fetchRemoteBackgroundList().then(({ list, changed }) => {
    if (!changed) return;
    renderBackgroundThumbnails(list);
    selectActiveBackground('.backgroundThumbnail');
});