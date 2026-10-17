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
  const hasGeorgian = value => /[\u10A0-\u10FF]/.test(value);
  const hasEnglish = value => /\b(?:the|a|an|and|or|is|are|made|with|for|from|by|of|this|our|high|quality|handmade|wood|leather|watch|sunglasses|design|product|material|comes|includes|features|light|comfortable|premium|polarized)\b/i.test(value);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

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

  function makeProductPage(product) {
    const images = product.images;
    const thumbs = images.map((src, index) => `<button class="thumb" type="button" aria-label="ფოტო ${index + 1}" onclick="document.getElementById('main-photo').src='${src}'"><img src="${src}" alt="${escapeHtml(product.name)}"></button>`).join('\n');
    const description = product.descriptionEn && product.descriptionKa
      ? `${escapeHtml(product.descriptionEn).replace(/\n/g, '<br>')}<br><br><strong>ქართულად:</strong> ${escapeHtml(product.descriptionKa).replace(/\n/g, '<br>')}`
      : escapeHtml(product.description || '').replace(/\n/g, '<br>');
    return `<!doctype html>
<html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(product.name)} | NIKOLO BREGA</title><link rel="stylesheet" href="style.css"><style>
.new-product{max-width:1100px;margin:44px auto;padding:0 22px;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(280px,.95fr);gap:42px}.new-product img{display:block;width:100%;object-fit:cover}.main-photo{aspect-ratio:1/1}.thumbs{display:flex;gap:10px;margin-top:10px}.thumb{border:1px solid #ddd;background:white;padding:0;width:76px;cursor:pointer}.thumb img{aspect-ratio:1}.product-copy h1{font-size:30px;margin:8px 0 12px}.product-price{font-size:27px;font-weight:700;margin:14px 0 26px}.product-description{line-height:1.8;color:#555;white-space:normal}.back-link{display:inline-block;margin-bottom:24px;color:#555}.product-category{color:#888;font-size:13px}@media(max-width:700px){.new-product{grid-template-columns:1fr;gap:25px;margin:24px auto;padding:0 16px}.product-copy h1{font-size:25px}.thumb{width:64px}}
</style></head><body><section id="header"><a href="index.html"><img height="40" width="140" src="img/image00001.png" alt="Nikolo Brega"></a><nav><ul id="navbar"><li><a href="index.html">Home</a></li><li><a href="${product.category}.html">${product.category}</a></li><li><a href="about.html">About</a></li><li><a href="contact.html">Contact</a></li></ul></nav></section><main class="new-product"><div><img id="main-photo" class="main-photo" src="${images[0]}" alt="${escapeHtml(product.name)}"><div class="thumbs">${thumbs}</div></div><article class="product-copy"><a class="back-link" href="${product.category}.html">← კატეგორიაში დაბრუნება</a><div class="product-category">NIKOLO BREGA / ${product.category}</div><h1>${escapeHtml(product.name)}</h1><div class="product-price">${escapeHtml(product.price)} GEL</div><button class="normal add-to-cart-trigger" type="button">Add To Cart</button><h3>პროდუქტის აღწერა</h3><div class="product-description">${description}</div></article></main><script src="script.js"></script></body></html>`;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = document.querySelector('#name').value.trim();
    const category = document.querySelector('#category').value;
    const price = document.querySelector('#price').value.trim();
    const descriptionEn = document.querySelector('#description-en').value.trim();
    const descriptionKa = document.querySelector('#description-ka').value.trim();
    const slug = safeSlug(slugInput.value);
    if (!window.JSZip) return setMessage('პაკეტის შემქმნელი ვერ ჩაიტვირთა. შეამოწმეთ ინტერნეტი და სცადეთ თავიდან.', 'error');
    if (!name || !price || !slug || selectedFiles.length < 1 || selectedFiles.length > 4) {
      return setMessage('შეავსეთ სახელი, ფასი და ფაილის სახელი; დაამატეთ 1-დან 4-მდე ფოტო.', 'error');
    }
    if (!descriptionEn && !descriptionKa) return setMessage('შეავსეთ აღწერა ინგლისურად და ქართულად.', 'error');
    const englishFieldBilingual = hasGeorgian(descriptionEn) && hasEnglish(descriptionEn);
    const georgianFieldBilingual = hasGeorgian(descriptionKa) && hasEnglish(descriptionKa);
    const existingBilingualText = englishFieldBilingual ? descriptionEn : georgianFieldBilingual ? descriptionKa : '';
    const hasSeparateDescriptions = Boolean(descriptionEn && descriptionKa && !existingBilingualText);
    if (!hasSeparateDescriptions && !existingBilingualText) {
      return setMessage('აღწერის ორივე ენა დაამატეთ. თუ ორივე ენა ერთ ტექსტშია, ჩასვით ერთ ველში.', 'error');
    }
    if (selectedFiles.length === 0) return setMessage('ატვირთეთ პროდუქტის მინიმუმ ერთი ფოტო.', 'error');
    const button = document.querySelector('#submit'); button.disabled = true;
    button.firstChild.textContent = 'პაკეტი მზადდება... ';
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
      if (products.some(product => product.slug === slug)) throw new Error('ეს ფაილის სახელი უკვე არსებობს. მიუთითეთ სხვა სახელი.');

      const zip = new JSZip();
      const images = selectedFiles.map((file, index) => {
        const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        return `CATALOG/${slug}-${index + 1}.${extension}`;
      });
      const product = {
        slug, name, category, price, images,
        ...(hasSeparateDescriptions
          ? { descriptionEn, descriptionKa }
          : { description: existingBilingualText })
      };
      products.push(product);
      zip.file('products.json', JSON.stringify(products, null, 2));
      zip.file(`${slug}.html`, makeProductPage(product));
      selectedFiles.forEach((file, index) => zip.file(images[index], file));
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${slug}-product.zip`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setMessage('პაკეტი ჩამოიტვირთა. ZIP გაშალეთ და შიგთავსი საიტის მთავარ საქაღალდეში გადაიტანეთ.', 'success');
    } catch (error) {
      setMessage(error.message || 'პაკეტის შექმნა ვერ მოხერხდა.', 'error');
    } finally {
      button.disabled = false; button.firstChild.textContent = 'ფაილების პაკეტის ჩამოტვირთვა ';
    }
  });
})();
