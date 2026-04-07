fetch('data/family.json')
.then(res => res.json())
.then(data => {

const tree = document.getElementById('tree');

// Find parents (top generation)
const parents = data.filter(p => !p.father && !p.mother);

// Find children (who have parents)
const children = data.filter(p => p.father || p.mother);

// Create Parent Row
const parentRow = document.createElement('div');
parentRow.style.display = "flex";
parentRow.style.justifyContent = "center";
parentRow.style.marginBottom = "40px";

parents.forEach(p => parentRow.appendChild(createCard(p)));
tree.appendChild(parentRow);

// Create Children Row
const childRow = document.createElement('div');
childRow.style.display = "flex";
childRow.style.justifyContent = "center";

children.forEach(p => childRow.appendChild(createCard(p)));
tree.appendChild(childRow);


function createCard(p){

const div = document.createElement('div');
div.className = 'card '+(p.status==='deceased'?'deceased':'');

div.innerHTML = `
<img src="${p.img || ''}">
<h3>${p.name}</h3>
<p>${p.role}</p>
<p>DOB: ${p.dob || '-'}</p>
<p>POB: ${p.pob || '-'}</p>
${p.dod ? `<p>DOD: ${p.dod}</p>`:''}
`;

return div;
}

});
