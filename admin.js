(() => {
  const form = document.querySelector('#product-form');
  const photos = document.querySelector('#photos');
  const preview = document.querySelector('#preview');
  const message = document.querySelector('#message');
  const slugInput = document.querySelector('#slug');
  let selectedFiles = [];
  let slugWasEdited = false;

  const setMessage = (text, type) => {
    message.textContent = text;
    message.className = `message show ${type}`;
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
        Authorization: `Bearer ${token}`,
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

  async function uploadProduct(token, files) {
    const reference = await githubRequest(token, `git/ref/heads/${githubBranch}`);
    const parentCommit = await githubRequest(token, `git/commits/${reference.object.sha}`);
    const blobs = [];
    for (const file of files) {
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
        message: `Add product ${files.find(file => file.path.endsWith('.html'))?.path || ''}`,
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
    const baseResponse = await fetch(`${category}.html`, { cache: 'no-store' });
    if (!baseResponse.ok) throw new Error(`${category}.html კატეგორიის გვერდი ვერ ჩაიტვირთა.`);
    const baseDocument = new DOMParser().parseFromString(await baseResponse.text(), 'text/html');
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
