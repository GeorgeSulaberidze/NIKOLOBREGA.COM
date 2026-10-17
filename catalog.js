/* Adds products created in admin.html to category listings. */
(async function () {
  const page = location.pathname.split('/').pop().replace(/\.html$/i, '');
  const container = document.querySelector('#product1 .pro-container');
  if (!container) return;
  try {
    const response = await fetch('products.json', { cache: 'no-store' });
    if (!response.ok) return;
    const products = await response.json();
    products.filter(product => product.category === page).forEach(product => {
      const card = document.createElement('div');
      card.className = 'pro';
      card.addEventListener('click', () => { location.href = product.slug + '.html'; });
      const image = document.createElement('img'); image.src = product.images[0]; image.alt = product.name;
      const details = document.createElement('div'); details.className = 'des';
      const brand = document.createElement('span'); brand.textContent = 'NIKOLO BREGA';
      const name = document.createElement('h5'); name.textContent = product.name;
      const stars = document.createElement('div'); stars.className = 'star';
      for (let index = 0; index < 8; index += 1) {
        const star = document.createElement('i'); star.className = 'fas fa-star';
        stars.append(star);
      }
      const price = document.createElement('h4'); price.textContent = product.price + 'GEL';
      details.append(brand, name, stars, price);
      const cartLink = document.createElement('a'); cartLink.href = '#';
      cartLink.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); });
      const cartIcon = document.createElement('i'); cartIcon.className = 'fal fa-shopping-cart cart';
      cartLink.append(cartIcon);
      card.append(image, details, cartLink); container.append(card);
    });
  } catch (error) {
    console.info('New product list is available when the site is served over HTTP/HTTPS.');
  }
})();
