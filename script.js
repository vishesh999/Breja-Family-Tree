// ─── Placeholder SVG for missing photos ───────────────────────────────────────
const PLACEHOLDER = (function () {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<rect width="100" height="100" fill="#2a2118"/>' +
    '<circle cx="50" cy="36" r="20" fill="#5a4e3a"/>' +
    '<ellipse cx="50" cy="92" rx="30" ry="26" fill="#5a4e3a"/>' +
    '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
})();

// ─── Load and render ──────────────────────────────────────────────────────────
fetch('data/family.json', { cache: 'no-store' })
  .then(function (r) {
    if (!r.ok) throw new Error('family.json not found (' + r.status + ')');
    return r.json();
  })
  .then(renderTree)
  .catch(function (err) {
    document.getElementById('tree').innerHTML =
      '<p class="error">Could not load family data: ' + err.message + '</p>';
    console.error(err);
  });

// ─── Core rendering function ──────────────────────────────────────────────────
function renderTree(people) {

  // 1. Build id → person map
  var byId = {};
  people.forEach(function (p) { byId[p.id] = p; });

  // 2. Assign generation depth (recursive with memoisation)
  var genCache = {};

  function genOf(id) {
    if (id in genCache) return genCache[id];
    var p = byId[id];
    if (!p || (!p.father && !p.mother)) {
      genCache[id] = 0;
      return 0;
    }
    var fg = p.father && byId[p.father] ? genOf(p.father) : -1;
    var mg = p.mother && byId[p.mother] ? genOf(p.mother) : -1;
    genCache[id] = Math.max(fg, mg) + 1;
    return genCache[id];
  }

  people.forEach(function (p) { genOf(p.id); });

  // 3. Spouses inherit their partner's generation if they have no parents
  //    Iterate twice to handle chains where both might shift.
  for (var pass = 0; pass < 2; pass++) {
    people.forEach(function (p) {
      if (!p.spouse || !byId[p.spouse]) return;
      var myG = genCache[p.id];
      var spG = genCache[p.spouse];
      if (myG !== spG) {
        var max = Math.max(myG, spG);
        genCache[p.id] = max;
        genCache[p.spouse] = max;
      }
    });
  }

  // 4. Group each generation into couples / singles (no duplicates)
  var maxGen = Math.max.apply(null, Object.keys(genCache).map(function (k) { return genCache[k]; }));
  var seen = {};
  var rows = [];

  for (var g = 0; g <= maxGen; g++) {
    var inGen = people.filter(function (p) { return genCache[p.id] === g; });
    var groups = [];

    inGen.forEach(function (p) {
      if (seen[p.id]) return;
      seen[p.id] = true;

      var sp = p.spouse ? byId[p.spouse] : null;
      if (sp && !seen[sp.id]) {
        seen[sp.id] = true;
        groups.push({ 
          couple: true, 
          members: [p, sp]
        });
      } else {
        groups.push({ 
          couple: false, 
          members: [p]
        });
      }
    });

    if (groups.length) rows.push(groups);
  }

  // 5. Render to DOM
  var tree = document.getElementById('tree');
  tree.innerHTML = '';

  rows.forEach(function (groups, gi) {
    var row = document.createElement('div');
    row.className = 'row';

    groups.forEach(function (group) {
      var wrap = document.createElement('div');
      wrap.className = group.couple ? 'couple-wrap' : 'single-wrap';

      group.members.forEach(function (person, i) {
        wrap.appendChild(makeCard(person));
        if (i === 0 && group.couple) {
          var heart = document.createElement('div');
          heart.className = 'heart';
          heart.setAttribute('aria-hidden', 'true');
          heart.innerHTML = '♥';
          wrap.appendChild(heart);
        }
      });

      row.appendChild(wrap);
    });

    tree.appendChild(row);

    // Connector between generations
    if (gi < rows.length - 1) {
      var conn = document.createElement('div');
      conn.className = 'connector';
      tree.appendChild(conn);
    }
  });
}

// ─── Card factory ─────────────────────────────────────────────────────────────
function makeCard(person) {
  var card = document.createElement('div');
  card.className = 'card' + (person.status === 'deceased' ? ' deceased' : '');

  var img = document.createElement('img');
  img.alt = person.name;
  img.src = person.img || PLACEHOLDER;
  img.onerror = function () {
    this.src = PLACEHOLDER;
    this.onerror = null;
  };

  var h3 = document.createElement('h3');
  h3.textContent = person.name;

  var role = document.createElement('p');
  role.className = 'role';
  
  // Build role text with birth order tag if applicable
  var roleText = person.role || '';
  
  if (person.sibling && person.sibling.length > 0 && person.birthOrder) {
    var birthOrderTag = '';
    if (person.birthOrder === 1) {
      birthOrderTag = ' 👑 Elder';
    } else if (person.birthOrder === 2) {
      birthOrderTag = ' 👶 Younger';
    }
    if (birthOrderTag) {
      roleText = roleText + birthOrderTag;
    }
  }
  
  role.textContent = roleText;

  card.appendChild(img);
  card.appendChild(h3);
  card.appendChild(role);
  return card;
}
