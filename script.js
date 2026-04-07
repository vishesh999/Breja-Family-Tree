fetch('data/family.json')
.then(res => res.json())
.then(data => {

const tree = document.getElementById('tree');
tree.innerHTML = "";

// Identify parents
let parentIds = [];

data.forEach(p => {
 if(p.father) parentIds.push(p.father);
 if(p.mother) parentIds.push(p.mother);
});

parentIds = [...new Set(parentIds)];

const parents = data.filter(p => parentIds.includes(p.id));
const children = data.filter(p => p.father || p.mother);

// include spouses
let spouses = [];
children.forEach(c=>{
 if(c.spouse){
  let sp = data.find(p=>p.id===c.spouse);
  if(sp) spouses.push(sp);
 }
});

const childGen = [...new Set([...children,...spouses])];

// Parent row
const pRow = document.createElement('div');
pRow.style.display="flex";
pRow.style.justifyContent="center";
pRow.style.gap="20px";
pRow.style.marginBottom="40px";

parents.forEach(p=>pRow.appendChild(card(p)));
tree.appendChild(pRow);

// Children row
const cRow = document.createElement('div');
cRow.style.display="flex";
cRow.style.justifyContent="center";
cRow.style.gap="20px";

childGen.forEach(p=>cRow.appendChild(card(p)));
tree.appendChild(cRow);

function card(p){
 const d=document.createElement('div');
 d.className="card";
 d.innerHTML=`<h3>${p.name}</h3><p>${p.role}</p>`;
 return d;
}

});
