fetch('data/family.json', { cache: "no-store" })
.then(res => {
  if(!res.ok) throw new Error("family.json not found");
  return res.json();
})
.then(data => {

  const tree = document.getElementById('tree');
  tree.innerHTML = "";

  // ---- FIND WHO ARE PARENTS (referenced by someone) ----
  let parentIds = [];
  data.forEach(p=>{
    if(p.father) parentIds.push(p.father);
    if(p.mother) parentIds.push(p.mother);
  });
  parentIds = [...new Set(parentIds)];

  const parents  = data.filter(p => parentIds.includes(p.id));
  const children = data.filter(p => p.father || p.mother);

  // ---- PARENT ROW ----
  const parentRow = document.createElement('div');
  parentRow.className = "row";
  parents.forEach(p => parentRow.appendChild(card(p)));
  tree.appendChild(parentRow);

  // ---- CHILD + SPOUSE ROW ----
  const childRow = document.createElement('div');
  childRow.className = "row";

  children.forEach(c => {

    const couple = document.createElement('div');
    couple.className = "couple";

    // child
    couple.appendChild(card(c));

    // spouse beside
    if(c.spouse){
      const sp = data.find(p => p.id === c.spouse);
      if(sp) couple.appendChild(card(sp));
    }

    childRow.appendChild(couple);
  });

  tree.appendChild(childRow);

  // ---- CARD ----
  function card(p){
    const d = document.createElement('div');
    d.className = "card";
    d.innerHTML = `
      <img src="${p.img}" alt="${p.name}" onerror="this.style.display='none'">
      <h3>${p.name}</h3>
      <p>${p.role}</p>
    `;
    return d;
  }

})
.catch(err=>{
  document.getElementById('tree').innerHTML =
  `<p style="color:red">Error loading family tree</p>`;
  console.error(err);
});
