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
    if (button.dataset.switching === 'true') return;
    button.dataset.switching = 'true';
    button.classList.add('is-switching');

    window.setTimeout(() => {
        const link = document.createElement('a');
        link.className = 'messenger-link messenger-link-enter';
        link.href = 'https://m.me/581207708752069';
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'შესაძენად მოგვწერეთ მესენჯერში';
        button.replaceWith(link);
    }, 170);
}
