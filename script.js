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

// ─── BULLETPROOF RENDER ───────────────────────────────────────────────────────
function renderTree(people) {
  var byId = {};
  people.forEach(function (p) { byId[p.id] = p; });

  // STEP 1: Calculate generation for each person
  var gen = {};
  
  function getGen(id, visited) {
    if (visited && visited.has(id)) return -999; // Circular ref protection
    if (id in gen) return gen[id];
    
    var p = byId[id];
    if (!p) return gen[id] = 0;
    
    var v = visited || new Set();
    v.add(id);
    
    var parentGens = [];
    if (p.father && p.father in byId) parentGens.push(getGen(p.father, v));
    if (p.mother && p.mother in byId) parentGens.push(getGen(p.mother, v));
    
    if (parentGens.length === 0) {
      gen[id] = 0; // No parents = gen 0
    } else {
      gen[id] = Math.max.apply(null, parentGens) + 1;
    }
    return gen[id];
  }

  people.forEach(function (p) { getGen(p.id); });

  // STEP 2: Align spouses to same generation
  var changed = true;
  var iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;
    people.forEach(function (p) {
      if (!p.spouse || !byId[p.spouse]) return;
      var myG = gen[p.id];
      var spG = gen[p.spouse];
      if (myG !== spG) {
        var newG = Math.max(myG, spG);
        gen[p.id] = newG;
        gen[p.spouse] = newG;
        changed = true;
      }
    });
  }

  // STEP 3: Build parent→children map
  var childrenOf = {};
  people.forEach(function (p) {
    if (p.father || p.mother) {
      var key = (p.father || 'X') + '|' + (p.mother || 'X');
      if (!childrenOf[key]) childrenOf[key] = [];
      childrenOf[key].push(p);
    }
  });

  // STEP 4: Build generation rows with couple grouping + children positioning
  var maxGen = Math.max.apply(null, Object.keys(gen).map(function (k) { return gen[k]; }));
  var rows = [];
  var used = {};

  for (var g = 0; g <= maxGen; g++) {
    var inGen = people.filter(function (p) { return gen[p.id] === g && !used[p.id]; });
    if (inGen.length === 0) continue;

    var row = [];
    inGen.forEach(function (p) {
      if (used[p.id]) return; // Skip if already in a couple

      var spouse = p.spouse && byId[p.spouse] ? byId[p.spouse] : null;
      
      if (spouse && !used[spouse.id] && gen[spouse.id] === g) {
        // Render as couple
        used[p.id] = true;
        used[spouse.id] = true;
        
        // Check if this couple has children
        var childKey = (p.id || 'X') + '|' + (spouse.id || 'X');
        var childKey2 = (spouse.id || 'X') + '|' + (p.id || 'X');
        var children = childrenOf[childKey] || childrenOf[childKey2] || [];
        
        // Filter to only children in next generation without spouse
        children = children.filter(function (c) {
          return gen[c.id] === g + 1 && !c.spouse;
        });
        
        row.push({ 
          type: 'couple', 
          person1: p, 
          person2: spouse, 
          children: children 
        });
      } else {
        // Render as single
        used[p.id] = true;
        row.push({ type: 'single', person: p });
      }
    });

    if (row.length > 0) {
      rows.push(row);
    }
  }

  // STEP 5: Render to DOM
  var tree = document.getElementById('tree');
  tree.innerHTML = '';

  rows.forEach(function (row, rowIdx) {
    var rowDiv = document.createElement('div');
    rowDiv.className = 'row';

    row.forEach(function (item) {
      if (item.type === 'couple') {
        var coupleGroup = document.createElement('div');
        coupleGroup.className = 'couple-group';
        
        var coupleDiv = document.createElement('div');
        coupleDiv.className = 'couple';
        
        var card1 = makeCard(item.person1);
        var heart = document.createElement('div');
        heart.className = 'heart';
        heart.innerHTML = '♥';
        var card2 = makeCard(item.person2);
        
        coupleDiv.appendChild(card1);
        coupleDiv.appendChild(heart);
        coupleDiv.appendChild(card2);
        coupleGroup.appendChild(coupleDiv);
        
        // Render children below couple if they exist
        if (item.children && item.children.length > 0) {
          // Mark children as used
          item.children.forEach(function (child) {
            used[child.id] = true;
          });
          
          var childConnector = document.createElement('div');
          childConnector.className = 'child-connector';
          coupleGroup.appendChild(childConnector);
          
          var childrenDiv = document.createElement('div');
          childrenDiv.className = 'children';
          item.children.forEach(function (child) {
            childrenDiv.appendChild(makeCard(child));
          });
          coupleGroup.appendChild(childrenDiv);
        }
        
        rowDiv.appendChild(coupleGroup);
      } else {
        var card = makeCard(item.person);
        var singleDiv = document.createElement('div');
        singleDiv.className = 'single';
        singleDiv.appendChild(card);
        rowDiv.appendChild(singleDiv);
      }
    });

    tree.appendChild(rowDiv);

    // Connector between rows
    if (rowIdx < rows.length - 1) {
      var conn = document.createElement('div');
      conn.className = 'connector';
      tree.appendChild(conn);
    }
  });
}

// ─── Make card ─────────────────────────────────────────────────────────────────
function makeCard(person) {
  var card = document.createElement('div');
  card.className = 'card' + (person.status === 'deceased' ? ' deceased' : '');

  var imgWrap = document.createElement('div');
  imgWrap.className = 'img-wrap';
  
  var img = document.createElement('img');
  img.alt = person.name;
  img.src = person.img || PLACEHOLDER;
  img.onerror = function () {
    this.src = PLACEHOLDER;
  };
  imgWrap.appendChild(img);
  card.appendChild(imgWrap);

  var h3 = document.createElement('h3');
  h3.textContent = person.name;
  card.appendChild(h3);

  var role = document.createElement('p');
  role.className = 'role';
  var roleText = person.role || '';
  
  // Add birth order if sibling exists
  if (person.sibling && person.sibling.length > 0 && person.birthOrder) {
    if (person.birthOrder === 1) roleText += ' 👑 Elder';
    else if (person.birthOrder === 2) roleText += ' 👶 Younger';
  }
  
  role.textContent = roleText;
  card.appendChild(role);

  return card;
}
