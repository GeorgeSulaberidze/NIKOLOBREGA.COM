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

  photos.addEventListener('change', () => {
    const incoming = Array.from(photos.files || []);
    if (incoming.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setMessage('გამოიყენეთ JPG, PNG ან WebP ფორმატის ფოტოები.', 'error'); photos.value = ''; return;
    }
    if (incoming.some(file => file.size > 10 * 1024 * 1024)) {
      setMessage('თითოეული ფოტო 10 MB-ზე ნაკლები უნდა იყოს.', 'error'); photos.value = ''; return;
    }
    selectedFiles = [...selectedFiles, ...incoming].slice(0, 4);
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
    mainImage.setAttribute('src', images[0] || '');
    mainImage.setAttribute('alt', product.name);
    imageElements.forEach((image, index) => {
      image.setAttribute('src', images[index] || '');
      image.setAttribute('alt', `${product.name} — ფოტო ${index + 1}`);
      image.closest('.small-img-col').hidden = !images[index];
    });
    template.querySelector('.single-pro-details h6').textContent = ` Home / ${product.name}`;
    template.querySelector('.single-pro-details h2').textContent = `${product.price}GEL`;
    const description = escapeHtml(product.description || '').replace(/\n/g, '<br>');
    template.querySelector('.single-pro-details span').innerHTML = description;
    return `<!DOCTYPE html>\n${template.documentElement.outerHTML}`;
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
        const response = await fetch('products.json', { cache: 'no-store' });
        if (!response.ok) throw new Error();
        products = await response.json();
      } catch (_) {
        throw new Error('გახსენით პანელი საიტის HTTPS მისამართიდან. პირდაპირ ფაილის გახსნისას არსებული პროდუქტების სიის შენარჩუნება შეუძლებელია.');
      }
      if (!Array.isArray(products)) products = [];
      const existingProductIndex = products.findIndex(product => product.slug === slug);

      const images = selectedFiles.map((file, index) => {
        const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        return `CATALOG/${slug}-${index + 1}.${extension}`;
      });
      const product = {
        slug, name, category, price, images,
        description
      };
      if (existingProductIndex >= 0) products[existingProductIndex] = product;
      else products.push(product);
      const uploadFiles = [
        { path: 'products.json', content: JSON.stringify(products, null, 2) },
        { path: `${slug}.html`, content: await makeProductPage(product) },
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
