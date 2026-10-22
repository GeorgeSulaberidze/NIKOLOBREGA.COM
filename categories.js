(() => {
  const navbar = document.querySelector('#navbar');
  if (!navbar) return;

  fetch(`https://raw.githubusercontent.com/GeorgeSulaberidze/NIKOLOBREGA.COM/main/categories.json?${Date.now()}`, { cache: 'no-store' })
    .catch(() => fetch('categories.json', { cache: 'no-store' }))
    .then(response => response.ok ? response : fetch('categories.json', { cache: 'no-store' }))
    .then(response => {
      if (!response.ok) throw new Error(`categories.json: ${response.status}`);
      return response.json();
    })
    .then(categories => {
      if (!Array.isArray(categories)) return;
      const items = Array.from(navbar.querySelectorAll(':scope > li'));
      const homeItem = items.find(item => item.querySelector('a[href="index.html"]'));
      const aboutItem = items.find(item => item.querySelector('a[href="about.html"]'));
      if (!homeItem || !aboutItem
        || (homeItem.compareDocumentPosition(aboutItem) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) return;

      while (homeItem.nextElementSibling && homeItem.nextElementSibling !== aboutItem) {
        homeItem.nextElementSibling.remove();
      }

      const currentFile = location.pathname.split('/').pop().replace(/\.html$/i, '');
      categories.forEach(category => {
        if (!category || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(category.slug) || !category.name) return;
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `${category.slug}.html`;
        link.textContent = category.name;
        if (new RegExp(`^${category.slug}(?:\\d+|-page-\\d+)?$`, 'i').test(currentFile)) {
          link.className = 'active';
          if (currentFile.toLowerCase() === category.slug.toLowerCase()) document.title = `${category.name} | NIKOLO BREGA`;
        }
        item.append(link);
        navbar.insertBefore(item, aboutItem);
      });
    })
    .catch(error => console.info('Category navigation could not be refreshed.', error));
})();
