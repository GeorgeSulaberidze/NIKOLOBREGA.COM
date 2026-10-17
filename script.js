const bar = document.getElementById('bar');
const close = document.getElementById('close');
const nav = document.getElementById('navbar');

const pendingImages = [];
let imageLoadActive = false;

function processNextImage() {
    if (imageLoadActive || pendingImages.length === 0) return;
    const image = pendingImages.shift();
    const source = image.dataset.src;
    if (!source) return processNextImage();

    imageLoadActive = true;
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

