// Configuration
const API_URL = 'http://localhost:3001';
let authCredentials = null;

// ============================================
// AUTHENTICATION
// ============================================

function checkAuth() {
  const stored = localStorage.getItem('admin_auth');
  if (stored) {
    authCredentials = stored;
    document.getElementById('login-modal').classList.add('hidden');
    document.getElementById('auth-user').textContent = 'Admin connecté';
    document.getElementById('logout-btn').style.display = 'block';
    loadDashboard();
  } else {
    document.getElementById('login-modal').classList.remove('hidden');
  }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  const credentials = btoa(`${username}:${password}`);
  
  // Test auth
  try {
    const res = await fetch(`${API_URL}/api/challenges`, {
      headers: { 'Authorization': `Basic ${credentials}` }
    });
    
    if (res.ok) {
      authCredentials = credentials;
      localStorage.setItem('admin_auth', credentials);
      document.getElementById('login-modal').classList.add('hidden');
      document.getElementById('auth-user').textContent = `Admin: ${username}`;
      document.getElementById('logout-btn').style.display = 'block';
      document.getElementById('login-error').textContent = '';
      loadDashboard();
    } else {
      document.getElementById('login-error').textContent = 'Identifiants invalides';
    }
  } catch (error) {
    document.getElementById('login-error').textContent = 'Erreur de connexion à l\'API';
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('admin_auth');
  authCredentials = null;
  location.reload();
});

// ============================================
// API HELPERS
// ============================================

async function apiGet(endpoint) {
  const res = await fetch(`${API_URL}${endpoint}`);
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

async function apiPost(endpoint, data) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authCredentials}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

async function apiPut(endpoint, data) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authCredentials}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

async function apiDelete(endpoint) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Basic ${authCredentials}`
    }
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
}

// ============================================
// TABS NAVIGATION
// ============================================

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tab).classList.add('active');
    
    // Load data
    switch(tab) {
      case 'dashboard': loadDashboard(); break;
      case 'projects': loadProjects(); break;
      case 'challenges': loadChallenges(); break;
      case 'repos': loadRepos(); break;
      case 'users': loadUsers(); break;
      case 'contributions': loadContributions(); break;
      case 'leaderboard': loadLeaderboard(); break;
    }
  });
});

// ============================================
// DASHBOARD
// ============================================

async function loadDashboard() {
  try {
    const [projects, challenges, users, contributions] = await Promise.all([
      apiGet('/api/projects'),
      apiGet('/api/challenges'),
      apiGet('/api/users'),
      apiGet('/api/contributions')
    ]);
    
    document.getElementById('stat-projects').textContent = projects.length;
    document.getElementById('stat-challenges').textContent = challenges.length;
    document.getElementById('stat-users').textContent = users.length;
    document.getElementById('stat-contributions').textContent = contributions.length;
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

// ============================================
// PROJECTS
// ============================================

async function loadProjects() {
  try {
    const projects = await apiGet('/api/projects');
    const list = document.getElementById('projects-list');
    
    if (projects.length === 0) {
      list.innerHTML = '<div class="empty-state"><h3>Aucun projet</h3><p>Créez votre premier projet</p></div>';
      return;
    }
    
    list.innerHTML = projects.map(p => `
      <div class="data-item">
        <div class="data-item-content">
          <h3>${p.title}</h3>
          <p>${p.description || 'Pas de description'}</p>
          <small>Créé le ${new Date(p.created_at).toLocaleDateString()}</small>
        </div>
        <div class="data-item-actions">
          <button class="btn-warning" onclick="editProject('${p.uuid}')">✏️ Modifier</button>
          <button class="btn-danger" onclick="deleteProject('${p.uuid}')">🗑️ Supprimer</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading projects:', error);
  }
}

function showCreateProjectModal() {
  document.getElementById('project-modal-title').textContent = 'Nouveau Projet';
  document.getElementById('project-form').reset();
  document.getElementById('project-id').value = '';
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('project-modal').classList.add('active');
}

