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
