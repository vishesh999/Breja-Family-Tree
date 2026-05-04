const PLACEHOLDER = (function () {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<rect width="100" height="100" fill="#2a2118"/>' +
    '<circle cx="50" cy="36" r="20" fill="#5a4e3a"/>' +
    '<ellipse cx="50" cy="92" rx="30" ry="26" fill="#5a4e3a"/>' +
    '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
})();

fetch('data/family.json', { cache: 'no-store' })
  .then(function (r) {
    if (!r.ok) throw new Error('family.json not found');
    return r.json();
  })
  .then(renderTree)
  .catch(function (err) {
    document.getElementById('tree').innerHTML = '<p class="error">' + err.message + '</p>';
  });

function renderTree(people) {
  var byId = {};
  people.forEach(function (p) { byId[p.id] = p; });

  var gen = {};
  function getGen(id, visited) {
    if (visited && visited.has(id)) return -999;
    if (id in gen) return gen[id];
    var p = byId[id];
    if (!p) return gen[id] = 0;
    var v = visited || new Set();
    v.add(id);
    var parentGens = [];
    if (p.father && p.father in byId) parentGens.push(getGen(p.father, v));
    if (p.mother && p.mother in byId) parentGens.push(getGen(p.mother, v));
    if (parentGens.length === 0) {
      gen[id] = 0;
    } else {
      gen[id] = Math.max.apply(null, parentGens) + 1;
    }
    return gen[id];
  }
  people.forEach(function (p) { getGen(p.id); });

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

  var childToParents = {};
  people.forEach(function (p) {
    if (p.father || p.mother) {
      childToParents[p.id] = { father: p.father, mother: p.mother };
    }
  });

  var maxGen = Math.max.apply(null, Object.keys(gen).map(function (k) { return gen[k]; }));
  var rows = [];
  var used = {};

  for (var g = 0; g <= maxGen; g++) {
    var inGen = people.filter(function (p) { return gen[p.id] === g && !used[p.id]; });
    if (inGen.length === 0) continue;

    var row = [];
    inGen.forEach(function (p) {
      if (used[p.id]) return;

      var spouse = p.spouse && byId[p.spouse] ? byId[p.spouse] : null;
      if (spouse && !used[spouse.id] && gen[spouse.id] === g) {
        used[p.id] = true;
        used[spouse.id] = true;

        var children = [];
        people.forEach(function (child) {
          if (used[child.id]) return;
          var parents = childToParents[child.id];
          if (!parents) return;
          var match1 = parents.father === p.id && parents.mother === spouse.id;
          var match2 = parents.father === spouse.id && parents.mother === p.id;
          if (match1 || match2) {
            children.push(child);
            used[child.id] = true;
            if (child.spouse && byId[child.spouse]) {
              used[child.spouse] = true;
            }
          }
        });

        row.push({ type: 'couple', person1: p, person2: spouse, children: children });
      } else {
        used[p.id] = true;
        row.push({ type: 'single', person: p });
      }
    });

    if (row.length > 0) {
      rows.push(row);
    }
  }

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
              var childCard1 = makeCard(child);
              var childHeart = document.createElement('div');
              childHeart.className = 'heart';
              childHeart.innerHTML = '♥';
              var childCard2 = makeCard(childSpouse);
              childCouple.appendChild(childCard1);
              childCouple.appendChild(childHeart);
              childCouple.appendChild(childCard2);
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
      var conn = document.createElement('div');
      conn.className = 'connector';
      tree.appendChild(conn);
    }
  });
}

function makeCard(person) {
  var card = document.createElement('div');
  card.className = 'card' + (person.status === 'deceased' ? ' deceased' : '');

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

  var role = document.createElement('p');
  role.className = 'role';
  role.textContent = person.role || '';
  card.appendChild(role);

  var meta = document.createElement('p');
  meta.className = 'meta';
  var metaText = '';
  if (person.birth_year) {
    metaText += 'b. ' + person.birth_year;
  }
  if (person.status === 'deceased') {
    metaText += (metaText ? ' | ' : '') + '✝ Deceased';
  } else if (person.status === 'living') {
    metaText += (metaText ? ' | ' : '') + '🕊 Living';
  }
  meta.textContent = metaText;
  card.appendChild(meta);

  return card;
}
