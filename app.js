const viewer = document.getElementById("viewer");
const controls = document.getElementById("controls");
const loadBtn = document.getElementById("loadBtn");
const shareBtn = document.getElementById("shareBtn");
const historyList = document.getElementById("historyList");
const currentLabel = document.getElementById("currentLabel");
const imageInfo = document.getElementById("imageInfo");

let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX, startY;

let images = [];
let currentIndex = 0;
let currentMeta = []; // size/dimensions/blobUrl for loaded images

// Load images from inputs
loadBtn.addEventListener("click", async () => {
  const urls = getUrls();
  if (urls.length === 0) return;

  const meta = await fetchMetaForImages(urls);
  loadImages(meta);
  saveHistory(urls); // only store original URLs
});

// Share button: copy link with params
shareBtn.addEventListener("click", async () => {
  const urls = getUrls();
  if (urls.length === 0) return alert("Please add at least one image");

  const url = new URL(window.location.href);
  url.searchParams.delete("imgs");
  url.searchParams.set("imgs", encodeURIComponent(JSON.stringify(urls)));

  try {
    await navigator.clipboard.writeText(url.toString());
    shareBtn.textContent = "Copied ✅";
    shareBtn.classList.add("copied");
    setTimeout(() => {
      shareBtn.textContent = "Share";
      shareBtn.classList.remove("copied");
    }, 3000);
  } catch (e) {
    alert("Could not copy automatically. Here is the link: " + url.toString());
  }
});

function getUrls() {
  return [
    document.getElementById("url1").value,
    document.getElementById("url2").value,
    document.getElementById("url3").value,
    document.getElementById("url4").value,
  ].filter(u => u.trim() !== "");
}

// Download each image once and extract size + dimensions
async function fetchMetaForImages(urls) {
  const results = [];
  
  // Traiter chaque URL avec une fonction complètement séparée
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const result = await processImageCompletely(url, i + 1);
    results.push(result);
    
    // Log simple: URL <> poids
    console.log(`${url} <> ${result.size}`);
  }
  
  return results;
}

// Fonction complètement séparée pour traiter une image
async function processImageCompletely(url, index) {
  let finalSize = "Unknown";
  let finalDimensions = "Unknown";
  
  try {
    // Méthode 1: Essayer fetch avec CORS et headers appropriés
    try {
      const response = await fetch(url, { 
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Accept': 'image/webp,image/avif,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          'User-Agent': navigator.userAgent
        }
      });
      
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        finalSize = (arrayBuffer.byteLength / 1024).toFixed(1);
      } else {
        throw new Error(`CORS failed: ${response.status}`);
      }
    } catch (corsError) {
      // Méthode 2: Essayer fetch sans CORS mais avec headers
      try {
        const response = await fetch(url, { 
          cache: 'no-cache',
          headers: {
            'Accept': 'image/webp,image/avif,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            'User-Agent': navigator.userAgent
          }
        });
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          finalSize = (arrayBuffer.byteLength / 1024).toFixed(1);
        } else {
          throw new Error(`No-CORS failed: ${response.status}`);
        }
      } catch (noCorsError) {
        // Méthode 3: Essayer avec XMLHttpRequest et headers
        try {
          finalSize = await getSizeWithXHR(url, index);
        } catch (xhrError) {
          finalSize = "Unknown";
        }
      }
    }
    
    // Obtenir les dimensions
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    await new Promise((resolve) => {
      img.onload = () => {
        finalDimensions = `${img.naturalWidth}×${img.naturalHeight}`;
        resolve();
      };
      img.onerror = () => {
        resolve();
      };
      img.src = url;
    });
    
  } catch (error) {
    // Erreur silencieuse
  }
  
  return {
    originalUrl: url,
    size: finalSize,
    dimensions: finalDimensions
  };
}

// Fonction pour obtenir la taille avec XMLHttpRequest
function getSizeWithXHR(url, index) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('HEAD', url, true);
    
    // Ajouter les mêmes headers que pour fetch
    xhr.setRequestHeader('Accept', 'image/webp,image/avif,image/apng,image/svg+xml,image/*,*/*;q=0.8');
    xhr.setRequestHeader('Accept-Encoding', 'gzip, deflate, br');
    xhr.setRequestHeader('Accept-Language', 'fr-FR,fr;q=0.9,en;q=0.8');
    xhr.setRequestHeader('User-Agent', navigator.userAgent);
    
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          const contentLength = xhr.getResponseHeader('Content-Length');
          if (contentLength) {
            const size = (parseInt(contentLength) / 1024).toFixed(1);
            resolve(size);
          } else {
            reject(new Error('No Content-Length header'));
          }
        } else {
          reject(new Error(`XHR failed: ${xhr.status}`));
        }
      }
    };
    xhr.onerror = () => reject(new Error('XHR network error'));
    xhr.send();
  });
}

