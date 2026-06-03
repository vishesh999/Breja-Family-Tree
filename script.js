var rawPeople = [];
var tree = document.getElementById('tree');
var searchInput = document.getElementById('search');
var statusMessage = document.getElementById('status');

var PLACEHOLDER = (function () {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<rect width="100" height="100" fill="#2a2118"/>' +
    '<circle cx="50" cy="36" r="20" fill="#5a4e3a"/>' +
    '<ellipse cx="50" cy="92" rx="30" ry="26" fill="#5a4e3a"/>' +
    '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
})();

var treeContainer = document.getElementById('tree-container');

function setStatus(message, isError) {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = isError ? 'error search-status' : 'search-status';
}

function showLoading() {
  if (tree) {
    tree.innerHTML = '<p class="loading">Loading family tree…</p>';
  }
  setStatus('');
}

function showError(message) {
  if (tree) {
    tree.innerHTML = '<p class="error">' + String(message || 'Unable to load data.') + '</p>';
  }
  setStatus('Unable to load data.', true);
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function highlightMatches(ids) {
  if (!tree) return;
  var matchSet = new Set(ids);
  tree.querySelectorAll('.card').forEach(function (card) {
    card.classList.toggle('match', matchSet.has(card.dataset.personId));
  });
}

function clearHighlights() {
  if (!tree) return;
  tree.querySelectorAll('.card.match').forEach(function (card) {
    card.classList.remove('match');
  });
}

function handleSearch(event) {
  var query = normalizeText(event.target.value.trim());
  if (!query) {
    clearHighlights();
    setStatus('');
    return;
  }

  var matches = rawPeople.filter(function (person) {
    var fields = [
      person.name,
      person.role,
      person.birth_year,
      person.death_year,
      person.status
    ].join(' ');
    return normalizeText(fields).includes(query);
  }).map(function (person) { return person.id; });

  highlightMatches(matches);

  if (matches.length === 0) {
    setStatus('No family members matched your search.');
  } else {
    setStatus(matches.length + ' member' + (matches.length === 1 ? '' : 's') + ' highlighted.');
    var firstId = matches[0];
    if (firstId) scrollToCard(firstId, false);
  }
}

searchInput && searchInput.addEventListener('input', handleSearch);

// Zoom handling: scale the `#tree` while preserving the visual center
var zoomLevel = 1;
var zoomOutButton = document.getElementById('zoom-out');
var zoomInButton = document.getElementById('zoom-in');
var zoomLevelDisplay = document.getElementById('zoom-level');

function applyZoom() {
  if (!tree) return;
  var prevScale = tree._scale || 1;
  var prevCenterX = 0, prevCenterY = 0;
  if (treeContainer) {
    prevCenterX = (treeContainer.scrollLeft + treeContainer.clientWidth / 2) / prevScale;
    prevCenterY = (treeContainer.scrollTop + treeContainer.clientHeight / 2) / prevScale;
  }

  tree.style.transform = 'scale(' + zoomLevel + ')';
  tree._scale = zoomLevel;
  zoomLevelDisplay && (zoomLevelDisplay.textContent = Math.round(zoomLevel * 100) + '%');

  if (treeContainer) {
    var newScrollLeft = Math.max(0, Math.round(prevCenterX * zoomLevel - treeContainer.clientWidth / 2));
    var newScrollTop = Math.max(0, Math.round(prevCenterY * zoomLevel - treeContainer.clientHeight / 2));
    treeContainer.scrollTo({ left: newScrollLeft, top: newScrollTop, behavior: 'auto' });
  }
}

function updateZoom(delta) {
  zoomLevel = Math.min(1.6, Math.max(0.6, Math.round((zoomLevel + delta) * 10) / 10));
  applyZoom();
}

zoomOutButton && zoomOutButton.addEventListener('click', function () {
  updateZoom(-0.1);
});
zoomInButton && zoomInButton.addEventListener('click', function () {
  updateZoom(0.1);
});

applyZoom();

function scrollToCard(personId, focusCard) {
  if (!tree || !treeContainer) return;
  var card = tree.querySelector('.card[data-person-id="' + personId + '"]');
  if (!card) return;
  // use bounding boxes to account for nesting and transforms
  var cardRect = card.getBoundingClientRect();
  var containerRect = treeContainer.getBoundingClientRect();
  var centerX = cardRect.left + cardRect.width / 2;
  var centerY = cardRect.top + cardRect.height / 2;
  var scrollLeft = Math.max(0, Math.round(treeContainer.scrollLeft + (centerX - containerRect.left) - treeContainer.clientWidth / 2));
  var scrollTop = Math.max(0, Math.round(treeContainer.scrollTop + (centerY - containerRect.top) - treeContainer.clientHeight / 2));
  treeContainer.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'smooth' });
  // Only move focus when explicitly requested, so live typing in the
  // search box is never interrupted by focus jumping to a card.
  if (focusCard) {
    try { card.focus({ preventScroll: true }); } catch (e) { card.focus(); }
  }
}

