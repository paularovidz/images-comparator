const viewer = document.getElementById("viewer");
const controls = document.getElementById("controls");
const loadBtn = document.getElementById("loadBtn");
const shareBtn = document.getElementById("shareBtn");
const historyList = document.getElementById("historyList");
const currentLabel = document.getElementById("currentLabel");

let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startX, startY;

let images = [];
let currentIndex = 0;

// Load images from inputs
loadBtn.addEventListener("click", () => {
  const urls = getUrls();
  if (urls.length === 0) return;

  loadImages(urls);
  saveHistory(urls);
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

function loadImages(urls) {
  viewer.querySelectorAll(".image-layer").forEach(el => el.remove());
  controls.innerHTML = "";
  images = [];
  currentIndex = 0;

  urls.forEach((url, i) => {
    const img = document.createElement("img");
    img.src = url;
    img.className = "image-layer";
    img.draggable = false;
    if (i === 0) img.classList.add("active");
    viewer.appendChild(img);
    images.push(img);

    const btn = document.createElement("button");
    btn.textContent = `Image ${i+1}`;
    btn.addEventListener("click", () => switchImage(i));
    if (i === 0) btn.classList.add("active");
    controls.appendChild(btn);
  });

  updateLabel();
  applyTransform();
}

function switchImage(i) {
  if (images.length === 0) return;
  images[currentIndex].classList.remove("active");
  controls.children[currentIndex].classList.remove("active");
  currentIndex = i;
  images[currentIndex].classList.add("active");
  controls.children[currentIndex].classList.add("active");
  updateLabel();
  applyTransform();
}

function updateLabel() {
  if (images.length === 0) {
    currentLabel.textContent = "No image loaded";
  } else {
    currentLabel.textContent = `Showing image: ${currentIndex + 1}`;
  }
}

function applyTransform() {
  images.forEach(img => {
    img.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  });
}

// Save history
function saveHistory(urls) {
  let history = JSON.parse(localStorage.getItem("comparisons") || "[]");
  history.unshift(urls);
  history = history.slice(0, 20);
  localStorage.setItem("comparisons", JSON.stringify(history));
  renderHistory();
}

// Delete history item
function deleteHistory(index) {
  let history = JSON.parse(localStorage.getItem("comparisons") || "[]");
  history.splice(index, 1);
  localStorage.setItem("comparisons", JSON.stringify(history));
  renderHistory();
}

// Render history list
function renderHistory() {
  historyList.innerHTML = "";
  const history = JSON.parse(localStorage.getItem("comparisons") || "[]");
  history.forEach((urls, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "history-btn";

    const preview = document.createElement("img");
    preview.src = urls[0] || "";
    wrapper.appendChild(preview);

    const label = document.createElement("span");
    label.textContent = `Comparison ${index+1}`;
    wrapper.appendChild(label);

    wrapper.onclick = () => {
      setInputs(urls);
      loadImages(urls);
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

// On page load: check if shared URL has images
window.onload = () => {
  const params = new URLSearchParams(window.location.search);
  const imgsParam = params.get("imgs");
  if (imgsParam) {
    try {
      const urls = JSON.parse(decodeURIComponent(imgsParam));
      setInputs(urls);
      loadImages(urls);
      saveHistory(urls);
    } catch(e) {
      console.error("Error parsing imgs param", e);
    }
  }
  renderHistory();
};
