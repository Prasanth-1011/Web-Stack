const API_URL = 'https://web-stack-x71t.onrender.com/api';
let folders = [];

// Check authentication
const accessToken = localStorage.getItem('accessToken');
const username = localStorage.getItem('username');

if (!accessToken) {
    window.location.href = 'login.html';
}

// Set username
document.getElementById('userName').textContent = username || 'User';

// Theme Management
const currentTheme = localStorage.getItem('theme') || 'ice';
document.body.setAttribute('data-theme', currentTheme);

document.querySelectorAll('.themeButton').forEach(button => {
    if (button.dataset.theme === currentTheme) {
        button.classList.add('active');
    }

    button.addEventListener('click', () => {
        const theme = button.dataset.theme;
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        document.querySelectorAll('.themeButton').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
    });
});

// Message Display
function showMessage(text, duration = 3000) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.classList.remove('hide');
    messageEl.classList.add('show');

    setTimeout(() => {
        messageEl.classList.remove('show');
        messageEl.classList.add('hide');
    }, duration);
}

// Logout
document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    window.location.href = 'login.html';
});

// API Helper
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
    };

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);

        if (response.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = 'login.html';
            return null;
        }

        const data = await response.json();
        return { ok: response.ok, data };
    } catch (error) {
        console.error('API Error:', error);
        showMessage('Connection error. Please try again.');
        return null;
    }
}

// Load Folders
async function loadFolders() {
    const result = await apiCall('/links');

    if (result && result.ok) {
        folders = result.data || [];
        renderFolders();
    } else {
        showMessage('Failed to load folders');
    }
}

// Render Folders
function renderFolders() {
    const container = document.getElementById('folderContainer');
    container.innerHTML = '';

    folders.forEach((folder, index) => {
        const folderEl = createFolderElement(folder, index);
        container.appendChild(folderEl);
    });

    initDragAndDrop();
}

// Create Folder Element
function createFolderElement(folder, index) {
    const folderEl = document.createElement('div');
    folderEl.className = 'folder';
    folderEl.dataset.index = index;

    // Sort links alphabetically
    const sortedLinks = (folder.links || []).sort((a, b) =>
        a.title.localeCompare(b.title)
    );

    folderEl.innerHTML = `
        <div class="folderName">
            <span>${folder.name}</span>
            <div class="folderActions">
                <button class="deleteFolder" onclick="deleteFolder(${index})">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        </div>
        
        <div class="links"></div>
        
        <ol class="list" id="list-${index}">
            ${sortedLinks.map((link, linkIndex) => `
                <li class="anchors">
                    <a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.title}</a>
                    <button class="deleteLink" onclick="deleteLink(${index}, ${linkIndex})">
                        <span class="material-icons">close</span>
                    </button>
                </li>
            `).join('')}
        </ol>
        
        <div class="task" id="task-${index}">
            <input type="text" id="linkTitle-${index}" placeholder="Enter Link Title">
            <input type="text" id="linkUrl-${index}" placeholder="Enter Link URL">
        </div>
        
        <div class="links"></div>
        
        <div class="folderBottom">
            <button class="addTask" id="addTask-${index}" onclick="showAddTask(${index})">
                <span class="material-icons">add</span>
                Add Link
            </button>
            <button class="saveTask" id="saveTask-${index}" onclick="saveLink(${index})">
                <span class="material-icons">save</span>
                Save
            </button>
            <button class="cancel" id="cancel-${index}" onclick="cancelAddTask(${index})">
                <span class="material-icons">close</span>
                Cancel
            </button>
        </div>
    `;

    return folderEl;
}

// Show Add Task Form
function showAddTask(index) {
    const task = document.getElementById(`task-${index}`);
    const addBtn = document.getElementById(`addTask-${index}`);
    const saveBtn = document.getElementById(`saveTask-${index}`);
    const cancelBtn = document.getElementById(`cancel-${index}`);

    task.classList.add('show');
    addBtn.style.display = 'none';
    saveBtn.classList.add('show');
    cancelBtn.classList.add('show');
}

