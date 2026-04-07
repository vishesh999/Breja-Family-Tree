fetch('data/family.json')
.then(res => res.json())
.then(data => {

const tree = document.getElementById('tree');

// Get all parent IDs from children
let parentIds = [];

data.forEach(p => {
 if(p.father) parentIds.push(p.father);
 if(p.mother) parentIds.push(p.mother);
});

// Remove duplicates
parentIds = [...new Set(parentIds)];

// Parents are those who are referenced as father/mother
const parents = data.filter(p => parentIds.includes(p.id));

// Children are those who have father/mother
const children = data.filter(p => p.father || p.mother);

// Row 1 - Parents
const parentRow = document.createElement('div');
parentRow.style.display = "flex";
parentRow.style.justifyContent = "center";
parentRow.style.gap = "20px";
parentRow.style.marginBottom = "40px";

parents.forEach(p => parentRow.appendChild(createCard(p)));
tree.appendChild(parentRow);

// Row 2 - Children
const childRow = document.createElement('div');
childRow.style.display = "flex";
childRow.style.justifyContent = "center";
childRow.style.gap = "20px";

children.forEach(p => childRow.appendChild(createCard(p)));
tree.appendChild(childRow);

function createCard(p){

const div = document.createElement('div');
div.className = 'card '+(p.status==='deceased'?'deceased':'');

div.innerHTML = `
<h3>${p.name}</h3>
<p>${p.role}</p>
<p>DOB: ${p.dob || '-'}</p>
<p>POB: ${p.pob || '-'}</p>
${p.dod ? `<p>DOD: ${p.dod}</p>`:''}
`;

return div;
}

});
