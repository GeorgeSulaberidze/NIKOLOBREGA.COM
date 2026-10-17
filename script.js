const bar = document.getElementById('bar');
const close = document.getElementById('close');
const nav = document.getElementById('navbar');

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

document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('.add-to-cart-trigger');
    if (!button) return;

    event.preventDefault();
    showMessengerButton(button);
});