// Cancel Add Task
function cancelAddTask(index) {
    const task = document.getElementById(`task-${index}`);
    const addBtn = document.getElementById(`addTask-${index}`);
    const saveBtn = document.getElementById(`saveTask-${index}`);
    const cancelBtn = document.getElementById(`cancel-${index}`);
    const titleInput = document.getElementById(`linkTitle-${index}`);
    const urlInput = document.getElementById(`linkUrl-${index}`);

    task.classList.remove('show');
    addBtn.style.display = 'flex';
    saveBtn.classList.remove('show');
    cancelBtn.classList.remove('show');

    titleInput.value = '';
    urlInput.value = '';
}

// Save Link
async function saveLink(index) {
    const titleInput = document.getElementById(`linkTitle-${index}`);
    const urlInput = document.getElementById(`linkUrl-${index}`);

    const title = titleInput.value.trim();
    let url = urlInput.value.trim();

    if (!title || !url) {
        showMessage('Please fill in both fields');
        return;
    }

    // Add https:// if no protocol specified
    if (!url.match(/^https?:\/\//i)) {
        url = 'https://' + url;
    }

    const newLink = { title, url };

    if (!folders[index].links) {
        folders[index].links = [];
    }

    folders[index].links.push(newLink);

    const result = await apiCall('/links', 'PUT', { folders });

    if (result && result.ok) {
        showMessage('Link added successfully');
        cancelAddTask(index);
        renderFolders();
    } else {
        showMessage('Failed to add link');
        folders[index].links.pop();
    }
}

// Delete Link
async function deleteLink(folderIndex, linkIndex) {
    if (!confirm('Are you sure you want to delete this link?')) {
        return;
    }

    folders[folderIndex].links.splice(linkIndex, 1);

    const result = await apiCall('/links', 'PUT', { folders });

    if (result && result.ok) {
        showMessage('Link deleted successfully');
        renderFolders();
    } else {
        showMessage('Failed to delete link');
        loadFolders();
    }
}

// Delete Folder
async function deleteFolder(index) {
    if (!confirm('Are you sure you want to delete this folder?')) {
        return;
    }

    folders.splice(index, 1);

    const result = await apiCall('/links', 'PUT', { folders });

    if (result && result.ok) {
        showMessage('Folder deleted successfully');
        renderFolders();
    } else {
        showMessage('Failed to delete folder');
        loadFolders();
    }
}

// Create New Collection
document.getElementById('createButton').addEventListener('click', async () => {
    const input = document.getElementById('newCollectionInput');
    const name = input.value.trim();

    if (!name) {
        showMessage('Please enter a collection name');
        return;
    }

    const newFolder = {
        name: name,
        links: []
    };

    folders.push(newFolder);

    const result = await apiCall('/links', 'PUT', { folders });

    if (result && result.ok) {
        showMessage('Collection created successfully');
        input.value = '';
        renderFolders();
    } else {
        showMessage('Failed to create collection');
        folders.pop();
    }
});

// Export Data
document.getElementById('exportButton').addEventListener('click', () => {
    const dataStr = JSON.stringify(folders, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'Saved Links Collection.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showMessage('Data exported successfully');
});

// Import Data
document.getElementById('importButton').addEventListener('click', () => {
    document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    try {
        const text = await file.text();
        const importedData = JSON.parse(text);

        if (!Array.isArray(importedData)) {
            showMessage('Invalid file format');
            return;
        }

        folders = importedData;

        const result = await apiCall('/links', 'PUT', { folders });

        if (result && result.ok) {
            showMessage('Data imported successfully');
            renderFolders();
        } else {
            showMessage('Failed to import data');
            loadFolders();
        }
    } catch (error) {
        showMessage('Error reading file');
        console.error('Import error:', error);
    }

    e.target.value = '';
});

// Drag and Drop for Sorting Folders
function initDragAndDrop() {
    const container = document.getElementById('folderContainer');

    new Sortable(container, {
        animation: 150,
        ghostClass: 'dragging',
        onEnd: async (evt) => {
            const oldIndex = evt.oldIndex;
            const newIndex = evt.newIndex;

            if (oldIndex === newIndex) return;

            const movedFolder = folders.splice(oldIndex, 1)[0];
            folders.splice(newIndex, 0, movedFolder);

            const result = await apiCall('/links', 'PUT', { folders });

            if (!result || !result.ok) {
                showMessage('Failed to update order');
                loadFolders();
            }
        }
    });
}

// Initialize

loadFolders();
