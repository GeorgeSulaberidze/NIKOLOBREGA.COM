/* Adds admin products to category pages, keeping each page at 20 products. */
(async function () {
  const categories = ['leather', 'silvers', 'metals', 'woodens', 'acetate', 'plastics', 'watches'];
  const currentFile = location.pathname.split('/').pop().replace(/\.html$/i, '');
  const category = categories.find(name => currentFile === name
    || new RegExp(`^${name}(?:\\d+|-page-\\d+)$`, 'i').test(currentFile));
  const container = document.querySelector('#product1 .pro-container');
  if (!category || !container) return;

  const pageMatch = currentFile.match(new RegExp(`^${category}(?:-page-)?(\\d+)$`, 'i'));
  const pageNumber = pageMatch ? Number(pageMatch[1]) : 1;
  const pagination = document.querySelector('#pagination');

  function pageNumberFromPath(path, base) {
    const file = path.split('/').pop().replace(/\.html(?:\?.*)?$/i, '');
    if (file.toLowerCase() === base.toLowerCase()) return 1;
    const match = file.match(new RegExp(`^${base}(\\d+)$`, 'i'));
    return match ? Number(match[1]) : null;
  }

  function staticPagePaths(documentPage) {
    const pages = new Map([[1, `${category}.html`]]);
    documentPage.querySelectorAll('#pagination a[onclick]').forEach(link => {
      const match = link.getAttribute('onclick')?.match(/(?:window\.location\.href\s*=\s*)['"]([^'"]+\.html)['"]/i);
      if (!match) return;
      const number = pageNumberFromPath(match[1], category);
      if (number) pages.set(number, match[1]);
    });
    return pages;
  }

  function pageHref(number, basePageCount, pagePaths) {
    if (number <= basePageCount) return pagePaths.get(number) || (number === 1 ? `${category}.html` : `${category}${number}.html`);
    return category === 'woodens' ? `${category}${number}.html` : `${category}-page-${number}.html`;
  }

  function renderPagination(pageCount, basePageCount, pagePaths) {
    if (!pagination) return;
    pagination.replaceChildren();
    for (let number = 1; number <= pageCount; number += 1) {
      const link = document.createElement('a');
      link.href = pageHref(number, basePageCount, pagePaths);
      if (number === pageNumber) {
        link.className = 'p1';
        link.setAttribute('aria-current', 'page');
      }
      link.textContent = String(number);
      pagination.append(link);
    }
    if (pageNumber < pageCount) {
      const next = document.createElement('a');
      next.href = pageHref(pageNumber + 1, basePageCount, pagePaths);
      next.setAttribute('aria-label', 'Next page');
      const icon = document.createElement('i');
      icon.className = 'fal fa-long-arrow-alt-right';
      next.append(icon);
      pagination.append(next);
    }
  }

  function makeCard(product) {
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
    card.append(image, details, cartLink);
    return card;
  }

  try {
    const response = await fetch('products.json', { cache: 'no-store' });
    if (!response.ok) return;
    const allProducts = await response.json();
    const categoryProducts = allProducts.filter(product => product.category === category);

    let basePageCount = Number(document.body.dataset.catalogBasePages) || 0;
    let pagePaths = staticPagePaths(document);
    if (!basePageCount) basePageCount = Math.max(1, ...pagePaths.keys());

    const counts = await Promise.all(Array.from({ length: basePageCount }, async (_, index) => {
      const number = index + 1;
      let pageDocument;
      if (number === pageNumber) pageDocument = document;
      else {
        const path = pagePaths.get(number) || (number === 1 ? `${category}.html` : `${category}${number}.html`);
        const pageResponse = await fetch(path, { cache: 'no-store' });
        if (!pageResponse.ok) throw new Error(`Could not load ${path}`);
        pageDocument = new DOMParser().parseFromString(await pageResponse.text(), 'text/html');
      }
      return pageDocument.querySelectorAll('#product1 .pro-container > .pro').length;
    }));

    const capacities = counts.map(count => Math.max(0, 20 - count));
    const existingDynamicCapacity = capacities.reduce((sum, capacity) => sum + capacity, 0);
    const extraPages = Math.ceil(Math.max(0, categoryProducts.length - existingDynamicCapacity) / 20);
    const pageCount = basePageCount + extraPages;
    let offset = capacities.slice(0, Math.min(pageNumber - 1, basePageCount)).reduce((sum, capacity) => sum + capacity, 0);
    let capacity = capacities[pageNumber - 1];
    if (pageNumber > basePageCount) {
      offset = existingDynamicCapacity + (pageNumber - basePageCount - 1) * 20;
      capacity = 20;
    }

    const cards = categoryProducts.slice(offset, offset + (capacity || 0)).map(makeCard);
    container.prepend(...cards);
    renderPagination(pageCount, basePageCount, pagePaths);
  } catch (error) {
    console.info('New product list is available when the site is served over HTTP/HTTPS.', error);
  }
})();
