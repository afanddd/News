const NEWSAPI_KEY = '993712deb967433999088ed756f15b3c';
const NEWSDATA_KEY = 'pub_696091c3eebd531387e8cfa7ed36fbdbd9b22';

const NEWSAPI_URL = `https://newsapi.org/v2/top-headlines?country=id&apiKey=${NEWSAPI_KEY}`;
const NEWSDATA_URL = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&language=id`;

let newsData = [];
let currentPage = 1;
const itemsPerPage = 6;
let isLoading = false;
let currentTheme = localStorage.getItem('theme') || 'light';
let totalResults = 0;
let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];

// Fungsi utama inisialisasi
async function initialize() {
    await fetchNews();
    setupEventListeners();
    updateTheme();
    checkBookmarks();
}

// Fungsi mengambil berita
async function fetchNews() {
    try {
        showLoading();
        const [newsapiResponse, newsdataResponse] = await Promise.all([
            fetch(NEWSAPI_URL),
            fetch(NEWSDATA_URL)
        ]);

        const newsapiData = await newsapiResponse.json();
        const newsdataData = await newsdataResponse.json();

        if (newsapiData.status === 'ok' && newsdataData.status === 'success') {
            const combinedNews = [
                ...newsapiData.articles.map(article => ({
                    ...article,
                    category: article.category || ['general'],
                    pubDate: new Date(article.publishedAt).toLocaleDateString('id-ID'),
                    id: article.title + article.publishedAt
                })),
                ...newsdataData.results.map(article => ({
                    ...article,
                    category: article.category || ['general'],
                    pubDate: new Date(article.pubDate).toLocaleDateString('id-ID'),
                    id: article.article_id || Math.random().toString(36).substr(2, 9)
                }))
            ];
            newsData = combinedNews;
            totalResults = combinedNews.length;
            displayNews();
        } else {
            showToast('Gagal mengambil data berita');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Koneksi jaringan error');
    } finally {
        hideLoading();
    }
}

// Fungsi menampilkan berita
function displayNews(category = "all", searchQuery = "", page = 1) {
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = "";

    const filteredNews = newsData.filter(news => {
        const categoryMatch = category === "all" || 
            news.category.some(cat => cat.toLowerCase() === category.toLowerCase());
        const searchMatch = news.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (news.description && news.description.toLowerCase().includes(searchQuery.toLowerCase()));
        return categoryMatch && searchMatch;
    });

    const totalPages = Math.ceil(filteredNews.length / itemsPerPage);
    const paginatedNews = filteredNews.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    paginatedNews.forEach((news, index) => {
        const newsItem = createNewsElement(news);
        newsContainer.appendChild(newsItem);
        
        if (index === 2) {
            newsContainer.appendChild(createAdElement());
        }
    });

    renderPagination(totalPages, page);
    setupNewsInteraction();
}

// Fungsi membuat elemen berita
function createNewsElement(news) {
    const newsItem = document.createElement('div');
    newsItem.className = 'news-item';
    
    const imageHTML = news.urlToImage || news.image_url ? 
        `<img src="${news.urlToImage || news.image_url}" alt="${news.title}" loading="lazy">` : 
        '<div class="image-placeholder">Tidak ada gambar</div>';

    const isBookmarked = bookmarks.some(b => b.id === news.id);
    
    newsItem.innerHTML = `
        ${imageHTML}
        <div class="content">
            <h2>${news.title}</h2>
            <p>${news.description || 'Tidak ada deskripsi'}</p>
            <div class="meta">
                <span class="category">${news.category.join(', ')}</span>
                <span class="date">${news.pubDate}</span>
            </div>
            <div class="actions">
                <a href="${news.url || news.link}" target="_blank" class="read-more">Baca Selengkapnya</a>
                <button class="bookmark-btn" data-id="${news.id}">${isBookmarked ? '★' : '☆'}</button>
            </div>
            <div class="share-buttons">
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(news.url || news.link)}" 
                   target="_blank" class="share-facebook">Facebook</a>
                <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(news.title)}&url=${encodeURIComponent(news.url || news.link)}" 
                   target="_blank" class="share-twitter">Twitter</a>
                <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(news.title + " " + (news.url || news.link))}" 
                   target="_blank" class="share-whatsapp">WhatsApp</a>
            </div>
        </div>
    `;
    return newsItem;
}

// Fungsi pagination
function renderPagination(totalPages, currentPage) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    
    const prevButton = createPaginationButton('←', currentPage > 1, () => navigatePage(currentPage - 1));
    pagination.appendChild(prevButton);

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        pagination.appendChild(createPaginationButton(1, true, () => navigatePage(1)));
        if (startPage > 2) pagination.appendChild(createEllipsis());
    }

    for (let i = startPage; i <= endPage; i++) {
        pagination.appendChild(createPaginationButton(
            i,
            i !== currentPage,
            () => navigatePage(i),
            i === currentPage
        ));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) pagination.appendChild(createEllipsis());
        pagination.appendChild(createPaginationButton(totalPages, true, () => navigatePage(totalPages)));
    }

    const nextButton = createPaginationButton('→', currentPage < totalPages, () => navigatePage(currentPage + 1));
    pagination.appendChild(nextButton);
}

function createPaginationButton(text, enabled, onClick, isActive = false) {
    const button = document.createElement('button');
    button.textContent = text;
    button.disabled = !enabled;
    if (isActive) button.classList.add('active');
    button.addEventListener('click', onClick);
    return button;
}

function createEllipsis() {
    const span = document.createElement('span');
    span.textContent = '...';
    return span;
}

function navigatePage(page) {
    currentPage = page;
    const activeCategory = document.querySelector('nav ul li a.active')?.dataset.category || 'all';
    const searchQuery = document.getElementById('search-input').value;
    displayNews(activeCategory, searchQuery, currentPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Event Listeners
function setupEventListeners() {
    // Menu toggle
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('main-nav').classList.toggle('active');
    });

    // Kategori
    document.querySelectorAll('nav ul li a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('nav ul li a').forEach(a => a.classList.remove('active'));
            e.target.classList.add('active');
            currentPage = 1;
            displayNews(e.target.dataset.category);
        });
    });

    // Pencarian
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1;
            const activeCategory = document.querySelector('nav ul li a.active')?.dataset.category || 'all';
            displayNews(activeCategory, e.target.value.trim());
        }, 500);
    });

    // Tema
    document.getElementById('theme-toggle').addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        updateTheme();
    });

    // Back to top
    window.addEventListener('scroll', () => {
        const backToTop = document.getElementById('back-to-top');
        backToTop.classList.toggle('visible', window.scrollY > 300);
    });
    
    document.getElementById('back-to-top').addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Bookmark
    document.getElementById('view-bookmarks').addEventListener('click', (e) => {
        e.preventDefault();
        displayBookmarks();
    });
}

// Fungsi tema
function updateTheme() {
    document.body.classList.toggle('dark-mode', currentTheme === 'dark');
    document.getElementById('theme-toggle').textContent = currentTheme === 'dark' ? '☀️' : '🌙';
}

// Bookmark system
function setupNewsInteraction() {
    document.querySelectorAll('.bookmark-btn').forEach(btn => {
        const articleId = btn.dataset.id;
        const article = newsData.find(news => news.id === articleId);
        
        btn.addEventListener('click', () => {
            const index = bookmarks.findIndex(b => b.id === articleId);
            if (index === -1) {
                bookmarks.push(article);
                showToast('Berita disimpan ke bookmark');
            } else {
                bookmarks.splice(index, 1);
                showToast('Berita dihapus dari bookmark');
            }
            localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
            btn.textContent = index === -1 ? '★' : '☆';
        });
    });
}

function checkBookmarks() {
    const saved = localStorage.getItem('bookmarks');
    if (saved) {
        bookmarks = JSON.parse(saved);
    }
}

function displayBookmarks() {
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = "";

    if (bookmarks.length === 0) {
        newsContainer.innerHTML = "<p>Tidak ada berita yang disimpan.</p>";
        return;
    }

    bookmarks.forEach(news => {
        const newsItem = createNewsElement(news);
        newsContainer.appendChild(newsItem);
    });
}

// Fungsi iklan
function createAdElement() {
    const adDiv = document.createElement('div');
    adDiv.className = 'ad-container';
    adDiv.innerHTML = `
        <ins class="adsbygoogle"
            style="display:block"
            data-ad-client="ca-pub-9929235380686780"
            data-ad-slot="1234567890"
            data-ad-format="auto"
            data-full-width-responsive="true"></ins>
        <script>
            (adsbygoogle = window.adsbygoogle || []).push({});
        </script>
    `;
    return adDiv;
}

// Fungsi utilitas
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Inisialisasi
initialize();