showLoading();
fetch('data/family.json', { cache: 'no-store' })
  .then(function (response) {
    if (!response.ok) throw new Error('family.json not found');
    return response.json();
  })
  .then(function (people) {
    rawPeople.push.apply(rawPeople, people);
    renderTree(rawPeople);
  })
  .catch(function (error) {
    showError(error.message);
  });

function renderTree(people) {
  var byId = {};
  people.forEach(function (person) { byId[person.id] = person; });

  var childrenByParents = {};
  people.forEach(function (person) {
    if (person.father || person.mother) {
      var father = person.father || '';
      var mother = person.mother || '';
      var key = [father, mother].sort().join('-');
      (childrenByParents[key] = childrenByParents[key] || []).push(person);
    }
  });

  function getChildren(person, spouse) {
    if (!person) return [];
    if (spouse) {
      var key = [person.id, spouse.id].sort().join('-');
      return childrenByParents[key] ? childrenByParents[key].slice() : [];
    }
    return people.filter(function (child) {
      return child.father === person.id || child.mother === person.id;
    });
  }

  function byBirthThenName(a, b) {
    var ay = a.birth_year || 9999;
    var by = b.birth_year || 9999;
    if (ay !== by) return ay - by;
    return String(a.name).localeCompare(String(b.name));
  }

  var rendered = {};

  function renderNode(person) {
    if (!person || rendered[person.id]) return null;

    var spouse = person.spouse && byId[person.spouse] ? byId[person.spouse] : null;
    if (spouse && rendered[spouse.id]) spouse = null;

    rendered[person.id] = true;

    var li = document.createElement('li');
    li.className = 'node';

    var personWrap = document.createElement('div');
    personWrap.className = 'person';

    if (spouse) {
      rendered[spouse.id] = true;
      var coupleDiv = document.createElement('div');
      coupleDiv.className = 'couple';
      coupleDiv.appendChild(makeCard(person));
      var heart = document.createElement('span');
      heart.className = 'heart';
      heart.textContent = '♥';
      coupleDiv.appendChild(heart);
      coupleDiv.appendChild(makeCard(spouse));
      personWrap.appendChild(coupleDiv);
    } else {
      var singleDiv = document.createElement('div');
      singleDiv.className = 'single';
      singleDiv.appendChild(makeCard(person));
      personWrap.appendChild(singleDiv);
    }

    li.appendChild(personWrap);

    var children = getChildren(person, spouse).filter(function (child) {
      return !rendered[child.id];
    });
    children.sort(byBirthThenName);

    if (children.length) {
      var branches = document.createElement('ul');
      branches.className = 'branches';
      children.forEach(function (child) {
        var childNode = renderNode(child);
        if (childNode) branches.appendChild(childNode);
      });
      if (branches.children.length) li.appendChild(branches);
    }

    return li;
  }

  var roots = people.filter(function (person) {
    if (person.father || person.mother) return false;
    if (!person.spouse) return true;
    var spouse = byId[person.spouse];
    return !spouse || (!spouse.father && !spouse.mother);
  });

  // Keep only one partner per root couple so it isn't rendered twice.
  roots = roots.filter(function (person) {
    var spouse = byId[person.spouse];
    if (spouse && roots.indexOf(spouse) !== -1) {
      return person.id <= spouse.id;
    }
    return true;
  });

  roots.sort(byBirthThenName);

  if (!tree) return;
  tree.innerHTML = '';

  var rootUl = document.createElement('ul');
  rootUl.className = 'tree-root';
  roots.forEach(function (root) {
    var node = renderNode(root);
    if (node) rootUl.appendChild(node);
  });
  tree.appendChild(rootUl);
}

function makeCard(person) {
  var card = document.createElement('article');
  card.className = 'card' + (person.status === 'deceased' ? ' deceased' : '');
  card.dataset.personId = person.id || '';
  card.tabIndex = 0;

  var labelText = person.name + (person.role ? ' — ' + person.role : '') + (person.status ? ', ' + (person.status === 'deceased' ? 'deceased' : 'living') : '');
  card.setAttribute('aria-label', labelText);

  var imgWrap = document.createElement('div');
  imgWrap.className = 'img-wrap';
  var img = document.createElement('img');
  img.alt = person.name;
  img.src = person.img || PLACEHOLDER;
  img.onerror = function () { this.src = PLACEHOLDER; };
  imgWrap.appendChild(img);
  card.appendChild(imgWrap);

  var h3 = document.createElement('h3');
  h3.textContent = person.name;
  card.appendChild(h3);

  if (person.role) {
    var role = document.createElement('p');
    role.className = 'role';
    role.textContent = person.role;
    card.appendChild(role);
  }

  var meta = document.createElement('p');
  meta.className = 'meta';
  var metaParts = [];

  if (person.birth_year) {
    metaParts.push(String(person.birth_year));
  }
  if (person.death_year) {
    if (person.birth_year) {
      metaParts[metaParts.length - 1] = metaParts[metaParts.length - 1] + '–' + String(person.death_year);
    } else {
      metaParts.push('✝ ' + String(person.death_year));
    }
  }
  if (person.status) {
    metaParts.push(person.status === 'deceased' ? 'Deceased' : 'Living');
  }

  meta.textContent = metaParts.join(' · ');
  card.appendChild(meta);

  return card;
}
