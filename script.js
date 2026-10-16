
const API = "https://dog.ceo/api";

const $ = (id) => document.getElementById(id);

let currentDog = "";
let currentBreed = "";
let breedImages = [];
let breedOffset = 0;
let seenDogs = new Set();
let requestId = 0;

function loadFavorites() {
  try {
    const data = JSON.parse(
      localStorage.getItem("dog-gallery-favorites") || "[]"
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

let favorites = loadFavorites();

function saveFavorites() {
  try {
    localStorage.setItem(
      "dog-gallery-favorites",
      JSON.stringify(favorites)
    );
  } catch {
    alert("No se pudieron guardar los favoritos en este navegador.");
  }

  updateFavoriteCount();
}

function updateFavoriteCount() {
  $("favorite-count").textContent = favorites.length;
}

function breedFromUrl(url) {
  const match = url.match(/\/breeds\/([^/]+)\//);
  if (!match) return "Perro";

  return match[1]
    .replace(/-\d+$/, "")
    .replace(/-/g, " ")
    .replace(/\d+$/, "");
}

function prettyName(name) {
  return name.replace(/\b\w/g, letter => letter.toUpperCase());
}

async function api(path) {
  const response = await fetch(`${API}/${path}`);

  if (!response.ok) {
    throw new Error("Error de conexión con Dog CEO API.");
  }

  const data = await response.json();

  if (data.status !== "success") {
    throw new Error(data.message || "No se encontraron resultados.");
  }

  return data.message;
}

function showStatus(container, message, isError = false) {
  container.replaceChildren();

  const element = document.createElement("p");
  element.className = `status${isError ? " error" : ""}`;
  element.textContent = message;

  container.appendChild(element);
}

// PERRO ALEATORIO

async function loadRandomDog() {
  const button = $("random-button");
  const request = ++requestId;

  button.disabled = true;
  button.textContent = "Buscando...";

  try {
    let url = await api("breeds/image/random");

    for (let i = 0; i < 3 && seenDogs.has(url); i++) {
      url = await api("breeds/image/random");
    }

    if (request !== requestId) return;

    seenDogs.add(url);
    currentDog = url;

    $("hero-img").src = url;
    $("hero-name").textContent = prettyName(breedFromUrl(url));
    $("hero-description").textContent =
      "¡Un nuevo amigo para descubrir! Guarda su fotografía o encuentra otro perro.";

    updateHeroFavorite();
  } catch {
    if (request === requestId) {
      $("hero-name").textContent = "No pudimos cargar la imagen";
      $("hero-description").textContent =
        "Comprueba tu conexión e inténtalo nuevamente.";
    }
  } finally {
    if (request === requestId) {
      button.disabled = false;
      button.textContent = "↻ Cambiar de perro";
    }
  }
}

function updateHeroFavorite() {
  const saved = favorites.some(dog => dog.url === currentDog);
  const button = $("hero-favorite");

  button.textContent = saved ? "♥" : "♡";
  button.classList.toggle("saved", saved);
  button.setAttribute(
    "aria-label",
    saved ? "Quitar de favoritos" : "Añadir a favoritos"
  );
}

// FAVORITOS

function toggleFavorite(url) {
  if (!url) return;

  const exists = favorites.some(dog => dog.url === url);

  if (exists) {
    favorites = favorites.filter(dog => dog.url !== url);
  } else {
    favorites.unshift({
      url,
      breed: prettyName(breedFromUrl(url))
    });
  }

  saveFavorites();
  updateHeroFavorite();
  renderFavorites();
  renderBreedGallery();
}

function makeDogCard(url, name) {
  const card = document.createElement("article");
  card.className = "dog-card";

  const imageBox = document.createElement("div");
  imageBox.className = "dog-image";

  const img = document.createElement("img");
  img.src = url;
  img.alt = `Perro de raza ${name}`;
  img.loading = "lazy";
  img.onerror = () => card.remove();

  imageBox.appendChild(img);

  const content = document.createElement("div");
  content.className = "dog-card-content";

  const info = document.createElement("div");

  const title = document.createElement("div");
  title.className = "dog-name";
  title.textContent = name;

  const subtitle = document.createElement("div");
  subtitle.className = "dog-subtitle";
  subtitle.textContent = "Foto de perro";

  info.append(title, subtitle);

  const button = document.createElement("button");
  button.className = "favorite-btn";
  button.setAttribute("aria-label", "Cambiar favorito");

  function refreshButton() {
    const saved = favorites.some(dog => dog.url === url);
    button.textContent = saved ? "♥" : "♡";
    button.classList.toggle("saved", saved);
  }

  refreshButton();

  button.addEventListener("click", () => {
    toggleFavorite(url);
  });

  content.append(info, button);
  card.append(imageBox, content);

  return card;
}

// CATÁLOGO DE RAZAS

async function loadBreeds() {
  try {
    const breeds = await api("breeds/list/all");
    const select = $("breed-select");

    select.replaceChildren();

    const initial = document.createElement("option");
    initial.value = "";
    initial.textContent = "Selecciona una raza";
    select.appendChild(initial);

    Object.entries(breeds).sort(([a], [b]) => a.localeCompare(b))
      .forEach(([breed, subbreeds]) => {
        if (subbreeds.length === 0) {
          addBreedOption(select, breed, breed);
        } else {
          subbreeds.forEach(subbreed => {
            addBreedOption(
              select,
              `${breed}/${subbreed}`,
              `${breed} ${subbreed}`
            );
          });

          addBreedOption(select, breed, breed);
        }
      });
  } catch {
    $("breed-select").innerHTML =
      '<option value="">No se pudieron cargar las razas</option>';
  }
}

function addBreedOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = prettyName(label);
  select.appendChild(option);
}

async function searchBreed(reset = true) {
  const breed = $("breed-select").value;
  if (!breed) return;

  const request = ++requestId;

  if (reset || breed !== currentBreed) {
    currentBreed = breed;
    breedImages = [];
    breedOffset = 0;

    showStatus($("breed-gallery"), "Cargando fotografías...");
  }

  $("breed-title").textContent = prettyName(breed.replace("/", " "));
  $("search-button").disabled = true;

  try {
    const endpoint = breed.includes("/")
      ? `breed/${breed.split("/")[0]}/${breed.split("/")[1]}/images`
      : `breed/${breed}/images`;

    const images = await api(endpoint);

    if (request !== requestId) return;

    breedImages = images;
    breedOffset = reset ? 0 : breedOffset;

    $("breed-info").textContent =
      `${images.length} fotografías disponibles`;

    renderBreedGallery();
  } catch {
    if (request === requestId) {
      showStatus(
        $("breed-gallery"),
        "No se pudieron cargar las imágenes. Inténtalo de nuevo.",
        true
      );
    }
  } finally {
    if (request === requestId) {
      $("search-button").disabled = false;
    }
  }
}

function renderBreedGallery() {
  const gallery = $("breed-gallery");
  gallery.replaceChildren();

  const images = breedImages.slice(0, breedOffset + 12);

  if (images.length === 0) {
    if (currentBreed) {
      showStatus(gallery, "No hay fotografías disponibles.");
    }
    $("more-button").classList.add("hidden");
    return;
  }

  images.forEach(url => {
    gallery.appendChild(
      makeDogCard(url, prettyName(breedFromUrl(url)))
    );
  });

  $("more-button").classList.toggle(
    "hidden",
    images.length >= breedImages.length
  );
}

// MOSTRAR MÁS IMÁGENES

function loadMoreImages() {
  breedOffset += 12;
  renderBreedGallery();
}

// GALERÍA DE FAVORITOS

function renderFavorites() {
  const gallery = $("favorites-gallery");
  gallery.replaceChildren();

  if (favorites.length === 0) {
    showStatus(
      gallery,
      "Todavía no tienes favoritos. Pulsa ♡ en cualquier perro para guardarlo."
    );
    return;
  }

  favorites.forEach(dog => {
    gallery.appendChild(
      makeDogCard(
        dog.url,
        dog.breed || prettyName(breedFromUrl(dog.url))
      )
    );
  });
}

// NAVEGACIÓN

function activateSection(name) {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.section === name);
  });

  document.querySelectorAll(".page-section").forEach(section => {
    section.classList.add("hidden");
  });

  $(`${name}-section`).classList.remove("hidden");

  if (name === "favorites") renderFavorites();
}

// EVENTOS

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    activateSection(tab.dataset.section);
  });
});

$("random-button").addEventListener("click", loadRandomDog);
$("another-button").addEventListener("click", loadRandomDog);

$("hero-favorite").addEventListener("click", () => {
  toggleFavorite(currentDog);
});

$("search-button").addEventListener("click", () => searchBreed(true));

$("breed-select").addEventListener("change", () => {
  if ($("breed-select").value) searchBreed(true);
});

$("more-button").addEventListener("click", loadMoreImages);

// INICIALIZACIÓN

updateFavoriteCount();
loadRandomDog();
loadBreeds();
