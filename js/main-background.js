// Background Manager
(function() {
    const bgImageElem = document.getElementById('backgroundImage');

    function applyBlurIntensity() {
        if (!bgImageElem) return;
        const blur = localStorage.getItem('blurIntensity') ?? 4;
        bgImageElem.style.webkitFilter = `blur(${blur}px)`;
        bgImageElem.style.filter = `blur(${blur}px)`;
    }

    function getRandomSettingOption() {
        let option = localStorage.getItem('selectedRandomOption');
        if (option === null) {
            option = localStorage.getItem('selectedRandOption');
            if (option !== null) {
                localStorage.setItem('selectedRandomOption', option);
                localStorage.removeItem('selectedRandOption');
            }
        }
        return option;
    }

    // Clean up any legacy fixed-16:9 previews so they don't appear stretched
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith('backgroundPreview_')) {
                localStorage.removeItem(key);
            }
        }
    } catch (e) {}

    function cacheBackgroundPreview(cleanSource, imgElement) {
        const cacheKey = `backgroundPreviewV2_${cleanSource}`;
        if (localStorage.getItem(cacheKey)) return;
        const naturalW = imgElement.naturalWidth;
        const naturalH = imgElement.naturalHeight;
        if (!naturalW || !naturalH) return;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = 720;
            canvas.height = Math.max(1, Math.round(720 * (naturalH / naturalW)));
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Match exact source aspect ratio to canvas dimensions so background-size: cover never shifts
            const canvasRatio = canvas.width / canvas.height;
            const sourceRatio = naturalW / naturalH;
            let sx = 0, sy = 0, sw = naturalW, sh = naturalH;
            if (sourceRatio > canvasRatio) {
                sw = naturalH * canvasRatio;
                sx = (naturalW - sw) / 2;
            } else if (sourceRatio < canvasRatio) {
                sh = naturalW / canvasRatio;
                sy = (naturalH - sh) / 2;
            }

            ctx.drawImage(imgElement, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
            if (dataUrl && dataUrl.startsWith('data:image/jpeg')) {
                localStorage.setItem(cacheKey, dataUrl);
            }
        } catch (e) {
            // Ignore storage quota or CORS errors
        }
    }

    function setBackgroundSource(source) {
        const cleanSource = normalizeBackgroundName(source);
        const { fullUrl: url } = resolveBackgroundImageUrls(cleanSource);
        const cacheKey = `backgroundPreviewV2_${cleanSource}`;
        const cachedPreview = localStorage.getItem(cacheKey);

        // Apply immediately and synchronously so the first painted frame already has the background
        if (cachedPreview) {
            bgImageElem.style.backgroundImage = `url('${url}'), url('${cachedPreview}')`;
        } else {
            bgImageElem.style.backgroundImage = `url('${url}')`;
        }

        const testImg = new Image();
        testImg.onload = () => {
            bgImageElem.style.backgroundImage = `url('${url}')`;
            if (!localStorage.getItem(cacheKey)) {
                const corsImg = new Image();
                corsImg.crossOrigin = 'anonymous';
                corsImg.onload = () => cacheBackgroundPreview(cleanSource, corsImg);
                corsImg.src = url;
            }
        };
        testImg.onerror = () => {
            if (!cachedPreview) {
                bgImageElem.style.backgroundImage = 'none';
                bgImageElem.style.backgroundColor = 'var(--dark1)';
            }
        };
        testImg.src = url;
    }

    function applyBackground(isInitialLoad) {
        applyBlurIntensity();
        let storedBackground = normalizeBackgroundName(localStorage.getItem('selectedBackground') || 'background-random');
        if (localStorage.getItem('selectedBackground') === 'Autumm_Leaves') {
            localStorage.setItem('selectedBackground', 'Autumn_Leaves');
        }
        const solidBackgroundHex = solidBackgroundIds[storedBackground];
        const randomSettingOption = getRandomSettingOption();
        const headerElement = document.getElementById('headerBar');

        document.body.classList.remove('light-background', 'dark-solid-background');
        if (headerElement) headerElement.style.background = '';

        if (!storedBackground || storedBackground === 'background-random' || storedBackground === 'bg-rand') {
            executeBackgroundBehavior(randomSettingOption, isInitialLoad);
        } else if (solidBackgroundHex) {
            bgImageElem.style.backgroundColor = solidBackgroundHex;
            bgImageElem.style.backgroundImage = 'none';
            if (headerElement) headerElement.style.background = 'none';
            if (solidBackgroundHex.toUpperCase() === '#FFFFFF') {
                document.body.classList.add('light-background');
            } else {
                document.body.classList.add('dark-solid-background');
            }
        } else if (storedBackground === 'background-custom') {
            const customUrl = localStorage.getItem('customBackgroundUrl');
            if (customUrl) {
                bgImageElem.style.backgroundImage = `url('${customUrl}')`;
            } else {
                executeBackgroundBehavior(randomSettingOption, isInitialLoad);
            }
        } else {
            setBackgroundSource(storedBackground);
        }
    }

    // Run immediately right after #backgroundImage is parsed (before the rest of the body renders)
    applyBackground(true);

    // Defer syncing remote list & preloading until after initial page load so it never competes with the active wallpaper
    window.addEventListener('load', function() {
        const schedulePreload = window.requestIdleCallback || function(cb) { setTimeout(cb, 300); };
        schedulePreload(async function() {
            const { list } = await fetchRemoteBackgroundList();
            preloadBackgroundImages(list);
        });
    });

    window.addEventListener('storage', function(e) {
        if (e.key === 'selectedBackground' || e.key === 'selectedRandomOption' || e.key === 'dailyBackground' || e.key === 'blurIntensity' || e.key === 'customBackgroundUrl') {
            applyBackground(false);
        }
    });

    function preloadBackgroundImages(images) {
        images.forEach(image => {
            const { fullUrl, thumbUrl } = resolveBackgroundImageUrls(image);
            // Preload full background wallpaper into standard browser cache used by CSS background-image
            const img = new Image();
            img.src = fullUrl;

            // Preload thumbnail for settings page
            const thumb = new Image();
            thumb.src = thumbUrl;
        });
    }

    function executeBackgroundBehavior(setting, isInitialLoad) {
        const dailyBackground = normalizeBackgroundName(localStorage.getItem('dailyBackground'));
        const sessionBackground = normalizeBackgroundName(sessionStorage.getItem('sessionBackground'));

        switch (setting) {
            case 'background-daily':
            case 'bg-daily':
            case null:
                if (isDailyBackgroundChangeDue()) {
                    selectRandomBackground();
                } else if (dailyBackground) {
                    setBackgroundSource(dailyBackground);
                } else {
                    selectRandomBackground();
                }
                break;

            case 'background-new-tab':
            case 'bg-new-tab':
                if (sessionBackground) {
                    setBackgroundSource(sessionBackground);
                } else {
                    selectRandomBackground();
                }
                break;

            case 'background-refresh':
            case 'bg-refresh':
                if (isInitialLoad || !sessionBackground) {
                    selectRandomBackground();
                } else {
                    setBackgroundSource(sessionBackground);
                }
                break;
        }
    }

    function selectRandomBackground() {
        const backgroundList = getBackgroundList();
        const randomIndex = Math.floor(Math.random() * backgroundList.length);
        const randomBg = backgroundList[randomIndex];
        localStorage.setItem('dailyBackground', randomBg);
        sessionStorage.setItem('sessionBackground', randomBg);
        setBackgroundSource(randomBg);
    }

    function isDailyBackgroundChangeDue() {
        let storedDate = localStorage.getItem('dateChange');
        let currentDate = new Date();
        let targetHour = 3;
        let targetDate = new Date();
        if (currentDate.getHours() < targetHour) {
            targetDate.setDate(targetDate.getDate() - 1);
        }
        targetDate.setHours(3,0,0,0);

        let lastChangeDate = storedDate ? new Date(storedDate) : null;
        let timeSinceTargetHour = (currentDate - targetDate) / (60 * 60 * 1000);
        let timeSinceLastChange = lastChangeDate ? (currentDate - lastChangeDate) / (1000 * 60 * 60) : 999;
        let updateDue = timeSinceLastChange > timeSinceTargetHour;

        if (updateDue || !storedDate) {
            localStorage.setItem('dateChange', currentDate.toISOString());
            return true;
        }
        return false;
    }
})();