async function editProject(id) {
  try {
    const project = await apiGet(`/api/projects/${id}`);
    document.getElementById('project-modal-title').textContent = 'Modifier Projet';
    document.getElementById('project-id').value = project.uuid;
    document.getElementById('project-title').value = project.title;
    document.getElementById('project-description').value = project.description || '';
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('project-modal').classList.add('active');
  } catch (error) {
    alert('Erreur lors du chargement du projet');
  }
}

document.getElementById('project-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('project-id').value;
  const data = {
    title: document.getElementById('project-title').value,
    description: document.getElementById('project-description').value
  };
  
  try {
    if (id) {
      await apiPut(`/api/projects/${id}`, data);
    } else {
      await apiPost('/api/projects', data);
    }
    closeModals();
    loadProjects();
  } catch (error) {
    alert('Erreur lors de l\'enregistrement');
  }
});

async function deleteProject(id) {
  if (!confirm('Supprimer ce projet ?')) return;
  
  try {
    await apiDelete(`/api/projects/${id}`);
    loadProjects();
  } catch (error) {
    alert('Erreur lors de la suppression');
  }
}

// ============================================
// CHALLENGES
// ============================================

async function loadChallenges() {
  try {
    const challenges = await apiGet('/api/challenges');
    const list = document.getElementById('challenges-list');
    
    // Load projects for filter
    const projects = await apiGet('/api/projects');
    const projectSelect = document.getElementById('challenge-project');
    projectSelect.innerHTML = projects.map(p => 
      `<option value="${p.uuid}">${p.title}</option>`
    ).join('');
    
    // Load challenge filter
    const challengeFilter = document.getElementById('challenge-filter');
    const leaderboardFilter = document.getElementById('leaderboard-challenge-filter');
    const filterHTML = challenges.map(c => 
      `<option value="${c.uuid}">${c.title}</option>`
    ).join('');
    challengeFilter.innerHTML = '<option value="">Tous les challenges</option>' + filterHTML;
    leaderboardFilter.innerHTML = '<option value="">Global</option>' + filterHTML;
    
    if (challenges.length === 0) {
      list.innerHTML = '<div class="empty-state"><h3>Aucun challenge</h3><p>Créez votre premier challenge</p></div>';
      return;
    }
    
    list.innerHTML = challenges.map(c => `
      <div class="data-item">
        <div class="data-item-content">
          <h3>${c.title}</h3>
          <p>${c.description || 'Pas de description'}</p>
          <p>
            <span class="badge badge-${c.status === 'active' ? 'success' : 'warning'}">${c.status}</span>
            ${c.start_date ? new Date(c.start_date).toLocaleDateString() : ''} - 
            ${c.end_date ? new Date(c.end_date).toLocaleDateString() : ''}
          </p>
          <p>💰 Pool: ${c.contribution_points_reward} CP</p>
          <p>
            ${
              (c.drive_folder_name || c.drive_folder_id)
                ? `<a href="${c.drive_folder_url || `https://drive.google.com/drive/folders/${c.drive_folder_id}`}" target="_blank" rel="noopener noreferrer" class="badge badge-info">📁 ${c.drive_folder_name || c.drive_folder_id}</a>`
                : "<span class=\"badge badge-warning\">📁 Aucun dossier Drive</span>"
            }
          </p>
        </div>
        <div class="data-item-actions">
          <button class="btn-primary" onclick="selectDriveFolderForChallenge('${c.uuid}')">📁 Dossier Drive</button>
          <button class="btn-success" onclick="runSync('${c.uuid}')">🔄 Sync</button>
          <button class="btn-warning" onclick="closeChallenge('${c.uuid}')">🏆 Clôturer</button>
          <button class="btn-danger" onclick="deleteChallenge('${c.uuid}')">🗑️</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading challenges:', error);
  }
}

function showCreateChallengeModal() {
  document.getElementById('challenge-modal-title').textContent = 'Nouveau Challenge';
  document.getElementById('challenge-form').reset();
  document.getElementById('challenge-id').value = '';
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('challenge-modal').classList.add('active');
}

document.getElementById('challenge-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('challenge-id').value;
  const data = {
    index: Date.now(),
    title: document.getElementById('challenge-title').value,
    description: document.getElementById('challenge-description').value,
    status: 'active',
    start_date: document.getElementById('challenge-start').value || new Date(),
    end_date: document.getElementById('challenge-end').value || new Date(),
    roadmap: document.getElementById('challenge-roadmap').value,
    contribution_points_reward: parseInt(document.getElementById('challenge-reward').value),
    project_id: document.getElementById('challenge-project').value
  };
  
  try {
    if (id) {
      await apiPut(`/api/challenges/${id}`, data);
    } else {
      await apiPost('/api/challenges', data);
    }
    closeModals();
    loadChallenges();
  } catch (error) {
    alert('Erreur lors de l\'enregistrement');
  }
});

async function selectDriveFolderForChallenge(challengeId) {
  if (!window.GoogleDrivePicker || typeof window.GoogleDrivePicker.selectFolder !== "function") {
    alert("Sélecteur Google Drive non disponible. Vérifiez la configuration Google.");
    return;
  }

  try {
    const selection = await window.GoogleDrivePicker.selectFolder();
    if (!selection) {
      return;
    }

    console.log("ID : " + selection.id);
    console.log("Name : " + selection.name);
    
    try {
      await apiPut(`/api/challenges/${challengeId}/drive-folder`, {
        folderId: selection.id,
        folderName: selection.name,
        folderUrl: selection.url
      });
      alert(`📁 Dossier enregistré : ${selection.name}`);
      loadChallenges();
    } catch (apiError) {
      console.error("Erreur API lors de l'enregistrement du dossier Google Drive", apiError);
      alert("Impossible d'enregistrer le dossier Google Drive pour ce challenge (API).");
    }
  } catch (error) {
    console.error("Erreur lors de la sélection du dossier Google Drive", error);
    alert("Impossible d'ouvrir le sélecteur Google Drive.");
  }
}

async function runSync(id) {
  if (!confirm('Lancer une évaluation Sync Meeting ?')) return;
  
  try {
    const result = await apiPost(`/api/challenges/${id}/sync`, {});
    alert(`✅ ${result.count} évaluations effectuées !`);
    loadContributions();
  } catch (error) {
    alert('Erreur lors du sync');
  }
}

async function closeChallenge(id) {
  if (!confirm('Clôturer ce challenge et distribuer les rewards ?')) return;
  
  try {
    const result = await apiPost(`/api/challenges/${id}/close`, {});
    alert(`✅ ${result.count} rewards distribués !`);
    loadChallenges();
    loadLeaderboard();
  } catch (error) {
    alert('Erreur lors de la clôture');
  }
}

async function deleteChallenge(id) {
  if (!confirm('Supprimer ce challenge ?')) return;
  
  try {
    await apiDelete(`/api/challenges/${id}`);
    loadChallenges();
  } catch (error) {
    alert('Erreur lors de la suppression');
  }
}

// ============================================
// REPOS
// ============================================

async function loadRepos() {
  try {
    const repos = await apiGet('/api/repos');
    const list = document.getElementById('repos-list');
    
    // Load projects and challenges for display
    const [projects, challenges] = await Promise.all([
      apiGet('/api/projects'),
      apiGet('/api/challenges')
    ]);
    
    const projectSelect = document.getElementById('repo-project');
    projectSelect.innerHTML = projects.map(p => 
      `<option value="${p.uuid}">${p.title}</option>`
    ).join('');
    
    if (repos.length === 0) {
      list.innerHTML = '<div class="empty-state"><h3>Aucun repository</h3><p>Créez votre premier repository</p></div>';
      return;
    }
    
    // Pour chaque repo, récupérer les challenges liés
    const reposWithChallenges = await Promise.all(
      repos.map(async (r) => {
        try {
          const context = await apiGet(`/api/challenges`);
          // Filtrer les challenges qui ont ce repo
          const linkedChallenges = [];
          for (const challenge of context) {
            const challengeContext = await apiGet(`/api/challenges/${challenge.uuid}/context`);
            if (challengeContext.repos.some(repo => repo.uuid === r.uuid)) {
              linkedChallenges.push(challenge);
            }
          }
          return { ...r, linkedChallenges };
        } catch {
          return { ...r, linkedChallenges: [] };
        }
      })
    );
    
    list.innerHTML = reposWithChallenges.map(r => {
      const project = projects.find(p => p.uuid === r.project_id);
      const challengesList = r.linkedChallenges.length > 0
        ? r.linkedChallenges.map(c => `<span class="badge badge-success">🎯 ${c.title}</span>`).join(' ')
        : '<span class="badge badge-warning">Aucun challenge lié</span>';
      
      return `
        <div class="data-item">
          <div class="data-item-content">
            <h3>${r.title}</h3>
            <p>
              <span class="badge badge-info">${r.type}</span>
              ${r.external_repo_id}
            </p>
            <p>
              📁 ${project ? project.title : 'Projet inconnu'} • 
              ${challengesList}
            </p>
            <small>Créé le ${new Date(r.created_at).toLocaleDateString()}</small>
          </div>
          <div class="data-item-actions">
            <button class="btn-success" onclick="linkRepoToChallenge('${r.uuid}')">🔗 Lier au Challenge</button>
            <button class="btn-danger" onclick="deleteRepo('${r.uuid}')">🗑️ Supprimer</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading repos:', error);
  }
}

function showCreateRepoModal() {
  document.getElementById('repo-modal-title').textContent = 'Nouveau Repository';
  document.getElementById('repo-form').reset();
  document.getElementById('repo-id').value = '';
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('repo-modal').classList.add('active');
}

document.getElementById('repo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const data = {
    title: document.getElementById('repo-title').value,
    type: document.getElementById('repo-type').value,
    external_repo_id: document.getElementById('repo-external-id').value,
    project_id: document.getElementById('repo-project').value
  };
  
  try {
    await apiPost('/api/repos', data);
    closeModals();
    loadRepos();
  } catch (error) {
    alert('Erreur lors de l\'enregistrement');
  }
});

