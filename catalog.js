/* Combines static catalog items and admin products into pages of 20. */
(async function () {
  let categories;
  try {
    let categoryResponse;
    try {
      categoryResponse = await fetch(`https://raw.githubusercontent.com/GeorgeSulaberidze/NIKOLOBREGA.COM/main/categories.json?${Date.now()}`, { cache: 'no-store' });
    } catch {
      categoryResponse = await fetch('categories.json', { cache: 'no-store' });
    }
    if (!categoryResponse.ok) categoryResponse = await fetch('categories.json', { cache: 'no-store' });
    if (!categoryResponse.ok) return;
    categories = (await categoryResponse.json()).map(category => category.slug);
  } catch {
    return;
  }
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
    const image = document.createElement('img'); image.dataset.src = product.images[0]; image.alt = product.name;
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

    const staticCards = (await Promise.all(Array.from({ length: basePageCount }, async (_, index) => {
      const number = index + 1;
      let pageDocument;
      if (number === pageNumber) pageDocument = document;
      else {
        const path = pagePaths.get(number) || (number === 1 ? `${category}.html` : `${category}${number}.html`);
        const pageResponse = await fetch(path, { cache: 'no-store' });
        if (!pageResponse.ok) throw new Error(`Could not load ${path}`);
        pageDocument = new DOMParser().parseFromString(await pageResponse.text(), 'text/html');
      }
      return Array.from(pageDocument.querySelectorAll('#product1 .pro-container > .pro'));
    }))).flat();

    const adminSlugs = new Set(categoryProducts.map(product => `${product.slug}.html`.toLowerCase()));
    const catalogCards = staticCards.filter(card => {
      const target = card.getAttribute('onclick')?.match(/(?:location\.href|window\.location\.href)\s*=\s*['"]([^'"]+)['"]/i)?.[1];
      return !target || !adminSlugs.has(target.split('/').pop().toLowerCase());
    });
    const allCards = [...categoryProducts.map(makeCard), ...catalogCards];
    const pageCount = Math.max(1, Math.ceil(allCards.length / 20));
    const pageCards = allCards.slice((pageNumber - 1) * 20, pageNumber * 20);
    container.replaceChildren(...pageCards);
    renderPagination(pageCount, basePageCount, pagePaths);
  } catch (error) {
    console.info('New product list is available when the site is served over HTTP/HTTPS.', error);
  } finally {
    if (window.enqueueImages) {
      const gridImages = Array.from(container.querySelectorAll('img[data-src]'));
      const queued = new Set(gridImages);
      window.enqueueImages([...gridImages, ...Array.from(document.querySelectorAll('img[data-src]')).filter(image => !queued.has(image))]);
    }
  }
})();
