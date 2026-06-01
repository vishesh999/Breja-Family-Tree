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
      person.father,
      person.mother,
      Array.isArray(person.sibling) ? person.sibling.join(' ') : person.sibling
    ].join(' ');
    return normalizeText(fields).includes(query);
  }).map(function (person) { return person.id; });

  highlightMatches(matches);

  if (matches.length === 0) {
    setStatus('No family members matched your search.');
  } else {
    setStatus(matches.length + ' member' + (matches.length === 1 ? '' : 's') + ' highlighted.');
    var firstId = matches[0];
    if (firstId) scrollToCard(firstId);
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

function scrollToCard(personId) {
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
  try { card.focus({preventScroll: true}); } catch (e) { card.focus(); }
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

  function getChildren(parentA, parentB) {
    return people.filter(function (child) {
      if (!child.father && !child.mother) return false;
      if (parentB === null) {
        return child.father === parentA || child.mother === parentA;
      }
      return (child.father === parentA && child.mother === parentB) ||
             (child.father === parentB && child.mother === parentA);
    });
  }

  var rendered = {};

  function renderFamilyBlock(person) {
    if (rendered[person.id]) return null;

    var spouse = person.spouse && byId[person.spouse] ? byId[person.spouse] : null;
    if (spouse && rendered[spouse.id]) {
      spouse = null;
    }

    if (spouse && person.id > spouse.id) {
      return null;
    }

    var block = document.createElement('div');
    block.className = 'family-block';

    var coupleGroup = document.createElement('div');
    coupleGroup.className = 'couple-group';

    if (spouse) {
      rendered[person.id] = true;
      rendered[spouse.id] = true;
      var coupleDiv = document.createElement('div');
      coupleDiv.className = 'couple';
      coupleDiv.appendChild(makeCard(person));
      var heart = document.createElement('div');
      heart.className = 'heart';
      heart.innerHTML = '♥';
      coupleDiv.appendChild(heart);
      coupleDiv.appendChild(makeCard(spouse));
      coupleGroup.appendChild(coupleDiv);
    } else {
      rendered[person.id] = true;
      var singleDiv = document.createElement('div');
      singleDiv.className = 'single';
      singleDiv.appendChild(makeCard(person));
      coupleGroup.appendChild(singleDiv);
    }

    block.appendChild(coupleGroup);

    var children = getChildren(person.id, spouse ? spouse.id : null);
    if (children.length) {
      var childConnector = document.createElement('div');
      childConnector.className = 'child-connector';
      block.appendChild(childConnector);

      var childrenRow = document.createElement('div');
      childrenRow.className = 'children children-row';
      children.forEach(function (child) {
        var childBlock = renderFamilyBlock(child);
        if (childBlock) {
          childrenRow.appendChild(childBlock);
        }
      });
      // mark groups with many children so CSS can adjust layout
      if (children.length > 4) {
        childrenRow.classList.add('many-children');
      }
      block.appendChild(childrenRow);
    }

    return block;
  }

  // roots: select top-level elders — those without parents but who are actual family heads
  var roots = people.filter(function (person) {
    var hasParents = person.father || person.mother;
    if (hasParents) return false;
    var isParent = people.some(function (child) { return child.father === person.id || child.mother === person.id; });
    var spouseIsParent = person.spouse && people.some(function (child) { return child.father === person.spouse || child.mother === person.spouse; });
    var isGrand = /grandfather|grandmother|grand/i.test(String(person.role || ''));
    return isParent || spouseIsParent || isGrand;
  });

  if (!tree) return;
  tree.innerHTML = '';

  var rootRow = document.createElement('div');
  rootRow.className = 'row';
  roots.forEach(function (root) {
    var familyBlock = renderFamilyBlock(root);
    if (familyBlock) {
      rootRow.appendChild(familyBlock);
    }
  });
  tree.appendChild(rootRow);
}

function getGenerationLabel(generationIndex) {
  var labels = ['Founders', 'Second Generation', 'Third Generation', 'Fourth Generation'];
  return labels[generationIndex] || 'Generation ' + (generationIndex + 1);
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
