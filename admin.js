(() => {
  const form = document.querySelector('#product-form');
  const photos = document.querySelector('#photos');
  const preview = document.querySelector('#preview');
  const message = document.querySelector('#message');
  const slugInput = document.querySelector('#slug');
  const tokenInput = document.querySelector('#github-token');
  const editForm = document.querySelector('#edit-form');
  const editSelect = document.querySelector('#edit-product-select');
  const editPhotos = document.querySelector('#edit-photos');
  const editPreview = document.querySelector('#edit-preview');
  const editMessage = document.querySelector('#edit-message');
  const categorySelect = document.querySelector('#category');
  const categoryForm = document.querySelector('#category-form');
  const categoryNameInput = document.querySelector('#category-name');
  const categorySlugInput = document.querySelector('#category-slug');
  const categoryOriginalSlug = document.querySelector('#category-original-slug');
  const categoryList = document.querySelector('#category-list');
  const categoriesMessage = document.querySelector('#categories-message');
  const saveCategoryButton = document.querySelector('#save-category');
  const cancelCategoryEditButton = document.querySelector('#cancel-category-edit');
  let selectedFiles = [];
  let slugWasEdited = false;
  let editFiles = [];
  let editImages = [];
  let productsCache = [];
  let categoriesCache = [];
  let categoriesLoading = false;
  let categoryOrderSaving = false;
  let editingProduct = null;

  const setMessage = (text, type) => {
    message.textContent = text;
    message.className = `message show ${type}`;
  };
  const setEditMessage = (text, type) => {
    editMessage.textContent = text;
    editMessage.className = `message show ${type}`;
  };
  const safeSlug = value => value.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  async function optimizeImage(file) {
    if (!window.createImageBitmap || !HTMLCanvasElement.prototype.toBlob) return file;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
      if (!blob || blob.size >= file.size) return file;
      const baseName = file.name.replace(/\.[^.]+$/, '');
      return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() });
    } catch {
      return file;
    } finally {
      bitmap?.close();
    }
  }

  const githubOwner = 'GeorgeSulaberidze';
  const githubRepo = 'NIKOLOBREGA.COM';
  const githubBranch = 'main';

  async function githubRequest(token, endpoint, options = {}) {
    const response = await fetch(`https://api.github.com/repos/${githubOwner}/${githubRepo}/${endpoint}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
    const result = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) throw new Error('GitHub token არასწორია ან ვადაგასულია.');
      if (response.status === 403) throw new Error('GitHub token-ს არ აქვს რეპოზიტორიაში Contents write წვდომა.');
      throw new Error(result?.message || `GitHub ატვირთვა ვერ შესრულდა (${response.status}).`);
    }
    return result;
  }

  function base64FromBytes(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  function textFromBase64(encoded) {
    const binary = atob(encoded.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function createBlob(token, content, isBinary = false) {
    const bytes = isBinary ? new Uint8Array(await content.arrayBuffer()) : new TextEncoder().encode(content);
    const blob = await githubRequest(token, 'git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: base64FromBytes(bytes), encoding: 'base64' })
    });
    return blob.sha;
  }

  async function uploadProduct(token, files, commitMessage = '') {
    const reference = await githubRequest(token, `git/ref/heads/${githubBranch}`);
    const parentCommit = await githubRequest(token, `git/commits/${reference.object.sha}`);
    const blobs = [];
    for (const file of files) {
      if (file.delete) {
        blobs.push({ path: file.path, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      blobs.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: await createBlob(token, file.content, file.binary)
      });
    }
    const tree = await githubRequest(token, 'git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: blobs })
    });
    const commit = await githubRequest(token, 'git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: commitMessage || `Add product ${files.find(file => file.path.endsWith('.html'))?.path || ''}`,
        tree: tree.sha,
        parents: [reference.object.sha]
      })
    });
    await githubRequest(token, `git/refs/heads/${githubBranch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false })
    });
  }

  document.querySelector('#name').addEventListener('input', event => {
    if (!slugWasEdited) slugInput.value = safeSlug(event.target.value);
  });
  slugInput.addEventListener('input', () => { slugWasEdited = true; });

  const renderPreview = () => {
    preview.replaceChildren();
    selectedFiles.forEach((file, index) => {
      const item = document.createElement('div'); item.className = 'preview-item';
      const img = document.createElement('img'); img.src = URL.createObjectURL(file); img.alt = file.name;
      img.onload = () => URL.revokeObjectURL(img.src);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×';
      remove.setAttribute('aria-label', 'ფოტოს წაშლა');
      remove.addEventListener('click', () => { selectedFiles.splice(index, 1); renderPreview(); });
      item.append(img, remove); preview.append(item);
    });
  };

  photos.addEventListener('change', async () => {
    const incoming = Array.from(photos.files || []);
    if (incoming.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setMessage('გამოიყენეთ JPG, PNG ან WebP ფორმატის ფოტოები.', 'error'); photos.value = ''; return;
    }
    if (incoming.some(file => file.size > 10 * 1024 * 1024)) {
      setMessage('თითოეული ფოტო 10 MB-ზე ნაკლები უნდა იყოს.', 'error'); photos.value = ''; return;
    }
    photos.disabled = true;
    setMessage('ფოტოები ატვირთვამდე მცირდება…', 'info');
    const optimized = await Promise.all(incoming.map(optimizeImage));
    selectedFiles = [...selectedFiles, ...optimized].slice(0, 4);
    photos.disabled = false;
    photos.value = '';
    renderPreview();
    message.className = 'message';
  });

  async function makeProductPage(product) {
    const response = await fetch('y3.html', { cache: 'no-store' });
    if (!response.ok) throw new Error('y3.html შაბლონი ვერ ჩაიტვირთა.');
    const template = new DOMParser().parseFromString(await response.text(), 'text/html');
    const images = product.images;
    const imageElements = template.querySelectorAll('.small-img');
    template.title = `${product.name} | NIKOLO BREGA`;
    const mainImage = template.querySelector('#MainImg');
    mainImage.removeAttribute('src');
    mainImage.dataset.src = images[0] || '';
    mainImage.setAttribute('alt', product.name);
    mainImage.setAttribute('decoding', 'async');
    imageElements.forEach((image, index) => {
      image.removeAttribute('src');
      image.dataset.src = images[index] || '';
      image.setAttribute('alt', `${product.name} — ფოტო ${index + 1}`);
      image.setAttribute('loading', 'lazy');
      image.setAttribute('decoding', 'async');
      image.closest('.small-img-col').hidden = !images[index];
    });
    template.querySelector('.single-pro-details h6').textContent = ` Home / ${product.name}`;
    template.querySelector('.single-pro-details h2').textContent = `${product.price}GEL`;
    const description = escapeHtml(product.description || '').replace(/\n/g, '<br>');
    template.querySelector('.single-pro-details span').innerHTML = description;
    return `<!DOCTYPE html>\n${template.documentElement.outerHTML}`;
  }

  async function makeCategoryPageFiles(category, products) {
    let baseText;
    const baseResponse = await fetch(`${category}.html`, { cache: 'no-store' });
    if (baseResponse.ok) baseText = await baseResponse.text();
    else {
      const baseFile = await githubRequest(tokenInput.value.trim(), `contents/${category}.html?ref=${githubBranch}`);
      baseText = textFromBase64(baseFile.content);
    }
    const baseDocument = new DOMParser().parseFromString(baseText, 'text/html');
    const pagePaths = new Map([[1, `${category}.html`]]);
    baseDocument.querySelectorAll('#pagination a[onclick]').forEach(link => {
      const match = link.getAttribute('onclick')?.match(/window\.location\.href\s*=\s*['"]([^'"]+\.html)['"]/i);
      if (!match) return;
      const file = match[1].split('/').pop();
      const pageMatch = file.match(new RegExp(`^${category}(\\d*)\\.html$`, 'i'));
      if (!pageMatch) return;
      pagePaths.set(Number(pageMatch[1] || 1), file);
    });
    const basePageCount = Math.max(1, ...pagePaths.keys());
    const pageDocuments = [];
    for (let number = 1; number <= basePageCount; number += 1) {
      let pageDocument = baseDocument;
      if (number !== 1) {
        const pagePath = pagePaths.get(number) || `${category}${number}.html`;
        const pageResponse = await fetch(pagePath, { cache: 'no-store' });
        if (!pageResponse.ok) throw new Error(`${pagePath} კატეგორიის გვერდი ვერ ჩაიტვირთა.`);
        pageDocument = new DOMParser().parseFromString(await pageResponse.text(), 'text/html');
      }
      pageDocuments.push(pageDocument);
    }

    const staticCards = pageDocuments.flatMap(page => Array.from(page.querySelectorAll('#product1 .pro-container > .pro')));
    const categoryProducts = products.filter(product => product.category === category);
    const productSlugs = new Set(categoryProducts.map(product => `${product.slug}.html`.toLowerCase()));
    const replacedStaticCount = staticCards.filter(card => {
      const target = card.getAttribute('onclick')?.match(/(?:location\.href|window\.location\.href)\s*=\s*['"]([^'"]+)['"]/i)?.[1];
      return target && productSlugs.has(target.split('/').pop().toLowerCase());
    }).length;
    const totalProducts = staticCards.length - replacedStaticCount + categoryProducts.length;
    const extraPages = Math.max(0, Math.ceil(totalProducts / 20) - basePageCount);
    if (!extraPages) return [];

    const template = pageDocuments[pageDocuments.length - 1];
    const files = [];
    for (let pageNumber = basePageCount + 1; pageNumber <= basePageCount + extraPages; pageNumber += 1) {
      const page = new DOMParser().parseFromString(template.documentElement.outerHTML, 'text/html');
      page.querySelectorAll('#product1 .pro-container > .pro').forEach(card => card.remove());
      page.body.dataset.catalogBasePages = String(basePageCount);
      if (!Array.from(page.scripts).some(script => /(?:^|\/)catalog\.js(?:\?|$)/i.test(script.getAttribute('src') || ''))) {
        const catalogScript = page.createElement('script');
        catalogScript.src = 'catalog.js';
        page.body.append(catalogScript);
      }
      const path = category === 'woodens'
        ? `${category}${pageNumber}.html`
        : `${category}-page-${pageNumber}.html`;
      files.push({ path, content: `<!DOCTYPE html>\n${page.documentElement.outerHTML}` });
    }
    return files;
  }

  async function loadProductsForEdit() {
    let response;
    try {
      response = await fetch(`https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${githubBranch}/products.json?${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`products.json: ${response.status}`);
      productsCache = await response.json();
    } catch (publicReadError) {
      try {
        const file = await githubRequest(tokenInput.value.trim(), 'contents/products.json?ref=main');
        productsCache = JSON.parse(textFromBase64(file.content));
      } catch (privateReadError) {
        throw new Error(`პროდუქტების სია ვერ ჩაიტვირთა. შეამოწმეთ კავშირი და GitHub token. ${privateReadError.message || publicReadError.message}`);
      }
    }
    if (!Array.isArray(productsCache)) throw new Error('პროდუქტების სია არასწორია.');
    const previous = editSelect.value;
    editSelect.replaceChildren(new Option('აირჩიეთ პროდუქტი', ''));
    productsCache.forEach(product => editSelect.add(new Option(`${product.name} · ${product.price} GEL`, product.slug)));
    editSelect.value = productsCache.some(product => product.slug === previous) ? previous : '';
    if (editSelect.value) showEditProduct(); else {
      editForm.hidden = true;
      document.querySelector('#edit-product-meta').textContent = `${productsCache.length} პროდუქტი`;
    }
  }

  function setCategoryMessage(text, type) {
    categoriesMessage.textContent = text;
    categoriesMessage.className = `message show ${type}`;
  }

  function categorySlugFromName(value) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  }

  function updateProductCategoryOptions() {
    const selected = categorySelect.value;
    categorySelect.replaceChildren(...categoriesCache.map(category => new Option(category.name, category.slug)));
    categorySelect.value = categoriesCache.some(category => category.slug === selected) ? selected : (categoriesCache[0]?.slug || '');
  }

  function resetCategoryForm() {
    categoryForm.reset();
    categoryOriginalSlug.value = '';
    categorySlugWasEdited = false;
    saveCategoryButton.textContent = 'გვერდის დამატება';
    cancelCategoryEditButton.hidden = true;
    categoriesMessage.className = 'message';
  }

  function renderCategoryList() {
    categoryList.replaceChildren();
    categoriesCache.forEach((category, index) => {
      const row = document.createElement('div');
      row.className = 'category-entry';
      const details = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = category.name;
      const slug = document.createElement('small'); slug.textContent = `${category.slug}.html`;
      details.append(name, slug);
      const actions = document.createElement('div'); actions.className = 'category-actions';
      const moveUp = document.createElement('button');
      moveUp.type = 'button'; moveUp.className = 'secondary category-move'; moveUp.textContent = '↑';
      moveUp.setAttribute('aria-label', `Move ${category.name} up`);
      moveUp.disabled = index === 0 || categoryOrderSaving;
      moveUp.addEventListener('click', () => moveCategory(category.slug, -1));
      const moveDown = document.createElement('button');
      moveDown.type = 'button'; moveDown.className = 'secondary category-move'; moveDown.textContent = '↓';
      moveDown.setAttribute('aria-label', `Move ${category.name} down`);
      moveDown.disabled = index === categoriesCache.length - 1 || categoryOrderSaving;
      moveDown.addEventListener('click', () => moveCategory(category.slug, 1));
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'secondary'; edit.textContent = 'შეცვლა';
      edit.addEventListener('click', () => {
        categoryOriginalSlug.value = category.slug;
        categoryNameInput.value = category.name;
        categorySlugInput.value = category.slug;
        categorySlugWasEdited = false;
        saveCategoryButton.textContent = 'შენახვა';
        cancelCategoryEditButton.hidden = false;
        categoriesMessage.className = 'message';
        categoryNameInput.focus();
      });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger'; remove.textContent = 'წაშლა';
      remove.addEventListener('click', () => deleteCategory(category));
      actions.append(moveUp, moveDown, edit, remove);
      row.append(details, actions);
      categoryList.append(row);
    });
  }

  async function moveCategory(slug, offset) {
    if (categoryOrderSaving) return;
    const from = categoriesCache.findIndex(category => category.slug === slug);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= categoriesCache.length) return;
    const token = tokenInput.value.trim();
    if (!token) return setCategoryMessage('გვერდების თანმიმდევრობის შესაცვლელად შეიყვანეთ GitHub token.', 'error');
    const previousCategories = categoriesCache;
    const reordered = [...categoriesCache];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    categoriesCache = reordered;
    categoryOrderSaving = true;
    renderCategoryList();
    try {
      const latest = await readRepositoryJson(token, 'categories.json');
      const order = new Map(reordered.map((category, index) => [category.slug, index]));
      const nextCategories = [...latest].sort((a, b) =>
        (order.get(a.slug) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.slug) ?? Number.MAX_SAFE_INTEGER));
      await uploadProduct(token, [{ path: 'categories.json', content: JSON.stringify(nextCategories, null, 2) }], 'Reorder categories');
      categoriesCache = nextCategories;
      updateProductCategoryOptions();
      setCategoryMessage('გვერდების თანმიმდევრობა ყველა გვერდზე შენახულია.', 'success');
    } catch (error) {
      categoriesCache = previousCategories;
      setCategoryMessage(error.message || 'თანმიმდევრობის შენახვა ვერ მოხერხდა.', 'error');
    } finally {
      categoryOrderSaving = false;
      renderCategoryList();
    }
  }

  async function loadCategoryList() {
    if (categoriesLoading) return;
    categoriesLoading = true;
    try {
      let categories;
      try {
        const remote = await fetch(`https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${githubBranch}/categories.json?${Date.now()}`, { cache: 'no-store' });
        if (!remote.ok) throw new Error(`categories.json: ${remote.status}`);
        categories = await remote.json();
      } catch (remoteError) {
        const local = await fetch(`categories.json?${Date.now()}`, { cache: 'no-store' });
        if (!local.ok) throw new Error(`Could not load categories.json (${local.status}). ${remoteError.message}`);
        categories = await local.json();
      }
      if (!Array.isArray(categories)) throw new Error('categories.json must contain a list.');
      categoriesCache = categories;
      renderCategoryList();
      updateProductCategoryOptions();
    } finally {
      categoriesLoading = false;
    }
  }

  async function readRepositoryJson(token, path) {
    const file = await githubRequest(token, `contents/${path}?ref=${githubBranch}`);
    return JSON.parse(textFromBase64(file.content));
  }

  async function listRepositoryFiles(token) {
    return githubRequest(token, `contents?ref=${githubBranch}`);
  }

  function renameCategoryPageMarkup(markup, oldSlug, newSlug) {
    return markup
      .replace(new RegExp(`(^|[^a-z0-9-])${oldSlug}(\\d+\\.html)`, 'gi'), (_, prefix, suffix) => `${prefix}${newSlug}${suffix}`)
      .split(`${oldSlug}.html`).join(`${newSlug}.html`)
      .split(`${oldSlug}-page-`).join(`${newSlug}-page-`);
  }

  function linkedCategoryPages(html, slug, rootFiles) {
    const page = new DOMParser().parseFromString(html, 'text/html');
    const candidates = Array.from(page.querySelectorAll('#pagination a[onclick]')).flatMap(link => {
      const match = link.getAttribute('onclick')?.match(/(?:window\.location\.href\s*=\s*)['"]([^'"]+\.html)['"]/i);
      return match ? [match[1].split('/').pop()] : [];
    });
    const pagePattern = new RegExp(`^${slug}(?:\\d+|-page-\\d+)\\.html$`, 'i');
    const existingNames = new Set(rootFiles.filter(file => file.type === 'file').map(file => file.name));
    return [...new Set(candidates.filter(name => pagePattern.test(name) && existingNames.has(name)))];
  }

  async function makeEmptyCategoryPage(slug) {
    const response = await fetch('accessories.html', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load the blank category page template.');
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    page.querySelectorAll('#product1 .pro-container > .pro').forEach(card => card.remove());
    page.querySelector('#pagination')?.replaceChildren();
    page.body.dataset.catalogBasePages = '1';
    if (!Array.from(page.scripts).some(script => /(?:^|\/)catalog\.js(?:\?|$)/i.test(script.getAttribute('src') || ''))) {
      const script = page.createElement('script'); script.src = 'catalog.js'; page.body.append(script);
    }
    page.title = `${slug} | NIKOLO BREGA`;
    return `<!doctype html>\n${page.documentElement.outerHTML}`;
  }

  async function deleteCategory(category) {
    if (!confirm(`მენიუდან წაიშალოს გვერდი „${category.name}“? პროდუქტები შენახული დარჩება, მაგრამ კატეგორიის გვერდზე აღარ გამოჩნდება.`)) return;
    const token = tokenInput.value.trim();
    if (!token) return setCategoryMessage('გვერდების შესაცვლელად შეიყვანეთ GitHub token.', 'error');
    const removeButton = Array.from(categoryList.querySelectorAll('.danger')).find(button => button.textContent === 'წაშლა' && button.closest('.category-entry')?.querySelector('strong')?.textContent === category.name);
    if (removeButton) removeButton.disabled = true;
    try {
      const categories = await readRepositoryJson(token, 'categories.json');
      if (categories.length <= 1) throw new Error('მინიმუმ ერთი კატეგორიის გვერდი უნდა დარჩეს.');
      const rootFiles = await listRepositoryFiles(token);
      const pageFile = await githubRequest(token, `contents/${category.slug}.html?ref=${githubBranch}`);
      const baseContent = textFromBase64(pageFile.content);
      const linkedPages = linkedCategoryPages(baseContent, category.slug, rootFiles);
      const generatedPages = rootFiles.filter(file => file.type === 'file' && new RegExp(`^${category.slug}-page-\\d+\\.html$`, 'i').test(file.name)).map(file => file.name);
      const relatedPages = [...new Set([...linkedPages, ...generatedPages])];
      const remaining = categories.filter(item => item.slug !== category.slug);
      const files = [
        { path: 'categories.json', content: JSON.stringify(remaining, null, 2) },
        { path: `${category.slug}.html`, delete: true },
        ...relatedPages.map(path => ({ path, delete: true }))
      ];
      await uploadProduct(token, files, `Delete category ${category.slug}`);
      categoriesCache = remaining;
      renderCategoryList(); updateProductCategoryOptions(); resetCategoryForm();
      setCategoryMessage(`გვერდი „${category.name}“ წაიშალა.`, 'success');
    } catch (error) {
      setCategoryMessage(error.message || 'გვერდის წაშლა ვერ მოხერხდა.', 'error');
    } finally {
      if (removeButton) removeButton.disabled = false;
    }
  }

  let categorySlugWasEdited = false;
  categoryNameInput.addEventListener('input', () => {
    if (!categorySlugWasEdited) categorySlugInput.value = categorySlugFromName(categoryNameInput.value);
  });
  categorySlugInput.addEventListener('input', () => { categorySlugWasEdited = true; });
  cancelCategoryEditButton.addEventListener('click', resetCategoryForm);

  categoryForm.addEventListener('submit', async event => {
    event.preventDefault();
    const token = tokenInput.value.trim();
    if (!token) return setCategoryMessage('გვერდების შესაცვლელად შეიყვანეთ GitHub token.', 'error');
    const name = categoryNameInput.value.trim();
    const slug = categorySlugInput.value.trim().toLowerCase();
    const oldSlug = categoryOriginalSlug.value;
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return setCategoryMessage('შეიყვანეთ გვერდის სახელი და მისამართი ლათინური პატარა ასოებით, ციფრებით ან დეფისით.', 'error');
    }
    saveCategoryButton.disabled = true;
    try {
      const categories = await readRepositoryJson(token, 'categories.json');
      if (categories.some(category => category.slug === slug && category.slug !== oldSlug)) {
        throw new Error('ეს გვერდის მისამართი უკვე გამოყენებულია.');
      }
      const rootFiles = await listRepositoryFiles(token);
      const newPagePath = `${slug}.html`;
      if (slug !== oldSlug && rootFiles.some(file => file.type === 'file' && file.name.toLowerCase() === newPagePath.toLowerCase())) {
        throw new Error('ამ მისამართით ფაილი უკვე არსებობს.');
      }
      const nextCategories = oldSlug
        ? categories.map(category => category.slug === oldSlug ? { slug, name } : category)
        : [...categories, { slug, name }];
      const files = [{ path: 'categories.json', content: JSON.stringify(nextCategories, null, 2) }];

      if (!oldSlug) {
        files.push({ path: newPagePath, content: await makeEmptyCategoryPage(slug) });
      } else if (slug !== oldSlug) {
        const oldPageFile = await githubRequest(token, `contents/${oldSlug}.html?ref=${githubBranch}`);
        const oldPageContent = textFromBase64(oldPageFile.content);
        const renamedContent = renameCategoryPageMarkup(oldPageContent, oldSlug, slug);
        files.push({ path: newPagePath, content: renamedContent }, { path: `${oldSlug}.html`, delete: true });
        const linkedPages = linkedCategoryPages(oldPageContent, oldSlug, rootFiles);
        const generatedPages = rootFiles.filter(file => file.type === 'file' && new RegExp(`^${oldSlug}-page-\\d+\\.html$`, 'i').test(file.name)).map(file => file.name);
        const relatedPages = [...new Set([...linkedPages, ...generatedPages])];
        for (const pagePath of relatedPages) {
          const oldPage = await githubRequest(token, `contents/${pagePath}?ref=${githubBranch}`);
          const pageContent = renameCategoryPageMarkup(textFromBase64(oldPage.content), oldSlug, slug);
          const nextPath = pagePath.replace(new RegExp(`^${oldSlug}`, 'i'), slug);
          files.push({ path: nextPath, content: pageContent }, { path: pagePath, delete: true });
        }
        const products = await readRepositoryJson(token, 'products.json');
        let productsChanged = false;
        products.forEach(product => {
          if (product.category === oldSlug) { product.category = slug; productsChanged = true; }
        });
        if (productsChanged) files.push({ path: 'products.json', content: JSON.stringify(products, null, 2) });
      }

      await uploadProduct(token, files, oldSlug ? `Update category ${slug}` : `Add category ${slug}`);
      categoriesCache = nextCategories;
      renderCategoryList(); updateProductCategoryOptions(); resetCategoryForm();
      setCategoryMessage(oldSlug ? `გვერდი „${name}“ შენახულია.` : `გვერდი „${name}“ დაემატა.`, 'success');
    } catch (error) {
      setCategoryMessage(error.message || 'გვერდის შენახვა ვერ მოხერხდა.', 'error');
    } finally {
      saveCategoryButton.disabled = false;
    }
  });

  function renderEditPreview() {
    editPreview.replaceChildren();
    const sources = [
      ...editImages.map((path, index) => ({ url: path, name: path.split('/').pop(), existing: true, index })),
      ...editFiles.map((file, index) => ({ url: URL.createObjectURL(file), name: file.name, temporary: true, index }))
    ];
    sources.slice(0, 4).forEach(source => {
      const item = document.createElement('div'); item.className = 'preview-item';
      const img = document.createElement('img'); img.src = source.url; img.alt = source.name;
      if (source.temporary) img.onload = () => URL.revokeObjectURL(source.url);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-photo';
      remove.textContent = '×'; remove.setAttribute('aria-label', `ფოტოს წაშლა: ${source.name}`);
      remove.addEventListener('click', () => {
        if (source.existing) editImages.splice(source.index, 1);
        else editFiles.splice(source.index, 1);
        renderEditPreview();
        setEditMessage(tokenInput.value.trim()
          ? 'ფოტო მონიშნულია წასაშლელად. ცვლილების GitHub-ზე შესანახად დააჭირეთ „ცვლილებების შენახვას“.'
          : 'ფოტო მონიშნულია წასაშლელად. შეიყვანეთ GitHub token და შემდეგ დააჭირეთ „ცვლილებების შენახვას“.', 'info');
      });
      item.append(img, remove); editPreview.append(item);
    });
  }

  function showEditProduct() {
    editingProduct = productsCache.find(product => product.slug === editSelect.value) || null;
    if (!editingProduct) { editForm.hidden = true; return; }
    editForm.hidden = false;
    document.querySelector('#edit-name').value = editingProduct.name || '';
    document.querySelector('#edit-price').value = editingProduct.price ?? '';
    document.querySelector('#edit-description').value = editingProduct.description || '';
    document.querySelector('#edit-product-meta').textContent = `${editingProduct.category} · ${editingProduct.slug}`;
    editFiles = []; editImages = [...(editingProduct.images || [])]; editPhotos.value = ''; editMessage.className = 'message';
    updateEditLock();
    renderEditPreview();
  }

  function updateEditLock() {
    const locked = !tokenInput.value.trim();
    ['#edit-name', '#edit-price', '#edit-description', '#edit-photos', '#save-edit', '#delete-product']
      .forEach(selector => { const control = document.querySelector(selector); if (control) control.disabled = locked; });
    if (editingProduct && locked) setEditMessage('კორექტირებისთვის ჯერ შეიყვანეთ GitHub token.', 'info');
    else if (editMessage.classList.contains('info')) editMessage.className = 'message';
  }

  tokenInput.addEventListener('input', updateEditLock);

  function activateAdminPanel(panelId) {
    const target = ['edit-panel', 'categories-panel'].includes(panelId) ? panelId : 'upload-panel';
    document.querySelectorAll('[data-admin-panel]').forEach(item => item.classList.toggle('active', item.dataset.adminPanel === target));
    document.querySelectorAll('#upload-panel, #edit-panel, #categories-panel').forEach(panel => { panel.hidden = panel.id !== target; });
    if (target === 'edit-panel' && !productsCache.length) {
      loadProductsForEdit().catch(error => setEditMessage(error.message, 'error'));
    }
    if (target === 'categories-panel' && !categoriesCache.length) {
      loadCategoryList().catch(error => setCategoryMessage(error.message, 'error'));
    }
  }

  document.querySelectorAll('[data-admin-panel]').forEach(button => button.addEventListener('click', () => {
    activateAdminPanel(button.dataset.adminPanel);
    const url = new URL(window.location.href);
    url.searchParams.set('section', button.dataset.adminPanel === 'edit-panel' ? 'edit'
      : button.dataset.adminPanel === 'categories-panel' ? 'categories' : 'upload');
    history.replaceState(null, '', url);
  }));
  const initialUrl = new URL(window.location.href);
  if (initialUrl.searchParams.get('section') === 'categories') {
    activateAdminPanel('categories-panel');
  } else if (initialUrl.searchParams.get('section') === 'edit' || ['#edit', '#edit-panel'].includes(initialUrl.hash)) {
    activateAdminPanel('edit-panel');
  }
  updateEditLock();
  loadCategoryList().catch(error => setMessage(error.message, 'error'));
  document.querySelector('#refresh-products').addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    try { await loadProductsForEdit(); setEditMessage('პროდუქტების სია განახლდა.', 'success'); }
    catch (error) { setEditMessage(error.message || 'სიის ჩატვირთვა ვერ მოხერხდა.', 'error'); }
    finally { event.currentTarget.disabled = false; }
  });
  editSelect.addEventListener('change', showEditProduct);

  editPhotos.addEventListener('change', async () => {
    const incoming = Array.from(editPhotos.files || []);
    if (editImages.length + editFiles.length + incoming.length > 4) { setEditMessage('პროდუქტს მაქსიმუმ 4 ფოტო შეიძლება ჰქონდეს. წაშალეთ არსებული ფოტო ან აირჩიეთ ნაკლები.', 'error'); editPhotos.value = ''; return; }
    if (incoming.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)) {
      setEditMessage('გამოიყენეთ JPG, PNG ან WebP ფოტოები, თითოეული მაქსიმუმ 10 MB.', 'error'); editPhotos.value = ''; return;
    }
    if (incoming.length) {
      const button = document.querySelector('#save-edit'); button.disabled = true;
      try { editFiles = await Promise.all(incoming.map(optimizeImage)); renderEditPreview(); }
      finally { button.disabled = !tokenInput.value.trim(); }
    }
    editPhotos.value = '';
  });

  editForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!editingProduct) return;
    const token = tokenInput.value.trim();
    const saveButton = document.querySelector('#save-edit'); saveButton.disabled = true;
    try {
      if (!token) throw new Error('ჯერ შეიყვანეთ GitHub token.');
      const name = document.querySelector('#edit-name').value.trim();
      const price = document.querySelector('#edit-price').value.trim();
      if (!name || !price) throw new Error('შეავსეთ პროდუქტის სახელი და ფასი.');
      if (editFiles.length && (editFiles.length < 1 || editFiles.length > 4)) throw new Error('აირჩიეთ 1-დან 4 ფოტომდე.');
      const newImagePaths = editFiles.map((file, index) => {
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        return `CATALOG/${editingProduct.slug}-edit-${Date.now()}-${index + 1}.${ext}`;
      });
      const images = [...editImages, ...newImagePaths];
      if (!images.length) throw new Error('პროდუქტს მინიმუმ ერთი ფოტო უნდა დარჩეს.');
      const updated = { ...editingProduct, name, price, description: document.querySelector('#edit-description').value.trim(), images };
      const products = productsCache.map(item => item.slug === updated.slug ? updated : item);
      const retainedImages = new Set(products.flatMap(item => item.images || []));
      const files = [
        { path: 'products.json', content: JSON.stringify(products, null, 2) },
        { path: `${updated.slug}.html`, content: await makeProductPage(updated) },
        ...editFiles.map((content, index) => ({ path: images[index], content, binary: true })),
        ...(editingProduct.images || []).filter(path => !retainedImages.has(path)).map(path => ({ path, delete: true }))
      ];
      await uploadProduct(token, files, `Update product ${updated.slug}`);
      productsCache = products;
      editFiles = []; editImages = [];
      await loadProductsForEdit(); editSelect.value = updated.slug; showEditProduct();
      setEditMessage('ცვლილებები შენახულია GitHub-ზე.', 'success');
    } catch (error) { setEditMessage(error.message || 'ცვლილებების შენახვა ვერ მოხერხდა.', 'error'); }
    finally { updateEditLock(); }
  });

  document.querySelector('#delete-product').addEventListener('click', async () => {
    if (!editingProduct || !confirm(`წაიშალოს პროდუქტი „${editingProduct.name}“?`)) return;
    const button = document.querySelector('#delete-product'); button.disabled = true;
    try {
      const token = tokenInput.value.trim();
      if (!token) throw new Error('ჯერ შეიყვანეთ GitHub token.');
      const removed = editingProduct;
      const products = productsCache.filter(item => item.slug !== removed.slug);
      const retainedImages = new Set(products.flatMap(item => item.images || []));
      const files = [
        { path: 'products.json', content: JSON.stringify(products, null, 2) },
        { path: `${removed.slug}.html`, delete: true },
        ...(removed.images || []).filter(path => !retainedImages.has(path)).map(path => ({ path, delete: true }))
      ];
      await uploadProduct(token, files, `Delete product ${removed.slug}`);
      productsCache = products; editFiles = []; editImages = [];
      await loadProductsForEdit();
      setEditMessage('პროდუქტი წაიშალა.', 'success');
    } catch (error) { setEditMessage(error.message || 'პროდუქტის წაშლა ვერ მოხერხდა.', 'error'); }
    finally { button.disabled = !tokenInput.value.trim(); }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = document.querySelector('#name').value.trim();
    const category = document.querySelector('#category').value;
    const price = document.querySelector('#price').value.trim();
    const description = document.querySelector('#description').value.trim();
    const slug = safeSlug(slugInput.value);
    const token = document.querySelector('#github-token').value.trim();
    if (!token) return setMessage('ჩასვით GitHub token საიტზე ასატვირთად.', 'error');
    if (!name || !price || !slug || selectedFiles.length < 1 || selectedFiles.length > 4) {
      return setMessage('შეავსეთ სახელი, ფასი და ფაილის სახელი; დაამატეთ 1-დან 4-მდე ფოტო.', 'error');
    }
    if (!description) return setMessage('შეიყვანეთ პროდუქტის აღწერა.', 'error');
    if (selectedFiles.length === 0) return setMessage('ატვირთეთ პროდუქტის მინიმუმ ერთი ფოტო.', 'error');
    const button = document.querySelector('#submit'); button.disabled = true;
    button.firstChild.textContent = 'იტვირთება... ';
    try {
      let products = [];
      try {
        const file = await githubRequest(token, 'contents/products.json?ref=main');
        products = JSON.parse(textFromBase64(file.content));
      } catch (_) {
        throw new Error('პროდუქტების სიის GitHub-იდან წაკითხვა ვერ მოხერხდა. გადაამოწმეთ token-ის Contents read/write წვდომა.');
      }
      if (!Array.isArray(products)) products = [];
      const now = Date.now();
      const legacyProducts = products.filter(item => !Number.isFinite(Date.parse(item.createdAt || '')));
      legacyProducts.reverse().forEach((item, index) => {
        item.createdAt = new Date(now - (index + 1) * 1000).toISOString();
      });
      products.sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
      const existingProductIndex = products.findIndex(product => product.slug === slug);

      const images = selectedFiles.map((file, index) => {
        const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        return `CATALOG/${slug}-${index + 1}.${extension}`;
      });
      const product = {
        slug, name, category, price, images,
        description,
        createdAt: new Date(now).toISOString()
      };
      if (existingProductIndex >= 0) products.splice(existingProductIndex, 1);
      products.unshift(product);
      const categoryPages = await makeCategoryPageFiles(category, products);
      const uploadFiles = [
        { path: 'products.json', content: JSON.stringify(products, null, 2) },
        { path: `${slug}.html`, content: await makeProductPage(product) },
        ...categoryPages,
        ...selectedFiles.map((file, index) => ({ path: images[index], content: file, binary: true }))
      ];
      await uploadProduct(token, uploadFiles);
      selectedFiles = [];
      renderPreview();
      form.reset();
      document.querySelector('#github-token').value = token;
      slugWasEdited = false;
      setMessage(existingProductIndex >= 0
        ? 'პროდუქტი განახლდა GitHub-ზე. საიტზე ცვლილების გამოჩენას შესაძლოა რამდენიმე წუთი დასჭირდეს.'
        : 'პროდუქტი აიტვირთა GitHub-ზე. საიტზე გამოჩენას შესაძლოა რამდენიმე წუთი დასჭირდეს.', 'success');
    } catch (error) {
      setMessage(error.message || 'საიტზე ატვირთვა ვერ მოხერხდა.', 'error');
    } finally {
      button.disabled = false; button.firstChild.textContent = 'საიტზე ატვირთვა ';
    }
  });
})();
