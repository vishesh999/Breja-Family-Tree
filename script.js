fetch('./data/family.json', {
  cache: "no-store"
})
.then(res => res.json())
.then(data => {

const tree = document.getElementById('tree');
tree.innerHTML = "";

// Who is a parent of someone?
let parentIds = [];

data.forEach(p=>{
 if(p.father) parentIds.push(p.father);
 if(p.mother) parentIds.push(p.mother);
});

parentIds = [...new Set(parentIds)];

// Row 1 - Parents
const parents = data.filter(p=>parentIds.includes(p.id));

// Row 2 - Children
const children = data.filter(p=>p.father || p.mother);

// Add spouses of children
let spouses = [];

children.forEach(c=>{
 if(c.spouse){
  let sp = data.find(p=>p.id===c.spouse);
  if(sp) spouses.push(sp);
 }
});

// Merge children + spouses
const childGen = [...new Set([...children,...spouses])];

// ---- RENDER ----

// Parent Row
const pRow = document.createElement('div');
pRow.style.display="flex";
pRow.style.justifyContent="center";
pRow.style.gap="20px";
pRow.style.marginBottom="40px";

parents.forEach(p=>pRow.appendChild(card(p)));
tree.appendChild(pRow);

// Child Row
const cRow = document.createElement('div');
cRow.style.display="flex";
cRow.style.justifyContent="center";
cRow.style.gap="20px";

childGen.forEach(p=>cRow.appendChild(card(p)));
tree.appendChild(cRow);

// Card Function
function card(p){
 const d=document.createElement('div');
 d.className="card";
 d.innerHTML=`<h3>${p.name}</h3><p>${p.role}</p>`;
 return d;
}

});
