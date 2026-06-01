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
    tree.innerHTML = '<p class="error">' + message + '</p>';
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
    var firstCard = tree && tree.querySelector('.card.match');
    if (firstCard) {
      firstCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }
}

searchInput && searchInput.addEventListener('input', handleSearch);

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

  var generation = {};
  function getGeneration(id, visited) {
    if (visited && visited.has(id)) return -999;
    if (id in generation) return generation[id];
    var person = byId[id];
    if (!person) return generation[id] = 0;
    var next = visited || new Set();
    next.add(id);

    var parentValues = [];
    if (person.father && person.father in byId) parentValues.push(getGeneration(person.father, next));
    if (person.mother && person.mother in byId) parentValues.push(getGeneration(person.mother, next));

    generation[id] = parentValues.length === 0 ? 0 : Math.max.apply(null, parentValues) + 1;
    return generation[id];
  }

  people.forEach(function (person) { getGeneration(person.id); });

  var changed = true;
  var passes = 0;
  while (changed && passes < 10) {
    changed = false;
    passes += 1;
    people.forEach(function (person) {
      if (!person.spouse || !byId[person.spouse]) return;
      var myGen = generation[person.id];
      var spouseGen = generation[person.spouse];
      if (myGen !== spouseGen) {
        var newGen = Math.max(myGen, spouseGen);
        generation[person.id] = newGen;
        generation[person.spouse] = newGen;
        changed = true;
      }
    });
  }

  var childToParents = {};
  people.forEach(function (person) {
    if (person.father || person.mother) {
      childToParents[person.id] = { father: person.father, mother: person.mother };
    }
  });

  var maxGen = Math.max.apply(null, Object.keys(generation).map(function (key) { return generation[key]; }));
  var rows = [];
  var used = {};

  for (var genIndex = 0; genIndex <= maxGen; genIndex++) {
    var generationPeople = people.filter(function (person) { return generation[person.id] === genIndex && !used[person.id]; });
    if (generationPeople.length === 0) continue;

    var rowItems = [];
    generationPeople.forEach(function (person) {
      if (used[person.id]) return;
      var spouse = person.spouse && byId[person.spouse] ? byId[person.spouse] : null;

      if (spouse && !used[spouse.id] && generation[spouse.id] === genIndex) {
        used[person.id] = true;
        used[spouse.id] = true;

        var children = [];
        people.forEach(function (child) {
          if (used[child.id]) return;
          var parents = childToParents[child.id];
          if (!parents) return;
          var match1 = parents.father === person.id && parents.mother === spouse.id;
          var match2 = parents.father === spouse.id && parents.mother === person.id;
          if (match1 || match2) {
            children.push(child);
            used[child.id] = true;
            if (child.spouse && byId[child.spouse]) {
              used[child.spouse] = true;
            }
          }
        });

        rowItems.push({ generation: genIndex, type: 'couple', person1: person, person2: spouse, children: children });
      } else {
        used[person.id] = true;
        rowItems.push({ generation: genIndex, type: 'single', person: person });
      }
    });

    if (rowItems.length > 0) {
      rows.push({ generation: genIndex, items: rowItems });
    }
  }

  if (!tree) return;
  tree.innerHTML = '';

  rows.forEach(function (row, rowIdx) {
    var heading = document.createElement('div');
    heading.className = 'row-label';
    heading.textContent = getGenerationLabel(row.generation);
    tree.appendChild(heading);

    var rowDiv = document.createElement('div');
    rowDiv.className = 'row';

    row.items.forEach(function (item) {
      if (item.type === 'couple') {
        var coupleGroup = document.createElement('div');
        coupleGroup.className = 'couple-group';

        var coupleDiv = document.createElement('div');
        coupleDiv.className = 'couple';
        coupleDiv.appendChild(makeCard(item.person1));
        var heart = document.createElement('div');
        heart.className = 'heart';
        heart.innerHTML = '♥';
        coupleDiv.appendChild(heart);
        coupleDiv.appendChild(makeCard(item.person2));
        coupleGroup.appendChild(coupleDiv);

        if (item.children && item.children.length > 0) {
          var childConnector = document.createElement('div');
          childConnector.className = 'child-connector';
          coupleGroup.appendChild(childConnector);

          var childrenDiv = document.createElement('div');
          childrenDiv.className = 'children';

          item.children.forEach(function (child) {
            var childSpouse = child.spouse && byId[child.spouse] ? byId[child.spouse] : null;
            if (childSpouse) {
              var childCouple = document.createElement('div');
              childCouple.className = 'couple';
              childCouple.appendChild(makeCard(child));
              var childHeart = document.createElement('div');
              childHeart.className = 'heart';
              childHeart.innerHTML = '♥';
              childCouple.appendChild(childHeart);
              childCouple.appendChild(makeCard(childSpouse));
              childrenDiv.appendChild(childCouple);
            } else {
              childrenDiv.appendChild(makeCard(child));
            }
          });

          coupleGroup.appendChild(childrenDiv);
        }

        rowDiv.appendChild(coupleGroup);
      } else {
        var singleDiv = document.createElement('div');
        singleDiv.className = 'single';
        singleDiv.appendChild(makeCard(item.person));
        rowDiv.appendChild(singleDiv);
      }
    });

    tree.appendChild(rowDiv);
    if (rowIdx < rows.length - 1) {
      var connector = document.createElement('div');
      connector.className = 'connector';
      tree.appendChild(connector);
    }
  });
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
