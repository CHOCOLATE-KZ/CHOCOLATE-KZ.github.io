const REPO_OWNER = 'CHOCOLATE-KZ';
const REPO_NAME = 'CHOCOLATE-KZ.github.io';

let chaptersIndex = [];
let currentChapterId = 1;

document.addEventListener('DOMContentLoaded', () => {
  initReader();
  setupEventListeners();
});

async function initReader() {
  try {
    const res = await fetch('./chapters/chapters.json');
    chaptersIndex = await res.json();
    populateSelect();
    loadChapter(chaptersIndex[0]?.id || 1);
  } catch (err) {
    document.getElementById('chapter-title').textContent = 'Ошибка загрузки глав';
    console.error(err);
  }
}

function populateSelect() {
  const select = document.getElementById('chapter-select');
  select.innerHTML = '';
  chaptersIndex.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch.id;
    opt.textContent = ch.title;
    select.appendChild(opt);
  });
}

async function loadChapter(id) {
  currentChapterId = id;
  document.getElementById('chapter-select').value = id;
  const bodyEl = document.getElementById('chapter-body');
  bodyEl.innerHTML = '<p>Загрузка текста...</p>';

  try {
    const res = await fetch(`./chapters/${id}.json`);
    const data = await res.json();
    document.getElementById('chapter-title').textContent = data.title;
    bodyEl.innerHTML = data.paragraphs.map(p => `<p>${p}</p>`).join('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    bodyEl.innerHTML = '<p>Не удалось загрузить содержимое главы.</p>';
  }
}

function setupEventListeners() {
  document.getElementById('chapter-select').addEventListener('change', (e) => {
    loadChapter(Number(e.target.value));
  });

  document.getElementById('prev-btn').addEventListener('click', () => {
    const idx = chaptersIndex.findIndex(c => c.id === currentChapterId);
    if (idx > 0) loadChapter(chaptersIndex[idx - 1].id);
  });

  document.getElementById('next-btn').addEventListener('click', () => {
    const idx = chaptersIndex.findIndex(c => c.id === currentChapterId);
    if (idx < chaptersIndex.length - 1) loadChapter(chaptersIndex[idx + 1].id);
  });

  document.getElementById('admin-btn').addEventListener('click', () => {
    const panel = document.getElementById('admin-panel');
    panel.classList.toggle('hidden');
  });

  document.getElementById('save-chapter-btn').addEventListener('click', saveNewChapter);
}

async function saveNewChapter() {
  const token = document.getElementById('gh-token').value.trim();
  const title = document.getElementById('chap-title').value.trim();
  const volume = document.getElementById('chap-volume').value.trim();
  const rawContent = document.getElementById('chap-content').value.trim();

  if (!token || !title || !rawContent) {
    alert('Заполните токен, название и текст!');
    return;
  }

  const newId = chaptersIndex.length > 0 ? Math.max(...chaptersIndex.map(c => c.id)) + 1 : 1;
  const paragraphs = rawContent.split('\n').filter(p => p.trim() !== '');

  const newChapterObj = { id: newId, title, volume, paragraphs };
  const updatedIndex = [...chaptersIndex, { id: newId, title, volume }];

  try {
    // 1. Создаем JSON файл главы
    await uploadFileToGitHub(
      token,
      `chapters/${newId}.json`,
      JSON.stringify(newChapterObj, null, 2),
      `Add chapter ${newId}`
    );

    // 2. Обновляем chapters.json
    await uploadFileToGitHub(
      token,
      `chapters/chapters.json`,
      JSON.stringify(updatedIndex, null, 2),
      `Update chapters index for ${newId}`
    );

    alert('Глава успешно добавлена! Страница обновится через пару секунд.');
    location.reload();
  } catch (err) {
    alert('Ошибка сохранеия: ' + err.message);
  }
}

async function uploadFileToGitHub(token, path, content, commitMessage) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  
  // Получаем sha если файл уже существует
  let sha = null;
  try {
    const getRes = await fetch(url, { headers: { Authorization: `token ${token}` } });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch (e) {}

  const body = {
    message: commitMessage,
    content: btoa(unescape(encodeURIComponent(content))),
    ...(sha && { sha })
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.statusText}`);
  }
}