function loadImages(meta) {
  viewer.querySelectorAll(".image-layer").forEach(el => el.remove());
  controls.innerHTML = "";
  images = [];
  currentIndex = 0;
  currentMeta = meta;

  // Calculer les différences de poids pour les marqueurs max/min
  const sizes = meta.map(m => {
    const sizeStr = m.size.replace(" KB", "").replace("Unknown", "0").replace("Error", "0");
    return parseFloat(sizeStr) || 0;
  });
  
  const maxSize = Math.max(...sizes);
  const minSize = Math.min(...sizes.filter(s => s > 0)); // Ignorer les 0 (Unknown/Error)

  meta.forEach((m, i) => {
    const img = document.createElement("img");
    img.src = m.originalUrl; // Utiliser directement l'URL originale
    img.className = "image-layer";
    img.draggable = false;
    img.style.display = i === 0 ? "block" : "none";
    if (i === 0) img.classList.add("active");
    viewer.appendChild(img);
    images.push(img);

    const btn = document.createElement("button");
    const sizeKB = sizes[i];
    const isLargest = sizeKB === maxSize && sizeKB > 0;
    const isSmallest = sizeKB === minSize && sizeKB > 0;
    
    let btnText = `Image ${i+1}`;
    if (isLargest) btnText += " (max)";
    if (isSmallest) btnText += " (min)";
    
    btn.textContent = btnText;
    btn.addEventListener("click", () => switchImage(i));
    if (i === 0) btn.classList.add("active");
    controls.appendChild(btn);
  });

  updateLabel();
  applyTransform();
}

function switchImage(i) {
  if (images.length === 0) return;
  
  // Masquer l'image actuelle
  images[currentIndex].classList.remove("active");
  images[currentIndex].style.display = "none";
  controls.children[currentIndex].classList.remove("active");
  
  // Afficher la nouvelle image
  currentIndex = i;
  images[currentIndex].classList.add("active");
  images[currentIndex].style.display = "block";
  controls.children[currentIndex].classList.add("active");
  
  updateLabel();
  applyTransform();
}

function updateLabel() {
  if (images.length === 0) {
    currentLabel.textContent = "No image loaded";
    imageInfo.textContent = "Size: --";
  } else {
    currentLabel.textContent = `Showing image: ${currentIndex + 1}`;
    const meta = currentMeta[currentIndex];
    if (meta) {
      imageInfo.textContent = `Size: ${meta.size} KB`;
    }
  }
}

function applyTransform() {
  images.forEach(img => {
    img.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  });
}

// Save history (only original URLs, not blobUrls)
function saveHistory(urls) {
  let history = JSON.parse(localStorage.getItem("comparisons") || "[]");
  history.unshift({ urls });
  history = history.slice(0, 20);
  localStorage.setItem("comparisons", JSON.stringify(history));
  renderHistory();
}

function deleteHistory(index) {
  let history = JSON.parse(localStorage.getItem("comparisons") || "[]");
  history.splice(index, 1);
  localStorage.setItem("comparisons", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  const history = JSON.parse(localStorage.getItem("comparisons") || "[]");

  history.forEach(async (entry, index) => {
    const { urls } = entry;

    const wrapper = document.createElement("div");
    wrapper.className = "history-btn";

    // regenerate meta (fresh each time for accuracy)
    const meta = await fetchMetaForImages(urls);

    const preview = document.createElement("img");
    preview.src = meta[0]?.originalUrl || urls[0] || "";
    wrapper.appendChild(preview);

    const label = document.createElement("span");
    
    // Calculer le gain en % par rapport à l'image la plus lourde
    const sizes = meta.map(m => {
      const sizeStr = m.size.replace(" KB", "").replace("Unknown", "0").replace("Error", "0");
      return parseFloat(sizeStr) || 0;
    });
    const maxSize = Math.max(...sizes);
    const minSize = Math.min(...sizes.filter(s => s > 0));
    const gain = maxSize > 0 && minSize > 0 ? ((maxSize - minSize) / maxSize * 100).toFixed(0) : 0;
    
    let labelText = `Comp. ${index+1}`;
    if (gain > 0) {
      labelText += ` (-${gain}%)`;
    }
    
    label.textContent = labelText;
    wrapper.appendChild(label);

    wrapper.onclick = () => {
      setInputs(urls);
      loadImages(meta);
    };

    const delBtn = document.createElement("button");
    delBtn.textContent = "×";
    delBtn.className = "delete-btn";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteHistory(index);
    };
    wrapper.appendChild(delBtn);

    historyList.appendChild(wrapper);
  });
}

function setInputs(urls) {
  ["url1", "url2", "url3", "url4"].forEach((id, i) => {
    document.getElementById(id).value = urls[i] || "";
  });
}

// Zoom with wheel
viewer.addEventListener("wheel", (e) => {
  e.preventDefault();
  const zoomFactor = 1.1;
  const oldScale = scale;
  if (e.deltaY < 0) {
    scale *= zoomFactor;
  } else {
    scale /= zoomFactor;
  }

  const rect = viewer.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  offsetX = mx - (mx - offsetX) * (scale / oldScale);
  offsetY = my - (my - offsetY) * (scale / oldScale);

  applyTransform();
});

// Drag to move image
viewer.addEventListener("mousedown", (e) => {
  if (e.target.closest("#controls")) return;
  isDragging = true;
  startX = e.clientX - offsetX;
  startY = e.clientY - offsetY;
});

window.addEventListener("mouseup", () => {
  isDragging = false;
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  offsetX = e.clientX - startX;
  offsetY = e.clientY - startY;
  applyTransform();
});

// On page load
window.onload = async () => {
  const params = new URLSearchParams(window.location.search);
  const imgsParam = params.get("imgs");
  if (imgsParam) {
    try {
      const urls = JSON.parse(decodeURIComponent(imgsParam));
      const meta = await fetchMetaForImages(urls);
      setInputs(urls);
      loadImages(meta);
      saveHistory(urls);
    } catch(e) {
      console.error("Error parsing imgs param", e);
    }
  }
  renderHistory();
};