async function linkRepoToChallenge(repoId) {
  const challenges = await apiGet('/api/challenges');
  const challengeId = prompt(`Lier au challenge (ID):\n\n${challenges.map(c => `${c.title}: ${c.uuid}`).join('\n')}`);
  
  if (!challengeId) return;
  
  try {
    await apiPost('/api/repos/challenge-repos', {
      challenge_id: challengeId,
      repo_id: repoId
    });
    alert('✅ Repo lié au challenge !');
  } catch (error) {
    alert('Erreur lors du lien');
  }
}

async function deleteRepo(id) {
  if (!confirm('Supprimer ce repository ?')) return;
  
  try {
    await apiDelete(`/api/repos/${id}`);
    loadRepos();
  } catch (error) {
    alert('Erreur lors de la suppression');
  }
}

// ============================================
// USERS
// ============================================

async function loadUsers() {
  try {
    const users = await apiGet('/api/users');
    const list = document.getElementById('users-list');
    
    if (users.length === 0) {
      list.innerHTML = '<div class="empty-state"><h3>Aucun utilisateur</h3><p>Créez votre premier utilisateur</p></div>';
      return;
    }
    
    list.innerHTML = users.map(u => `
      <div class="data-item">
        <div class="data-item-content">
          <h3>${u.full_name}</h3>
          <p>@${u.github_username} • ${u.role}</p>
          <small>Créé le ${new Date(u.created_at).toLocaleDateString()}</small>
        </div>
        <div class="data-item-actions">
          <button class="btn-danger" onclick="deleteUser('${u.uuid}')">🗑️ Supprimer</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function showCreateUserModal() {
  document.getElementById('user-modal-title').textContent = 'Nouveau User';
  document.getElementById('user-form').reset();
  document.getElementById('user-id').value = '';
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('user-modal').classList.add('active');
}

document.getElementById('user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const data = {
    full_name: document.getElementById('user-fullname').value,
    github_username: document.getElementById('user-github').value,
    role: document.getElementById('user-role').value
  };
  
  try {
    await apiPost('/api/users', data);
    closeModals();
    loadUsers();
  } catch (error) {
    alert('Erreur lors de l\'enregistrement');
  }
});

async function deleteUser(id) {
  if (!confirm('Supprimer cet utilisateur ?')) return;
  
  try {
    await apiDelete(`/api/users/${id}`);
    loadUsers();
  } catch (error) {
    alert('Erreur lors de la suppression');
  }
}

// ============================================
// CONTRIBUTIONS
// ============================================

async function loadContributions() {
  try {
    const challengeId = document.getElementById('challenge-filter').value;
    const endpoint = challengeId 
      ? `/api/contributions/challenge/${challengeId}`
      : '/api/contributions';
    
    const contributions = await apiGet(endpoint);
    const list = document.getElementById('contributions-list');
    
    if (contributions.length === 0) {
      list.innerHTML = '<div class="empty-state"><h3>Aucune contribution</h3></div>';
      return;
    }
    
    // Charger les users et challenges pour afficher les noms
    const [users, challenges] = await Promise.all([
      apiGet('/api/users'),
      apiGet('/api/challenges')
    ]);
    
    list.innerHTML = contributions.map(c => {
      const user = users.find(u => u.uuid === c.user_id);
      const challenge = challenges.find(ch => ch.uuid === c.challenge_id);
      
      return `
        <div class="data-item">
          <div class="data-item-content">
            <h3>${c.title}</h3>
            <p>${c.description || 'Pas de description'}</p>
            <p>
              <span class="badge badge-info">${c.type}</span>
              ${user ? `👤 ${user.full_name}` : ''} • 
              ${challenge ? `🎯 ${challenge.title}` : ''}
            </p>
            <p>
              📊 Score: ${c.evaluation?.globalScore || 0} • 
              💰 Reward: ${c.reward} CP
            </p>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading contributions:', error);
  }
}

// ============================================
// LEADERBOARD
// ============================================

async function loadLeaderboard() {
  try {
    const challengeId = document.getElementById('leaderboard-challenge-filter').value;
    const endpoint = challengeId 
      ? `/api/leaderboard/challenge/${challengeId}`
      : '/api/leaderboard';
    
    const leaderboard = await apiGet(endpoint);
    const list = document.getElementById('leaderboard-list');
    
    if (leaderboard.length === 0) {
      list.innerHTML = '<div class="empty-state"><h3>Aucune donnée</h3></div>';
      return;
    }
    
    list.innerHTML = leaderboard.map((item, index) => {
      const rank = index + 1;
      let rankClass = '';
      if (rank === 1) rankClass = 'first';
      else if (rank === 2) rankClass = 'second';
      else if (rank === 3) rankClass = 'third';
      
      return `
        <div class="leaderboard-item">
          <div class="leaderboard-rank ${rankClass}">#${rank}</div>
          <div class="leaderboard-info">
            <h4>${item.title}</h4>
            <p>${item.type} • Score: ${item.evaluation?.globalScore || 0}</p>
          </div>
          <div class="leaderboard-score">
            <div class="score">${item.reward} CP</div>
          </div>
        </div>
      `;
    }).join('');
    
    // Load stats if challenge selected
    if (challengeId) {
      const stats = await apiGet(`/api/leaderboard/challenge/${challengeId}/stats`);
      const statsPanel = document.getElementById('leaderboard-stats');
      statsPanel.innerHTML = `
        <h3>📊 Statistiques du Challenge</h3>
        <p><strong>Challenge:</strong> ${stats.challenge.title}</p>
        <p><strong>Pool total:</strong> ${stats.challenge.totalPool} CP</p>
        <p><strong>Contributions:</strong> ${stats.stats.totalContributions}</p>
        <p><strong>CP distribués:</strong> ${stats.stats.totalRewardsDistributed} CP</p>
        <p><strong>CP restants:</strong> ${stats.stats.remainingPool} CP</p>
        <p><strong>Score moyen:</strong> ${stats.stats.averageScore}</p>
      `;
    } else {
      document.getElementById('leaderboard-stats').innerHTML = '';
    }
  } catch (error) {
    console.error('Error loading leaderboard:', error);
  }
}

// ============================================
// MODALS
// ============================================

function closeModals() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.querySelectorAll('.modal-form').forEach(m => m.classList.remove('active'));
}

// ============================================
// INIT
// ============================================

checkAuth();
