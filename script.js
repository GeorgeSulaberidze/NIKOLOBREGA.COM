const bar = document.getElementById('bar');
const close = document.getElementById('close');
const nav = document.getElementById('navbar');

if (nav) {
    const categoriesScript = document.createElement('script');
    categoriesScript.src = 'categories.js';
    document.body.append(categoriesScript);
}

const pendingImages = [];
let imageLoadActive = false;
let loadingMessageTimer = null;
let loadingMessage = null;

function updateProductLoadingMessage() {
    if (imageLoadActive || pendingImages.length > 0) {
        if (loadingMessageTimer || loadingMessage) return;
        loadingMessageTimer = window.setTimeout(() => {
            loadingMessageTimer = null;
            if (!imageLoadActive && pendingImages.length === 0) return;

            if (!document.getElementById('product-image-loading-style')) {
                const style = document.createElement('style');
                style.id = 'product-image-loading-style';
                style.textContent = `
                    @keyframes product-image-loading-blink { 50% { opacity: .35; } }
                    #product-image-loading-message {
                        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                        z-index: 10000; padding: 12px 22px; border-radius: 8px;
                        background: rgba(20, 20, 20, .82); color: #fff;
                        font-family: inherit; font-size: 18px; font-weight: 600; line-height: 1.4;
                        box-shadow: 0 4px 18px rgba(0, 0, 0, .2);
                        pointer-events: none; animation: product-image-loading-blink 1s ease-in-out infinite;
                    }
                    @media (prefers-reduced-motion: reduce) {
                        #product-image-loading-message { animation: none; }
                    }
                `;
                document.head.append(style);
            }

            loadingMessage = document.createElement('div');
            loadingMessage.id = 'product-image-loading-message';
            loadingMessage.setAttribute('role', 'status');
            loadingMessage.setAttribute('aria-live', 'polite');
            loadingMessage.textContent = 'იტვირთება...';
            document.body.append(loadingMessage);
        }, 1200);
        return;
    }

    if (loadingMessageTimer) {
        window.clearTimeout(loadingMessageTimer);
        loadingMessageTimer = null;
    }
    loadingMessage?.remove();
    loadingMessage = null;
}

function processNextImage() {
    if (imageLoadActive) return;
    if (pendingImages.length === 0) {
        updateProductLoadingMessage();
        return;
    }
    const image = pendingImages.shift();
    const source = image.dataset.src;
    if (!source) {
        processNextImage();
        return;
    }

    imageLoadActive = true;
    updateProductLoadingMessage();
    image.loading = 'eager';
    image.decoding = 'async';
    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        image.removeEventListener('load', finish);
        image.removeEventListener('error', finish);
        const decoded = typeof image.decode === 'function' ? image.decode().catch(() => {}) : Promise.resolve();
        decoded.finally(() => {
            imageLoadActive = false;
            processNextImage();
        });
    };
    image.addEventListener('load', finish);
    image.addEventListener('error', finish);
    image.src = source;
    if (image.complete) finish();
}

window.enqueueImages = images => {
    Array.from(images).forEach(image => {
        if (!image.dataset.src || image.dataset.imageQueued === 'true') return;
        image.dataset.imageQueued = 'true';
        pendingImages.push(image);
    });
    updateProductLoadingMessage();
    processNextImage();
};

const catalogScriptExists = Array.from(document.scripts).some(script =>
    /(?:^|\/)catalog\.js(?:\?|$)/i.test(script.getAttribute('src') || '')
);
if (!catalogScriptExists) {
    const imageOrder = Array.from(document.querySelectorAll('img[data-src]'));
    imageOrder.sort((first, second) => {
        const priority = image => image.id === 'MainImg' ? 0 : image.closest('.pro') ? 1 : 2;
        return priority(first) - priority(second);
    });
    window.enqueueImages(imageOrder);
}

if (bar) {
    
   bar.addEventListener('click', () => {
   nav.classList.add('active');
    })
}
if (close) {
    
   close.addEventListener('click', () => {
   nav.classList.remove('active');
    })
}

function showFrame() {
    document.getElementById('maintenanceFrame').style.display = 'block';
}

function hideFrame() {
    document.getElementById('maintenanceFrame').style.display = 'none';
}

function showMessengerButton(button) {
    if (button.dataset.messengerReady === 'true') {
        window.open('https://m.me/581207708752069', '_blank', 'noopener');
        return;
    }

    button.dataset.messengerReady = 'true';
    button.classList.add('is-switching');
    window.setTimeout(() => {
        button.textContent = 'შესაძენად მოგვწერეთ მესენჯერში';
        button.classList.remove('normal', 'is-switching');
        button.classList.add('messenger-link', 'messenger-link-enter');
    }, 170);
}

