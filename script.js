fetch('data/family.json')
.then(res => res.json())
.then(data => {

const tree = document.getElementById('tree');

// Identify parents of someone
let parentIds = [];

data.forEach(p => {
 if(p.father) parentIds.push(p.father);
 if(p.mother) parentIds.push(p.mother);
});

parentIds = [...new Set(parentIds)];

const parents = data.filter(p => parentIds.includes(p.id));

// Find children
const children = data.filter(p => p.father || p.mother);

// Add spouses of children
let spouseIds = [];

children.forEach(c => {
 if(c.spouse) spouseIds.push(c.spouse);
});

const spouses = data.filter(p => spouseIds.includes(p.id));

// Merge children + spouses
const childGeneration = [...children, ...spouses];

// Row 1 - Parents
const parentRow = document.createElement('div');
parentRow.style.display = "flex";
parentRow.style.justifyContent = "center";
parentRow.style.gap = "20px";
parentRow.style.marginBottom = "40px";

parents.forEach(p => parentRow.appendChild(createCard(p)));
tree.appendChild(parentRow);

// Row 2 - Children + Spouses
const childRow = document.createElement('div');
childRow.style.display = "flex";
childRow.style.justifyContent = "center";
childRow.style.gap = "20px";

childGeneration.forEach(p => childRow.appendChild(createCard(p)));
tree.appendChild(childRow);

function createCard(p){

const div = document.createElement('div');
div.className = 'card';

div.innerHTML = `
<h3>${p.name}</h3>
<p>${p.role}</p>
`;

return div;
}

});
